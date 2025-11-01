## **Structure Folder & File**

```
cloudflare-storage/
├── .gitignore
├── .dockerignore
├── .env
├── docker-compose.yml
├── backend/
│   ├── README.md           # Guides Delete buckets R2/AWS
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py
│   ├── delete_buckets.py
│   └── data/
│       └── .gitkeep
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── src/
│       └── favicon.ico
├── docs/
│
├── LICENSE
└── README.md

```

### **Konfigurasi dan Cara Menjalankan di VPS**

#### **Langkah 2: Konfigurasi File `.env`**

> Ini adalah langkah terpenting. Edit file `.env`

```bash
nano .env
```

**Akses Storage Homepages**

```env
# Cloudflare R2 Credentials
R2_ACCOUNT_ID=YOUR_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
R2_BUCKET_NAME=greyscope-flex-storage
R2_PUBLIC_URL=https://greyscope-flex-storage.ACCOUNT_ID.r2.cloudflarestorage.com

# Ganti dengan IP publik VPS Anda
# PUBLIC_BASE_URL=http://192.168.1.100

# Ganti dengan domain publik Anda
PUBLIC_BASE_URL=https://storage.greyscope.xyz
```
Untuk skenario ini, pastikan Anda sudah mengatur DNS `A Record` atau `CNAME` untuk `storage.greyscope.xyz` yang menunjuk ke IP VPS Anda.

#### **Langkah 3: Build dan Jalankan Aplikasi**

Dari dalam folder `cloudflare-r2-final-uploader` di VPS Anda, jalankan perintah:

```bash
docker-compose up --build -d
```

---

### **Jawaban Langsung untuk Pertanyaan Anda**

Dengan setup ini, aplikasi Anda benar-benar universal:

*   **Untuk testing lokal (Codespaces/PC):** Set `PUBLIC_BASE_URL=http://localhost`.
*   **Untuk VPS tanpa domain:** Set `PUBLIC_BASE_URL=http://IP_VPS`.
*   **Untuk VPS dengan domain:** Set `PUBLIC_BASE_URL=https://domain-anda.com`.

---

### **Panduan Lengkap: Setup Cloudflare R2 untuk Aplikasi Storage Anda**

Panduan ini akan memandu Anda langkah demi langkah untuk membuat dan mengonfigurasi Cloudflare R2, yang akan berfungsi sebagai "gudang" penyimpanan file untuk aplikasi Anda.

#### **Langkah 1: Membuat Bucket R2 (Gudang Penyimpanan Anda)**

Bucket adalah wadah utama di mana semua file Anda akan disimpan.

1.  **Login ke Dashboard Cloudflare:** Buka [dash.cloudflare.com](https://dash.cloudflare.com) dan login ke akun Anda.
2.  **Pilih Menu R2:** Di menu sebelah kiri, cari dan klik **R2 Object Storage**.
3.  **Buat Bucket Baru:** Klik tombol **"Create bucket"**.
4.  **Isi Detail Bucket:**
    *   **Bucket name:** Beri nama unik untuk bucket Anda. Nama ini harus unik di seluruh Cloudflare R2, bukan hanya di akun Anda. Contoh: `greyscope-flex-storage-prod`.
    *   **Location:** Pilih lokasi server yang paling dekat dengan Anda atau target audiens Anda (misalnya, "Asia Pacific" untuk performa terbaik di Asia).
5.  **Klik "Create bucket"**.

Bucket Anda sekarang sudah siap, tetapi belum bisa diakses publik.

---

#### **Langkah 2: Memahami Biaya dan Limit (PENTING!)**

Cloudflare R2 memiliki **tier gratis yang sangat murah hati**, dan penting untuk Anda memahaminya agar tidak terkena biaya tak terduga.

**Berikut adalah rincian Tier Gratis R2 (per bulan):**
*   **Penyimpanan:** Tidak ada batasan! Anda bisa menyimpan data sebanyak-banyaknya secara gratis.
*   **Operasi Kelas A (Upload):** 1 juta operasi (upload, copy, dll).
*   **Operasi Kelas B (Download/List):** 10 juta operasi (download, melihat daftar file).
*   **Egress (Data Keluar): 10 GB.**

**Apa itu Egress (Data Keluar)?**
Ini adalah jumlah total data yang **diunduh dari bucket R2 ke internet**. Setiap kali seseorang mengunduh file melalui link publik, itu akan mengurangi kuota 10 GB ini.

**Lalu, jika lebih dari 10 GB apa yang terjadi?**
> **Anda akan dikenakan biaya (Pay-as-you-go).**

Setelah kuota 10 GB terlampaui, Cloudflare akan menagih Anda berdasarkan penggunaan. Saat ini, biayanya sangat murah, sekitar **$0.009 per GB**.

**Kesimpulan:** Untuk penggunaan pribadi atau proyek kecil, kuota 10 GB per bulan sangat sulit terlampaui. Anda tidak perlu khawatir selama penggunaannya masih wajar.

---

#### **Langkah 3: Mengaktifkan Akses Publik**

Agar file yang Anda unggah dapat diunduh oleh siapa pun yang memiliki linknya, Anda perlu mengaktifkan akses publik.

1.  Di dashboard R2, klik pada nama bucket yang baru saja Anda buat.
2.  Pergi ke tab **"Settings"**.
3.  Di bagian **"Public access"**, klik tombol **"Allow public access"**.
4.  Sebuah peringatan akan muncul. Baca dan klik **"Continue"** untuk mengkonfirmasi.

Sekarang, semua file di bucket ini dapat diakses publik.

---

#### **Langkah 4: Membuat Kredensial API (Kunci Akses untuk Aplikasi)**

Aplikasi kita membutuhkan "kunci" untuk mendapatkan izin membaca dan menulis file ke bucket R2 Anda.

1.  Di halaman dashboard R2, pergi ke tab **"Manage R2 API tokens"**.
2.  Klik tombol **"Create API token"**.
3.  **Isi Form Token:**
    *   **Token name:** Beri nama yang mudah diingat, misalnya `docker-app-token`.
    *   **Permissions:** Pilih **"Object Read and Write"**. Ini memberikan izin penuh untuk mengelola file di bucket.
    *   **Account resources:** Biarkan default.
    *   **Bucket resources:** Klik **"Add bucket"** dan pilih bucket yang Anda buat pada Langkah 1. Ini adalah praktik keamanan yang baik, membatasi akses token hanya ke bucket yang diperlukan.
4.  Klik **"Create API token"**.

**HAL KRUSIAL:**
Cloudflare akan menampilkan **Access Key ID** dan **Secret Access Key**.
*   **Access Key ID** akan selalu bisa Anda lihat.
*   **Secret Access Key** **HANYA DITAMPILKAN SEKALI INI.** Salin dan simpan kedua kunci tersebut di tempat yang aman (seperti password manager). Jika Anda lupa, Anda harus membuat token baru.

---

#### **Langkah 5: Mengumpulkan Semua Informasi untuk File `.env`**

Sekarang, mari kita kumpulkan semua data yang dibutuhkan untuk mengisi file `.env` Anda.

Buka file `.env` di proyek Anda dan isi bagian-bagian berikut:

```env
# --- Cloudflare R2 Credentials (WAJIB) ---

# 1. R2_ACCOUNT_ID
# Dimana mendapatkannya: Di sidebar kanan bawah dashboard Cloudflare Anda.
R2_ACCOUNT_ID=ISI_DENGAN_ACCOUNT_ID_ANDA

# 2. R2_ACCESS_KEY_ID
# Dimana mendapatkannya: Dari halaman "Create API token" (Langkah 4).
R2_ACCESS_KEY_ID=ISI_DENGAN_ACCESS_KEY_ID_ANDA

# 3. R2_SECRET_ACCESS_KEY
# Dimana mendapatkannya: Dari halaman "Create API token" (Langkah 4). RAHASIA!
R2_SECRET_ACCESS_KEY=ISI_DENGAN_SECRET_ACCESS_KEY_ANDA

# 4. R2_BUCKET_NAME
# Dimana mendapatkannya: Nama bucket yang Anda buat di Langkah 1.
R2_BUCKET_NAME=greyscope-flex-storage-prod

# 5. R2_PUBLIC_URL
# Ini adalah URL publik default R2. Formatnya adalah:
# https://[NAMA_BUCKET].[ACCOUNT_ID].r2.cloudflarestorage.com
R2_PUBLIC_URL=https://greyscope-flex-storage-prod.ACCOUNT_ID_ANDA.r2.cloudflarestorage.com

# --- Pengaturan URL Aplikasi (PILIH SALAH SATU) ---

# Opsi A: Ganti dengan IP publik VPS Anda
# PUBLIC_BASE_URL=http://your-ip-address

# Opsi B: Testing lokal (Codespaces/PC)
#PUBLIC_BASE_URL=http://localhost

# Opsi C: Untuk menggunakan domain kustom
PUBLIC_BASE_URL=https://your-domain.com
```

**Pastikan Anda mengganti semua nilai `ISI_DENGAN_...` dengan data asli yang Anda dapatkan dari Cloudflare.**

---

### **Selesai!**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
