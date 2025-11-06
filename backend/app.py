import os
import uuid
import json
import math
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, send_file, redirect
from dotenv import load_dotenv
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from io import BytesIO

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

load_dotenv()

app = Flask(__name__, static_folder=None)

# === CONFIG CLOUDFLARE R2 ===
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost").rstrip('/')

DOWNLOAD_COUNT_FILE = 'data/download_counts.json'
UPLOAD_HISTORY_FILE = 'data/upload_history.json'

# === S3-R2 COMPATIBLE CLIENT ===
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto'
)

# === HELPER FUNCTIONS ===
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

def stream_r2_file(key):
    """Stream file from R2 within chunk-by-chunk (1MB)"""
    try:
        obj = s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=key)
        for chunk in obj['Body'].iter_chunks(chunk_size=1024 * 1024):
            yield chunk
    except Exception as e:
        app.logger.error(f"Stream generator error for {key}: {e}")
        yield b""

# === ROUTES ===
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('../frontend', filename)

# === UPLOAD FILE - STREAMING - HISTORY ===
@app.route('/api/upload', methods=['POST'])
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

# === LIST FILES: DOWNLOAD COUNT & STATS ===
@app.route('/api/files', methods=['GET'])
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

# === DOWNLOAD FILE & INCREMENT COUNT ===
@app.route('/api/serve-file/<path:filename>', methods=['GET'])
def serve_file(filename):
    try:
        app.logger.info(f"[DOWNLOAD] Request: {filename}")

        # Cek file ada + ambil metadata
        head = s3_client.head_object(Bucket=R2_BUCKET_NAME, Key=filename)
        content_type = head.get('ContentType', 'application/octet-stream')
        content_length = head['ContentLength']

        # Increment count
        increment_download_count(filename)
        app.logger.info(f"[DOWNLOAD] Count incremented for: {filename}")

        # Stream langsung dari R2 (tidak pakai BytesIO)
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
        app.logger.error(f"[404] ClientError for {filename}: {error_code}")
        if error_code in ['404', 'NoSuchKey']:
            return jsonify({"error": "File not found"}), 404
        return jsonify({"error": "R2 access error"}), 500
    except Exception as e:
        app.logger.error(f"[500] Download failed: {e}", exc_info=True)
        return jsonify({"error": "Server error"}), 500

# === HEALTH CHECK ===
@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    os.makedirs('data', exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=False)
