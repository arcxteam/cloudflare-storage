import os
import uuid
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, send_file
from dotenv import load_dotenv
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from io import BytesIO

load_dotenv()

app = Flask(__name__, static_folder=None)

# --- Konfigurasi Cloudflare R2 ---
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost").rstrip('/')

# --- Konfigurasi Pelacakan Unduhan ---
DOWNLOAD_COUNT_FILE = 'data/download_counts.json'

# Inisialisasi S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto'
)

# --- Fungsi Bantuan untuk Pelacakan ---
def get_download_counts():
    """Membaca file JSON untuk mendapatkan jumlah unduhan."""
    if not os.path.exists(DOWNLOAD_COUNT_FILE):
        return {}
    try:
        with open(DOWNLOAD_COUNT_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def increment_download_count(filename):
    """Menaikkan jumlah unduhan untuk file tertentu dan menyimpannya."""
    counts = get_download_counts()
    counts[filename] = counts.get(filename, 0) + 1
    try:
        with open(DOWNLOAD_COUNT_FILE, 'w') as f:
            json.dump(counts, f, indent=4)
    except IOError:
        app.logger.error(f"Could not write to download count file: {DOWNLOAD_COUNT_FILE}")

# --- Routes ---
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

@app.route('/api/files', methods=['GET'])
def list_files():
    try:
        objects = s3_client.list_objects_v2(Bucket=R2_BUCKET_NAME)
        if 'Contents' not in objects:
            return jsonify({"files": []})
        
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
            
        # Urutkan dari yang terbaru
        file_list.sort(key=lambda x: x['last_modified'], reverse=True)
        
        return jsonify({"files": file_list}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch file list: {str(e)}"}), 500

@app.route('/files/<filename>')
def serve_file(filename):
    try:
        # Tambahkan log untuk menaikkan counter
        increment_download_count(filename)
        
        file_obj = s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=filename)
        file_stream = BytesIO(file_obj['Body'].read())
        return send_file(file_stream, download_name=filename, as_attachment=False)
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            return jsonify({"error": "File not found"}), 404
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Pastikan folder data ada
    if not os.path.exists('data'):
        os.makedirs('data')
    app.run(host='0.0.0.0', port=5000, debug=True)