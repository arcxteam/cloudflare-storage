import hmac
import json
import logging
import math
import os
import secrets
import time
from datetime import datetime, timedelta
from functools import wraps

import boto3
import jwt
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, send_file, redirect, Response, make_response

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

load_dotenv()

app = Flask(__name__, static_folder=None)

# Cloudflare R2 Configuration
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost").rstrip('/')

DOWNLOAD_COUNT_FILE = 'data/download_counts.json'
UPLOAD_HISTORY_FILE = 'data/upload_history.json'

# Authentication Configuration
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", secrets.token_hex(64))
AUTH_COOKIE_NAME = "__Host-auth_token"
AUTH_SESSION_HOURS = int(os.getenv("AUTH_SESSION_HOURS", "24"))

# In-memory Rate Limiter
login_attempts = {}  # {ip: [(timestamp, ...], ...}
RATE_LIMIT_WINDOW = 900  # 15mins
RATE_LIMIT_MAX = 3

def check_rate_limit(ip):
    """Check if IP has exceeded login rate limit."""
    now = time.time()
    if ip not in login_attempts:
        login_attempts[ip] = []
    
    # Clean old entries
    login_attempts[ip] = [t for t in login_attempts[ip] if now - t < RATE_LIMIT_WINDOW]
    
    if len(login_attempts[ip]) >= RATE_LIMIT_MAX:
        return False
    return True

def record_attempt(ip):
    """Record a login attempt for rate limiting."""
    now = time.time()
    if ip not in login_attempts:
        login_attempts[ip] = []
    login_attempts[ip].append(now)

def get_client_ip():
    """Get real client IP, considering proxy headers."""
    return request.headers.get('X-Real-IP', 
           request.headers.get('X-Forwarded-For', request.remote_addr))

# JWT Token Management
def generate_auth_token():
    """Generate a signed JWT token for authenticated session."""
    now = datetime.utcnow()
    payload = {
        'iat': now,
        'exp': now + timedelta(hours=AUTH_SESSION_HOURS),
        'jti': secrets.token_hex(16),
        'sub': 'admin',
        'iss': 'r2-storage-auth'
    }
    return jwt.encode(payload, AUTH_SECRET_KEY, algorithm='HS256')

def verify_auth_token(token):
    """Verify JWT token. Returns payload or None."""
    try:
        payload = jwt.decode(
            token, 
            AUTH_SECRET_KEY, 
            algorithms=['HS256'],
            options={
                'require': ['exp', 'iat', 'jti', 'sub', 'iss'],
                'verify_exp': True,
                'verify_iat': True
            }
        )
        if payload.get('iss') != 'r2-storage-auth':
            return None
        if payload.get('sub') != 'admin':
            return None
        return payload
    except jwt.ExpiredSignatureError:
        app.logger.info("Auth token expired")
        return None
    except jwt.InvalidTokenError as e:
        app.logger.warning(f"Invalid auth token: {e}")
        return None

def verify_password(password):
    """Verify password against plain text from env (timing-safe)."""
    if not ADMIN_PASSWORD:
        app.logger.error("ADMIN_PASSWORD not configured in .env")
        return False
    try:
        return hmac.compare_digest(
            password.encode('utf-8'),
            ADMIN_PASSWORD.encode('utf-8')
        )
    except Exception as e:
        app.logger.error(f"Password verification error: {e}")
        return False

# Authentication Decorator
def require_auth(f):
    """Decorator to require authentication on API endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.cookies.get(AUTH_COOKIE_NAME)
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        
        payload = verify_auth_token(token)
        if not payload:
            response = make_response(jsonify({"error": "Invalid or expired session"}), 401)
            # Clear invalid cookie
            response.delete_cookie(AUTH_COOKIE_NAME, path='/', samesite='Strict')
            return response
        
        return f(*args, **kwargs)
    return decorated_function

# Security Headers Middleware
@app.after_request
def add_security_headers(response):
    """Add security headers to every response."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    # CSP: only allow scripts/styles from self and CDN sources used by frontend
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
        "font-src 'self' https://cdnjs.cloudflare.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    return response

# S3-Compatible Storage Client
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto'
)

# Helper Functions
def get_download_counts():
    """Read file JSON for counting any downloaded."""
    if not os.path.exists(DOWNLOAD_COUNT_FILE):
        return {}
    try:
        with open(DOWNLOAD_COUNT_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def increment_download_count(filename):
    """Counting be ready accumulative total download file."""
    counts = get_download_counts()
    counts[filename] = counts.get(filename, 0) + 1
    try:
        os.makedirs(os.path.dirname(DOWNLOAD_COUNT_FILE), exist_ok=True)
        with open(DOWNLOAD_COUNT_FILE, 'w') as f:
            json.dump(counts, f, indent=4)
    except IOError as e:
        app.logger.error(f"Failed to write download count: {e}")

def get_upload_history():
    if not os.path.exists(UPLOAD_HISTORY_FILE):
        return {}
    try:
        with open(UPLOAD_HISTORY_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def save_upload_history(history):
    try:
        os.makedirs(os.path.dirname(UPLOAD_HISTORY_FILE), exist_ok=True)
        with open(UPLOAD_HISTORY_FILE, 'w') as f:
            json.dump(history, f, indent=4)
    except IOError as e:
        app.logger.error(f"Failed to write upload history: {e}")

def get_current_period_start():
    now = datetime.now()
    return datetime(now.year, now.month, 1)

def get_days_until_reset():
    now = datetime.now()
    if now.month == 12:
        next_month = datetime(now.year + 1, 1, 1)
    else:
        next_month = datetime(now.year, now.month + 1, 1)
    return (next_month - now).days

def format_file_size(bytes):
    """Format size file in data directory storage."""
    if bytes == 0:
        return "0 Bytes"
    k = 1024
    sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    i = int(math.floor(math.log(bytes) / math.log(k)))
    if i >= len(sizes):
        i = len(sizes) - 1
    return f"{round(bytes / math.pow(k, i), 2)} {sizes[i]}"

def get_bucket_stats():
    """Counting a total size file & limit kuota R2."""
    try:
        objects = s3_client.list_objects_v2(Bucket=R2_BUCKET_NAME)
        if 'Contents' not in objects:
            return {
                "total_files": 0, "total_size": 0, "formatted_total_size": "0 Bytes",
                "current_period_size": 0, "formatted_current_period_size": "0 Bytes",
                "remaining_quota": 10 * 1024 * 1024 * 1024, "formatted_remaining": "10 GB",
                "days_until_reset": get_days_until_reset()
            }
        
        current_period_start = get_current_period_start()
        upload_history = get_upload_history()
        
        total_files = len(objects['Contents'])
        total_size = 0
        current_period_size = 0
        
        for obj in objects['Contents']:
            file_size = obj['Size']
            total_size += file_size
            file_key = obj['Key']
            
            if file_key in upload_history:
                try:
                    upload_date = datetime.fromisoformat(upload_history[file_key])
                    if upload_date >= current_period_start:
                        current_period_size += file_size
                except (ValueError, TypeError):
                    current_period_size += file_size
            else:
                try:
                    last_modified = obj['LastModified'].replace(tzinfo=None)
                    if last_modified >= current_period_start:
                        current_period_size += file_size
                except:
                    pass
        
        quota_limit = 10 * 1024 * 1024 * 1024
        remaining_quota = max(0, quota_limit - current_period_size)
        
        return {
            "total_files": total_files, "total_size": total_size, "formatted_total_size": format_file_size(total_size),
            "current_period_size": current_period_size, "formatted_current_period_size": format_file_size(current_period_size),
            "remaining_quota": remaining_quota, "formatted_remaining": format_file_size(remaining_quota),
            "days_until_reset": get_days_until_reset()
        }
    except Exception as e:
        app.logger.error(f"Bucket stats error: {e}")
        return {
            "total_files": 0, "total_size": 0, "formatted_total_size": "0 Bytes",
            "current_period_size": 0, "formatted_current_period_size": "0 Bytes",
            "remaining_quota": 10 * 1024 * 1024 * 1024, "formatted_remaining": "10 GB",
            "days_until_reset": get_days_until_reset()
        }

# R2 Streaming Generator
def stream_r2_file(key):
    """Stream file from R2 with chunk-by-chunk 1MB"""
    try:
        obj = s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=key)
        for chunk in obj['Body'].iter_chunks(chunk_size=1024 * 1024):
            yield chunk
    except Exception as e:
        app.logger.error(f"Stream generator error for {key}: {e}")
        yield b""  # blank if error

# Authentication Routes
@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Authenticate admin with password. Sets HttpOnly JWT cookie."""
    client_ip = get_client_ip()
    
    # Rate limit check
    if not check_rate_limit(client_ip):
        remaining = RATE_LIMIT_WINDOW - (time.time() - min(login_attempts.get(client_ip, [time.time()])))
        app.logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return jsonify({
            "error": "Too many login attempts. Please try again later.",
            "retry_after": int(remaining)
        }), 429
    
    # Record this attempt
    record_attempt(client_ip)
    
    # Parse request
    data = request.get_json(silent=True)
    if not data or 'password' not in data:
        # Generic error - don't reveal what's missing
        app.logger.warning(f"Login attempt with missing credentials from {client_ip}")
        return jsonify({"error": "Invalid credentials"}), 401
    
    password = data.get('password', '')
    
    # Verify password
    if not verify_password(password):
        app.logger.warning(f"Failed login attempt from {client_ip}")
        # Constant-time response to prevent timing attacks
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Generate token
    token = generate_auth_token()
    
    # Build response - NO token in body, only in HttpOnly cookie
    response = make_response(jsonify({"success": True}), 200)
    
    # Determine if we should set Secure flag (only for HTTPS)
    is_secure = PUBLIC_BASE_URL.startswith('https')
    
    # Set HttpOnly cookie - __Host- prefix requires Secure + Path=/
    cookie_name = AUTH_COOKIE_NAME if is_secure else "auth_token"
    response.set_cookie(
        cookie_name,
        value=token,
        httponly=True,
        secure=is_secure,
        samesite='Strict',
        path='/',
        max_age=AUTH_SESSION_HOURS * 3600
    )
    
    app.logger.info(f"Successful login from {client_ip}")
    return response

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """Clear auth cookie."""
    response = make_response(jsonify({"success": True}), 200)
    
    is_secure = PUBLIC_BASE_URL.startswith('https')
    cookie_name = AUTH_COOKIE_NAME if is_secure else "auth_token"
    
    response.delete_cookie(cookie_name, path='/', samesite='Strict')
    
    app.logger.info(f"Logout from {get_client_ip()}")
    return response

@app.route('/api/auth/verify', methods=['GET'])
def auth_verify():
    """Verify current auth session. Used by Nginx auth_request."""
    is_secure = PUBLIC_BASE_URL.startswith('https')
    cookie_name = AUTH_COOKIE_NAME if is_secure else "auth_token"
    
    token = request.cookies.get(cookie_name)
    if not token:
        return '', 401
    
    payload = verify_auth_token(token)
    if not payload:
        return '', 401
    
    return '', 200

# Application Routes
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('../frontend', filename)

# File Upload Handler
@app.route('/api/upload', methods=['POST'])
@require_auth
def upload_file():
    if 'file' not in request.files:
        app.logger.warning("Upload request failed: No file part in request")
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        app.logger.warning("Upload request failed: No selected file")
        return jsonify({"error": "No selected file"}), 400

    try:
        original_filename = file.filename
        key = original_filename
        counter = 1
        while True:
            try:
                s3_client.head_object(Bucket=R2_BUCKET_NAME, Key=key)
                app.logger.info(f"File with key '{key}' already exists. Generating a new name.")
                name, ext = os.path.splitext(original_filename)
                key = f"{name} ({counter}){ext}"
                counter += 1
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    app.logger.info(f"Using unique key for upload: '{key}'")
                    break
                else:
                    raise

        # STREAMING R2 W/ MULTIPART 10MB
        file.stream.seek(0)
        app.logger.info(f"Attempting to upload '{key}' to R2 bucket '{R2_BUCKET_NAME}'")
        s3_client.upload_fileobj(
            file.stream,
            R2_BUCKET_NAME,
            key,
            ExtraArgs={'ContentType': file.content_type or 'application/octet-stream'},
            Config=boto3.s3.transfer.TransferConfig(
                multipart_threshold=1024 * 1024 * 10,  # 10MB threshold
                max_concurrency=10,
                multipart_chunksize=1024 * 1024 * 10, # 10MB chunk size
                use_threads=True
            )
        )
        app.logger.info(f"Successfully uploaded '{key}' to R2.")

        app.logger.info(f"Saving upload history for '{key}'.")
        upload_history = get_upload_history()
        upload_history[key] = datetime.now().isoformat()
        save_upload_history(upload_history)
        app.logger.info(f"Upload history saved successfully.")
        
        local_proxy_url = f"{PUBLIC_BASE_URL}/files/{key}"
        public_r2_url = f"{R2_PUBLIC_URL}/{key}"
        
        app.logger.info(f"Upload process completed successfully for '{key}'.")
        return jsonify({
            "message": "File uploaded successfully!",
            "filename": key,
            "local_url": local_proxy_url,
            "public_url": public_r2_url
        }), 200

    except Exception as e:
        app.logger.error(f"Upload failed for file '{original_filename}': {e}", exc_info=True)
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

# File Listing and Statistics
@app.route('/api/files', methods=['GET'])
@require_auth
def list_files():
    try:
        objects = s3_client.list_objects_v2(Bucket=R2_BUCKET_NAME)
        if 'Contents' not in objects:
            return jsonify({"files": [], "stats": get_bucket_stats()}), 200
        
        download_counts = get_download_counts()
        file_list = []
        for obj in objects['Contents']:
            file_list.append({
                "key": obj['Key'], 
                "last_modified": obj['LastModified'].isoformat(), 
                "size": obj['Size'],
                "local_url": f"{PUBLIC_BASE_URL}/files/{obj['Key']}",
                "public_url": f"{R2_PUBLIC_URL}/{obj['Key']}",
                "download_count": download_counts.get(obj['Key'], 0)
            })
            
        file_list.sort(key=lambda x: x['last_modified'], reverse=True)
        
        return jsonify({"files": file_list, "stats": get_bucket_stats()}), 200

    except Exception as e:
        app.logger.error(f"List files error: {e}")
        return jsonify({"error": f"Failed to fetch file list: {str(e)}"}), 500

# File Download Handler
@app.route('/api/serve-file/<path:filename>', methods=['GET'])
@require_auth
def serve_file(filename):
    try:
        app.logger.info(f"Received download request for file: {filename}")
        app.logger.info(f"Encoded filename: {filename}")
        
        head = s3_client.head_object(Bucket=R2_BUCKET_NAME, Key=filename)
        content_type = head.get('ContentType', 'application/octet-stream')
        content_length = head['ContentLength']
        app.logger.info(f"File metadata: {content_type}, size: {content_length}")

        # Increment count
        increment_download_count(filename)
        app.logger.info(f"Successfully incremented count for file: {filename}")

        return Response(
            stream_r2_file(filename),
            headers={
                'Content-Type': content_type,
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Length': str(content_length),
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            status=200
        )
    except ClientError as e:
        error_code = e.response['Error']['Code']
        app.logger.error(f"ClientError for {filename}: {error_code} - {e}")
        if error_code == 'NoSuchKey':
            return jsonify({"error": "File not found in R2. Check key: " + filename}), 404
        return jsonify({"error": "R2 access failed: " + str(e)}), 500
    except Exception as e:
        app.logger.error(f"Download error for {filename}: {e}", exc_info=True)
        return jsonify({"error": "Internal server error: " + str(e)}), 500

# Health Check
@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    os.makedirs('data', exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=False)
