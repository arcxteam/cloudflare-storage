

Tentu, saya mengerti sepenuhnya. Anda membutuhkan sebuah sistem yang **fleksibel**: dapat dijalankan oleh siapa saja secara lokal, tetapi juga dapat dikonfigurasi untuk menggunakan domain khusus milik Anda. Saya juga akan membuat dua versi tampilan frontend untuk Anda.

Mari kita bangun solusi yang lebih canggih dan modular ini.

---

### **Konsep Inti: Konfigurasi Berbasis Lingkungan**

Kunci dari fleksibilitas ini adalah menggunakan variabel lingkungan (`.env` file) untuk mengontrol bagaimana aplikasi berperilaku dan menghasilkan URL.

*   **Untuk Pengguna Lokal:** Mereka hanya perlu mengatur `PUBLIC_BASE_URL` ke `http://localhost` atau `http://IP_SERVER`.
*   **Untuk Anda (Pemilik Domain):** Anda akan mengatur `PUBLIC_BASE_URL` ke `https://storage.greyscope.xyz` dan melakukan konfigurasi DNS sederhana.

Aplikasi akan secara otomatis menyesuaikan tautan unduhan dan tautan publik berdasarkan pengaturan ini.

---

### **1. Cara Setting di Cloudflare R2 (Universal untuk Semua Pengguna)**

Langkah ini sama untuk semua orang, baik yang menjalankan lokal maupun dengan domain.

1.  **Buat Bucket:** Buat bucket baru di dashboard R2, misalnya `greyscope-flex-storage`.
2.  **Dapatkan API Token:** Buat API token dengan permission **"Object Read and Write"** untuk bucket tersebut. Simpan `Access Key ID` dan `Secret Access Key`.
3.  **Aktifkan Akses Publik:** Di bucket settings, aktifkan **"Allow public access"**.
4.  **Salin URL Publik Default:** Salin URL publik default yang diberikan oleh Cloudflare (format: `https://[nama-bucket].[account-id].r2.cloudflarestorage.com`). URL ini akan kita simpan di `.env` sebagai referensi.

---

### **2, 3, 4 & 5: Struktur Proyek, Kode, dan Docker (Versi Fleksibel)**

Struktur folder akan sedikit berbeda untuk mengakomodasi dua frontend.

```
cloudflare-r2-flexible-uploader/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── script.js         # Logika JS yang digunakan bersama
    ├── style.css         # Gaya untuk Versi Kreatif Saya
    ├── index_v1.html     # Versi 1: Desain Kreatif Saya
    ├── style_v2.css      # Gaya untuk Versi Hybrid Anda
    └── index_v2.html     # Versi 2: Desain Hybrid Anda
```

#### **Langkah 1: File Backend yang Cerdas**

**`backend/app.py`** (Diperbarui untuk membaca `PUBLIC_BASE_URL`)
```python
import os
import uuid
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
# URL publik langsung dari R2, digunakan sebagai cadangan atau referensi
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL") 
# URL utama yang akan digunakan aplikasi, bisa localhost atau domain kustom
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost").rstrip('/')

s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto'
)

# --- Routes ---

@app.route('/')
def index():
    # Nginx akan menangani ini, tapi ini cadangan jika dijalankan langsung
    return send_from_directory('../frontend', 'index_v1.html')

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
            
            # Gunakan PUBLIC_BASE_URL untuk membuat link yang konsisten
            local_proxy_url = f"{PUBLIC_BASE_URL}/files/{unique_filename}"
            public_r2_url = f"{R2_PUBLIC_URL}/{unique_filename}"
            
            return jsonify({
                "message": "File uploaded successfully!",
                "filename": unique_filename,
                "local_url": local_proxy_url,      # URL untuk diakses via aplikasi
                "public_url": public_r2_url        # URL publik langsung dari R2
            }), 200

        except Exception as e:
            return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/api/files', methods=['GET'])
def list_files():
    try:
        objects = s3_client.list_objects_v2(Bucket=R2_BUCKET_NAME)
        if 'Contents' not in objects:
            return jsonify({"files": []})
        
        file_list = []
        for obj in objects['Contents']:
            file_list.append({
                "key": obj['Key'],
                "last_modified": obj['LastModified'].isoformat(),
                "size": obj['Size'],
                "local_url": f"{PUBLIC_BASE_URL}/files/{obj['Key']}",
                "public_url": f"{R2_PUBLIC_URL}/{obj['Key']}"
            })
            
        return jsonify({"files": file_list}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch file list: {str(e)}"}), 500

# Route untuk menyajikan file melalui proxy lokal/domain
@app.route('/files/<filename>')
def serve_file(filename):
    try:
        file_obj = s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=filename)
        file_stream = BytesIO(file_obj['Body'].read())
        return send_file(file_stream, download_name=filename, as_attachment=False)
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            return jsonify({"error": "File not found"}), 404
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

**`backend/requirements.txt`** & **`backend/Dockerfile`** (Tidak berubah)

#### **Langkah 2: Frontend dengan Dua Versi**

**`frontend/script.js`** (Logika bersama, bekerja untuk kedua versi HTML)
```javascript
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const fileList = document.getElementById('fileList');
    const loadingMessage = document.getElementById('loadingMessage');
    const fileCount = document.getElementById('fileCount');

    // Fungsi utilitas
    const formatFileSize = (bytes) => { /* ... sama seperti sebelumnya ... */ };
    const formatDate = (dateString) => { /* ... sama seperti sebelumnya ... */ };

    // Event listener untuk form unggah
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        uploadButton.disabled = true;
        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();

            if (response.ok) {
                uploadForm.reset();
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

    // Fungsi untuk menyalin link
    window.copyToClipboard = (text, buttonElement) => {
        navigator.clipboard.writeText(text).then(() => {
            const originalHtml = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => { buttonElement.innerHTML = originalHtml; }, 2000);
        });
    };

    // Fungsi untuk mengambil dan menampilkan file
    const fetchAndDisplayFiles = async () => {
        try {
            const response = await fetch('/api/files');
            const result = await response.json();
            fileList.innerHTML = '';
            if (result.files.length === 0) {
                fileList.innerHTML = '<p class="text-center text-muted">No files uploaded yet.</p>';
            } else {
                result.files.forEach(file => {
                    const fileItem = document.createElement('div');
                    // Class 'file-item' akan digunakan oleh kedua CSS
                    fileItem.className = 'file-item'; 
                    fileItem.innerHTML = `
                        <div class="file-item-info">
                            <div class="file-item-name">${file.key}</div>
                            <div class="file-item-meta">${formatFileSize(file.size)} - ${formatDate(file.last_modified)}</div>
                        </div>
                        <div class="file-item-actions">
                            <a href="${file.local_url}" target="_blank" class="btn btn-sm btn-download"><i class="fas fa-external-link-alt"></i> Open</a>
                            <button class="btn btn-sm btn-copy" onclick="copyToClipboard('${file.public_url}', this)"><i class="fas fa-copy"></i> Copy Link</button>
                        </div>
                    `;
                    fileList.appendChild(fileItem);
                });
            }
            fileCount.textContent = `${result.files.length} Files Stored`;
        } catch (error) {
            loadingMessage.textContent = `Error: ${error.message}`;
        }
    };

    fetchAndDisplayFiles();
});
```

---

#### **Versi 1: Desain Kreatif Saya (`index_v1.html` & `style.css`)**

**`frontend/index_v1.html`**
```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Greyscope Storage</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container-fluid vh-100 d-flex flex-column">
        <header class="text-white p-4 text-center">
            <h1 class="display-4">Greyscope Storage</h1>
            <p class="lead">Private & Flexible File Storage</p>
        </header>
        <main class="flex-grow-1 d-flex align-items-center justify-content-center">
            <div class="row w-100 g-4">
                <div class="col-lg-5">
                    <div class="card shadow-lg h-100">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title"><i class="fas fa-cloud-upload-alt me-2"></i>Upload File</h5>
                            <form id="uploadForm" class="flex-grow-1 d-flex flex-column">
                                <div class="mb-3">
                                    <input type="file" class="form-control" id="fileInput" required>
                                </div>
                                <button type="submit" class="btn btn-primary mt-auto" id="uploadButton">
                                    <i class="fas fa-cloud-upload-alt me-2"></i>Upload
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="col-lg-7">
                    <div class="card shadow-lg h-100">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title"><i class="fas fa-folder-open me-2"></i>Your Files</h5>
                            <div id="fileListContainer" class="flex-grow-1 overflow-auto">
                                <p id="loadingMessage" class="text-center">Loading...</p>
                                <div id="fileList"></div>
                            </div>
                            <div class="mt-3 text-center">
                                <span id="fileCount" class="badge bg-secondary">0 Files Stored</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

**`frontend/style.css`**
```css
body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.card { border: none; border-radius: 15px; }
.file-item {
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
.file-item:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
.file-item-name { font-weight: 600; color: #495057; word-break: break-all; }
.file-item-meta { font-size: 0.85rem; color: #6c757d; }
.btn-download { background-color: #28a745; color: white; }
.btn-copy { background-color: #17a2b8; color: white; }
```

---

#### **Versi 2: Desain Hybrid Anda (`index_v2.html` & `style_v2.css`)**

**`frontend/index_v2.html`** (Mengadaptasi desain Anda)
```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Greyscope&Co Storage - Your Private Cloud</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style_v2.css">
</head>
<body>
    <div class="container">
        <div class="hero-section">
            <h1 class="hero-title">Give Every File the Superpowers</h1>
            <p class="hero-subtitle">Personalize your private storage. Making it easy to share. Upload and manage your files securely.</p>
        </div>
        
        <div class="card">
            <div class="card-header"><h3 class="card-title">UPLOAD YOUR FILE</h3></div>
            <div class="card-body">
                <form id="uploadForm" class="needs-validation" novalidate>
                    <div class="mb-3"><input type="file" class="form-control" id="fileInput" required></div>
                    <button type="submit" class="btn btn-generate" id="uploadButton"><i class="fas fa-cloud-upload-alt me-2"></i>Upload File</button>
                </form>
                <div class="stats"><i class="fas fa-folder-open"></i><span id="fileCount">0 Files Stored</span></div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><h3 class="card-title">YOUR FILES</h3></div>
            <div class="card-body">
                <div id="fileListContainer">
                    <p id="loadingMessage" class="text-center">Loading files...</p>
                    <div id="fileList"></div>
                </div>
            </div>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

**`frontend/style_v2.css`** (CSS Anda, dengan sedikit penyesuaian untuk `.file-item`)
```css
/* ... Sisipkan seluruh CSS yang Anda berikan di sini ... */
:root { --primary: #9bd928; --primary-hover: #f3169e; /* ... dst */ }
body { /* ... */ }
/* ... dan seterusnya hingga footer ... */

/* Tambahkan style ini untuk daftar file agar cocok dengan desain Anda */
#fileList .file-item {
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(155, 217, 40, 0.3);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    animation: fadeIn 0.5s ease;
}
.file-item-info { flex-grow: 1; }
.file-item-name { font-weight: 600; color: var(--primary); word-break: break-all; }
.file-item-meta { font-size: 0.85rem; color: var(--text-muted); }
.file-item-actions { display: flex; gap: 10px; }
.btn-download, .btn-copy {
    background-color: var(--success); border: none; padding: 8px 12px; color: #fff;
    border-radius: 6px; transition: all 0.3s; cursor: pointer;
}
.btn-download:hover, .btn-copy:hover { background-color: var(--primary-hover); transform: translateY(-2px); }
```

#### **Langkah 3: Konfigurasi Docker & Nginx**

**`.env.example`** (Penting untuk fleksibilitas)
```env
# Salin file ini ke .env dan isi dengan kredensial Anda

# --- Cloudflare R2 Credentials (WAJIB) ---
R2_ACCOUNT_ID=YOUR_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
R2_BUCKET_NAME=greyscope-flex-storage
R2_PUBLIC_URL=https://greyscope-flex-storage.ACCOUNT_ID.r2.cloudflarestorage.com

# --- Pengaturan URL Aplikasi (PILIH SALAH SATU) ---

# Opsi A: Untuk menjalankan secara lokal (untuk orang lain)
# PUBLIC_BASE_URL=http://localhost
# PUBLIC_BASE_URL=http://192.168.1.100

# Opsi B: Untuk menggunakan domain kustom (untuk Anda)
PUBLIC_BASE_URL=https://storage.greyscope.xyz
```

**`frontend/nginx.conf`** (Diperbarui untuk memilih versi frontend)
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    # Ganti 'index_v1.html' dengan 'index_v2.html' untuk menggunakan desain Anda
    index index_v1.html; 

    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /files/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        # ... (header lainnya)
    }

    location / {
        try_files $uri $uri/ /index_v1.html; # Sesuaikan juga di sini
    }
}
```

**`docker-compose.yml`** (Tidak berubah)

---

### **Cara Menjalankan dan Mengkonfigurasi**

#### **Untuk Semua Orang (Menjalankan Lokal)**

1.  **Clone Repo dan Konfigurasi:**
    ```bash
    git clone <your-repo-url>
    cd cloudflare-r2-flexible-uploader
    cp .env.example .env
    ```
2.  **Edit `.env`:**
    *   Isi semua kredensial R2.
    *   Pada `PUBLIC_BASE_URL`, isi dengan `http://localhost` (atau IP server Anda).
3.  **Jalankan:**
    ```bash
    docker-compose up --build -d
    ```
4.  **Akses:** Buka `http://localhost` di browser.

#### **Khusus untuk Anda (Menggunakan Domain)**

1.  **Konfigurasi DNS:**
    *   Di dashboard Cloudflare DNS, buat record `CNAME`:
        *   **Type:** `CNAME`
        *   **Name:** `storage`
        *   **Target:** `IP_SERVER_ANDA` (jika server Anda memiliki IP publik) atau gunakan **Cloudflare Tunnels** untuk menghubungkan server lokal Anda ke domain tanpa IP publik (ini adalah metode yang sangat direkomendasikan).
        *   **Proxy:** **Proxied** (awan oranye).
2.  **Konfigurasi Aplikasi:**
    *   Edit file `.env`.
    *   Pada `PUBLIC_BASE_URL`, isi dengan `https://storage.greyscope.xyz`.
3.  **Jalankan:**
    ```bash
    docker-compose up --build -d
    ```
4.  **Akses:** Buka `https://storage.greyscope.xyz`.

#### **Cara Mengganti Tampilan Frontend**

1.  Buka file `frontend/nginx.conf`.
2.  Pada baris `index` dan `try_files`, ubah `index_v1.html` menjadi `index_v2.html`.
3.  Simpan file dan jalankan `docker-compose up --build -d` untuk menerapkan perubahan.

Dengan struktur ini, Anda memiliki satu repositori yang powerful, fleksibel, dan dapat memenuhi kebutuhan berbagai jenis pengguna, sambil tetap memberikan Anda kontrol penuh atas instalasi pribadi Anda.