

Tentu, saya paham sepenuhnya. Anda ingin satu `index.html` yang menggabungkan desain Anda dengan sentuhan kreatif saya, dilengkapi dengan fitur pencarian, tampilan grid yang informatif, dan pelacakan jumlah unduhan. Saya akan memberikan kode lengkap dan utuh untuk setiap file.

Mari kita bangun versi final yang lebih powerful ini.

---

### **Struktur Folder Proyek Akhir**

Struktur ini sedikit berubah untuk menampung data jumlah unduhan.

```
cloudflare-r2-final-uploader/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py
│   └── data/             # Folder baru untuk menyimpan data
│       └── .gitkeep      # Agar folder ikut di-commit
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── index.html        # Satu-satunya file HTML
    ├── style.css         # Gabungan style terbaik
    └── script.js         # Logika JavaScript yang diperbarui
```

---

### **1. File Backend (Dengan Pelacakan Unduhan)**

**`backend/app.py`**
```python
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
```

**`backend/requirements.txt`** (Tidak berubah)
```txt
Flask
boto3
python-dotenv
```

**`backend/Dockerfile`** (Tidak berubah)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
```

---

### **2. File Frontend (Satu File HTML Gabungan)**

**`frontend/index.html`**
```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Greyscope&Co Storage - Your Private Cloud</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <div class="hero-section">
            <h1 class="hero-title">Give Every File the Superpowers</h1>
            <p class="hero-subtitle">Personalize your private storage. Making it easy to share. Upload and manage your files securely.</p>
        </div>
        
        <div class="card upload-card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-cloud-upload-alt me-2"></i>UPLOAD YOUR FILE</h3>
            </div>
            <div class="card-body">
                <form id="uploadForm" class="needs-validation" novalidate>
                    <div class="mb-3">
                        <input type="file" class="form-control" id="fileInput" required>
                    </div>
                    <button type="submit" class="btn btn-generate" id="uploadButton">
                        <i class="fas fa-cloud-upload-alt me-2"></i>Upload File
                    </button>
                </form>
                
                <div class="stats">
                    <i class="fas fa-folder-open"></i>
                    <span id="fileCount">0 Files Stored</span>
                </div>
            </div>
        </div>

        <div class="card list-card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h3 class="card-title mb-0"><i class="fas fa-list me-2"></i>YOUR FILES</h3>
                <div class="search-wrapper">
                    <i class="fas fa-search"></i>
                    <input type="search" class="form-control" id="searchInput" placeholder="Search files...">
                </div>
            </div>
            <div class="card-body">
                <div id="fileListContainer">
                    <p id="loadingMessage" class="text-center">Loading files...</p>
                    <div id="fileList" class="file-grid"></div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            &copy; <span id="currentYear"></span> Greyscope&Co. All rights reserved.
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="script.js"></script>
</body>
</html>
```

**`frontend/style.css`**
```css
:root {
    --primary: #9bd928;
    --primary-hover: #f3169e;
    --secondary: #0a0a0a;
    --secondary-hover: #4b5563;
    --dark-bg: #000000;
    --card-bg: #505050;
    --text-light: #f1f5f9;
    --text-muted: #a0aec0;
    --success: #f3169e;
    --success-hover: #f3169e;
    --border-color: #2d3748;
}

body {
    background-color: var(--dark-bg);
    color: var(--text-light);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding-top: 30px;
    padding-bottom: 60px;
    background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(80, 80, 80, 0.8) 100%);
    background-size: cover;
    background-attachment: fixed;
}

.container { max-width: 1200px; } /* Diperlebar untuk grid */

.hero-section { text-align: center; margin-bottom: 50px; }
.hero-title {
    font-size: 3rem; font-weight: 800; line-height: 1.1; margin-bottom: 20px;
    background: linear-gradient(to right, #9bd928, #f3169e, #9bd928);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.hero-subtitle {
    font-size: 1.25rem; color: var(--text-muted); max-width: 600px;
    margin: 0 auto 40px; line-height: 1.6;
}

.card {
    background-color: var(--card-bg); border: none; border-radius: 16px;
    overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
    transition: transform 0.3s ease; margin-bottom: 2rem;
}
.card:hover { transform: translateY(-5px); }
.card-header {
    background-color: rgba(173, 173, 173, 0.7); border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 20px 24px; text-align: center;
}
.card-title { font-weight: 700; font-size: 1.25rem; margin: 0; color: #000; text-transform: uppercase; letter-spacing: 1.5px; }
.card-body { padding: 24px; }

.form-control {
    background-color: rgba(255, 255, 255, 0.1); color: var(--text-light);
    border: 1px solid rgba(155, 217, 40, 0.3); padding: 12px 16px; border-radius: 8px;
    transition: all 0.3s;
}
.form-control:focus {
    background-color: rgba(255, 255, 255, 0.2); color: #fff; border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(155, 217, 40, 0.3); outline: none;
}

.btn-generate {
    background-color: var(--primary); border: none; padding: 12px 24px; font-weight: 600;
    width: 100%; transition: all 0.3s; color: #000;
}
.btn-generate:hover { background-color: var(--primary-hover); transform: translateY(-2px); color: #fff; }

.stats {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    font-weight: 600; color: var(--text-muted); margin-top: 24px; padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.stats i { color: var(--success); animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }

/* --- Search Bar --- */
.search-wrapper {
    position: relative;
    width: 250px;
}
.search-wrapper i {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
}
.search-wrapper .form-control {
    padding-left: 40px;
    background-color: rgba(255,255,255,0.05);
}

/* --- File Grid --- */
.file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
}

.file-card {
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    animation: fadeIn 0.5s ease;
}
.file-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    border-color: var(--primary);
}

.file-card-header {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
}
.file-card-header i {
    font-size: 2rem;
    color: var(--primary);
    margin-right: 1rem;
}
.file-card-title {
    font-weight: 600;
    color: var(--text-light);
    word-break: break-all;
    margin: 0;
    line-height: 1.4;
}

.file-card-body {
    flex-grow: 1;
    color: var(--text-muted);
    font-size: 0.9rem;
}
.file-card-body .meta-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
}

.file-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}
.download-count {
    font-size: 0.85rem;
    color: var(--text-muted);
}
.download-count i {
    color: var(--success);
}

.btn-download, .btn-copy {
    background-color: var(--success); border: none; padding: 8px 12px; color: #fff;
    border-radius: 6px; transition: all 0.3s; cursor: pointer; font-size: 0.9rem;
}
.btn-download:hover, .btn-copy:hover { background-color: var(--primary-hover); transform: translateY(-2px); }

.footer { text-align: center; margin-top: 60px; color: var(--text-muted); font-size: 0.9rem; }

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
```

**`frontend/script.js`**
```javascript
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const fileList = document.getElementById('fileList');
    const loadingMessage = document.getElementById('loadingMessage');
    const fileCount = document.getElementById('fileCount');
    const searchInput = document.getElementById('searchInput');

    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // --- Fungsi Utilitas ---
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    };
    
    const getFileIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf', 'doc': 'fa-file-word', 'docx': 'fa-file-word',
            'xls': 'fa-file-excel', 'xlsx': 'fa-file-excel', 'ppt': 'fa-file-powerpoint',
            'pptx': 'fa-file-powerpoint', 'jpg': 'fa-file-image', 'jpeg': 'fa-file-image',
            'png': 'fa-file-image', 'gif': 'fa-file-image', 'mp4': 'fa-file-video',
            'mp3': 'fa-file-audio', 'zip': 'fa-file-zipper', 'rar': 'fa-file-zipper'
        };
        return iconMap[ext] || 'fa-file';
    };

    // --- Event Listener untuk Form Unggah ---
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!uploadForm.checkValidity()) {
            uploadForm.classList.add('was-validated');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        uploadButton.disabled = true;
        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();

            if (response.ok) {
                uploadForm.reset();
                uploadForm.classList.remove('was-validated');
                fetchAndDisplayFiles();
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        } finally {
            uploadButton.disabled = false;
            uploadButton.innerHTML = '<i class="fas fa-cloud-upload-alt me-2"></i>Upload File';
        }
    });

    // --- Fungsi untuk Menyalin Link ---
    window.copyToClipboard = (text, buttonElement) => {
        navigator.clipboard.writeText(text).then(() => {
            const originalHtml = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => { buttonElement.innerHTML = originalHtml; }, 2000);
        }).catch(err => console.error('Failed to copy: ', err));
    };

    // --- Fungsi Pencarian ---
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const fileCards = document.querySelectorAll('.file-card');
        
        fileCards.forEach(card => {
            const fileName = card.querySelector('.file-card-title').textContent.toLowerCase();
            if (fileName.includes(searchTerm)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });

    // --- Fungsi untuk Mengambil dan Menampilkan File ---
    const fetchAndDisplayFiles = async () => {
        try {
            const response = await fetch('/api/files');
            const result = await response.json();
            fileList.innerHTML = '';
            if (result.files.length === 0) {
                fileList.innerHTML = '<p class="text-center text-muted">No files uploaded yet.</p>';
            } else {
                result.files.forEach(file => {
                    const fileCard = document.createElement('div');
                    fileCard.className = 'file-card';
                    fileCard.innerHTML = `
                        <div class="file-card-header">
                            <i class="fas ${getFileIcon(file.key)}"></i>
                            <h5 class="file-card-title">${file.key}</h5>
                        </div>
                        <div class="file-card-body">
                            <div class="meta-item">
                                <span>Size:</span>
                                <span>${formatFileSize(file.size)}</span>
                            </div>
                            <div class="meta-item">
                                <span>Modified:</span>
                                <span>${formatDate(file.last_modified)}</span>
                            </div>
                        </div>
                        <div class="file-card-footer">
                            <span class="download-count"><i class="fas fa-download"></i> ${file.download_count} times</span>
                            <div>
                                <a href="${file.local_url}" target="_blank" class="btn btn-download btn-sm"><i class="fas fa-external-link-alt"></i></a>
                                <button class="btn btn-copy btn-sm" onclick="copyToClipboard('${file.public_url}', this)"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>
                    `;
                    fileList.appendChild(fileCard);
                });
            }
            fileCount.textContent = `${result.files.length} Files Stored`;
        } catch (error) {
            loadingMessage.textContent = `Error: ${error.message}`;
            loadingMessage.style.color = 'var(--error-color)';
        }
    };

    fetchAndDisplayFiles();
});
```

---

### **3. File Konfigurasi Docker**

**`.env.example`**
```env
# Salin file ini ke .env dan isi dengan kredensial Anda

# --- Cloudflare R2 Credentials (WAJIB) ---
R2_ACCOUNT_ID=YOUR_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
R2_BUCKET_NAME=greyscope-flex-storage
R2_PUBLIC_URL=https://greyscope-flex-storage.ACCOUNT_ID.r2.cloudflarestorage.com

# --- Pengaturan URL Aplikasi (PILIH SALAH SATU) ---
# Opsi A: Untuk menjalankan secara lokal
# PUBLIC_BASE_URL=http://localhost

# Opsi B: Untuk menggunakan domain kustom
PUBLIC_BASE_URL=https://storage.greyscope.xyz
```

**`docker-compose.yml`** (Diperbarui dengan volume untuk data)
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    container_name: r2_uploader_backend
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      # Mount folder 'data' untuk menyimpan download_counts.json
      - ./backend/data:/app/data
    networks:
      - app-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: r2_uploader_frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

**`frontend/Dockerfile`** & **`frontend/nginx.conf`** (Tidak berubah)

---

### **4. Menjalankan Aplikasi**

1.  **Siapkan Folder dan File:**
    *   Buat folder `cloudflare-r2-final-uploader`.
    *   Buat subfolder `backend` dan `frontend`.
    *   Di dalam `backend`, buat folder `data` dan tambahkan file kosong bernama `.gitkeep` di dalamnya.
    *   Salin dan tempel semua kode di atas ke file yang sesuai.
    *   `cp .env.example .env` dan isi file `.env` Anda.

2.  **Build dan Jalankan:**
    ```bash
    docker-compose up --build -d
    ```

3.  **Akses:** Buka `http://localhost` atau domain Anda.

---

### **5. Jawaban Pertanyaan Tentang Nginx**

> "Lalu apakah perlu pengaturan lainnya di file /var/www/ mengatifkan nginx dan cek nginx -t dan aktifkam symlink jika menggunakan domain?"

**Jawaban singkat: Tidak, untuk proyek ini Anda tidak perlu melakukan itu.**

**Penjelasan lengkap:**

Perintah seperti `nginx -t` (menguji konfigurasi Nginx) dan membuat symlink di `/etc/nginx/sites-enabled/` adalah langkah-langkah standar untuk **menginstal dan mengelola Nginx secara manual di server** (misalnya, langsung di Ubuntu atau CentOS tanpa Docker).

Dalam proyek kita, kita menggunakan **Docker dan Docker Compose**. Ini adalah pendekatan yang berbeda dan lebih modern:

1.  **Nginx di dalam Kontainer:** Nginx tidak berjalan langsung di server utama Anda. Ia berjalan di dalam sebuah kontainer Docker yang terisolasi.
2.  **Konfigurasi Terkelola:** File konfigurasi Nginx kita adalah `frontend/nginx.conf`. Saat Anda menjalankan `docker-compose up`, Docker Compose akan menyalin file ini ke dalam kontainer Nginx dan memulai layanan Nginx di dalamnya menggunakan konfigurasi tersebut.
3.  **Tidak Ada Interferensi Sistem:** Karena Nginx berada di dalam kontainer, ia tidak akan bentrok dengan Nginx yang mungkin sudah terinstal di server Anda (jika ada). Semua konfigurasi, log, dan prosesnya terbungkus rapi di dalam Docker.

**Jadi, untuk proyek ini:**
*   **Anda tidak perlu mengedit file di `/etc/nginx/` atau `/var/www/`.**
*   **Anda tidak perlu menjalankan `nginx -t` atau membuat symlink.**
*   **Satu-satunya konfigurasi Nginx yang perlu Anda edit adalah `frontend/nginx.conf` di folder proyek Anda.**

Jika Anda menggunakan domain, satu-satunya pengaturan di luar Docker yang Anda lakukan adalah **mengarahkan DNS domain Anda (misalnya `storage.greyscope.xyz`) ke alamat IP server tempat Docker berjalan.** Docker Compose akan menangani sisanya.