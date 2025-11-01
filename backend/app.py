import os
import uuid
import json
import math
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, send_file
from dotenv import load_dotenv
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from io import BytesIO

load_dotenv()

app = Flask(__name__, static_folder=None)

# - Config Cloudflare R2 -
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost").rstrip('/')

DOWNLOAD_COUNT_FILE = 'data/download_counts.json'
UPLOAD_HISTORY_FILE = 'data/upload_history.json'

# - Storage Compatible w/ S3 client -
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto'
)

# - Funct helps tracking -
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
        with open(DOWNLOAD_COUNT_FILE, 'w') as f:
            json.dump(counts, f, indent=4)
    except IOError:
        app.logger.error(f"Could not write to download count file: {DOWNLOAD_COUNT_FILE}")

def get_upload_history():
    """Get upload history to track files by period."""
    if not os.path.exists(UPLOAD_HISTORY_FILE):
        return {}
    try:
        with open(UPLOAD_HISTORY_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def save_upload_history(history):
    """Save upload history to file."""
    try:
        with open(UPLOAD_HISTORY_FILE, 'w') as f:
            json.dump(history, f, indent=4)
    except IOError:
        app.logger.error(f"Could not write to upload history file: {UPLOAD_HISTORY_FILE}")

def get_current_period_start():
    """Get the start date of current period (first day/current month)."""
    now = datetime.now()
    return datetime(now.year, now.month, 1)

def get_days_until_reset():
    """Calculate days until the end of the current period."""
    now = datetime.now()
    # Get first day of next month
    if now.month == 12:
        next_month = datetime(now.year + 1, 1, 1)
    else:
        next_month = datetime(now.year, now.month + 1, 1)
    
    # Calculate days remaining
    days_remaining = (next_month - now).days
    return days_remaining

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
    """Calculate bucket statistics with reset functionality."""
    try:
        objects = s3_client.list_objects_v2(Bucket=R2_BUCKET_NAME)
        if 'Contents' not in objects:
            return {
                "total_files": 0,
                "total_size": 0,
                "formatted_total_size": "0 Bytes",
                "current_period_size": 0,
                "formatted_current_period_size": "0 Bytes",
                "remaining_quota": 10 * 1024 * 1024 * 1024,  # 10GB in bytes
                "formatted_remaining": "10 GB",
                "days_until_reset": get_days_until_reset()
            }
        
        # Get current period start date
        current_period_start = get_current_period_start()
        
        upload_history = get_upload_history()
        
        total_files = len(objects['Contents'])
        total_size = 0
        current_period_size = 0
        
        for obj in objects['Contents']:
            file_size = obj['Size']
            total_size += file_size
            
            # Check if file was uploaded in current period
            file_key = obj['Key']
            if file_key in upload_history:
                try:
                    upload_date = datetime.fromisoformat(upload_history[file_key])
                    if upload_date >= current_period_start:
                        current_period_size += file_size
                except (ValueError, TypeError):
                    # If date parsing fails, assume it's in current period
                    current_period_size += file_size
            else:
                # If file not in history, check last modified date
                try:
                    last_modified = obj['LastModified']
                    if last_modified >= current_period_start:
                        current_period_size += file_size
                except (ValueError, TypeError):
                    pass
        
        formatted_total_size = format_file_size(total_size)
        formatted_current_period_size = format_file_size(current_period_size)
        
        # Cloudflare R2 free tier 10GB/month
        quota_limit = 10 * 1024 * 1024 * 1024
        remaining_quota = max(0, quota_limit - current_period_size)
        formatted_remaining = format_file_size(remaining_quota)
        
        return {
            "total_files": total_files,
            "total_size": total_size,
            "formatted_total_size": formatted_total_size,
            "current_period_size": current_period_size,
            "formatted_current_period_size": formatted_current_period_size,
            "remaining_quota": remaining_quota,
            "formatted_remaining": formatted_remaining,
            "days_until_reset": get_days_until_reset()
        }
    except Exception as e:
        app.logger.error(f"Error calculating bucket stats: {str(e)}")
        # Fallback value default if error
        return {
            "total_files": 0,
            "total_size": 0,
            "formatted_total_size": "0 Bytes",
            "current_period_size": 0,
            "formatted_current_period_size": "0 Bytes",
            "remaining_quota": 10 * 1024 * 1024 * 1024,
            "formatted_remaining": "10 GB",
            "days_until_reset": get_days_until_reset()
        }

# - MAIN ROUTERS -
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('../frontend', filename)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        try:
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            
            s3_client.upload_fileobj(
                file,
                R2_BUCKET_NAME,
                unique_filename,
                ExtraArgs={'ContentType': file.content_type}
            )
            
            # Save upload date to history
            upload_history = get_upload_history()
            upload_history[unique_filename] = datetime.now().isoformat()
            save_upload_history(upload_history)
            
            local_proxy_url = f"{PUBLIC_BASE_URL}/files/{unique_filename}"
            public_r2_url = f"{R2_PUBLIC_URL}/{unique_filename}"
            
            return jsonify({
                "message": "File uploaded successfully!",
                "filename": unique_filename,
                "local_url": local_proxy_url,
                "public_url": public_r2_url
            }), 200

        except Exception as e:
            return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

# - ROUTE API FILE -
@app.route('/api/files', methods=['GET'])
def list_files():
    try:
        objects = s3_client.list_objects_v2(Bucket=R2_BUCKET_NAME)
        if 'Contents' not in objects:
            return jsonify({
                "files": [],
                "stats": get_bucket_stats()
            })
        
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
        
        # restructure JSON enhanced w/ frontend
        return jsonify({
            "files": file_list,
            "stats": get_bucket_stats()
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch file list: {str(e)}"}), 500

@app.route('/files/<filename>')
def serve_file(filename):
    try:
        increment_download_count(filename)
        
        file_obj = s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=filename)
        file_stream = BytesIO(file_obj['Body'].read())
        return send_file(file_stream, download_name=filename, as_attachment=False)
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            return jsonify({"error": "File not found"}), 404
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health_check():
    """Endpoint for healthy checking"""
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    if not os.path.exists('data'):
        os.makedirs('data')
    app.run(host='0.0.0.0', port=5000, debug=True)
