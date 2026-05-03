<h1 align="center">Supercharge Your Buckets Files with Cloudflare R2 Storage</h1>

<p align="center">
  <strong>A Comprehensive Guide: How to Set Up Private Storage with Cloudflare R2 Buckets and S3 API Compatibility</strong><br>
  <em>Craft your personalized storage buckets, forging a realm of effortless file management and securely by Cloudflare R2</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.2.0-FF0069" alt="Version">
  <img src="https://img.shields.io/badge/R2-Cloudflare-orange" alt="cloudflare">
  <img src="https://img.shields.io/badge/Amazon_S3-AWS-brightgreen" alt="AWS">
  <img src="https://img.shields.io/badge/Buckets-Private_Storage-blue" alt="Storage">
  <a href="https://github.com/arcxteam/cloudflare-storage/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License"></a>
</p>

---

## Overview

<mark>**Vision & Architecture.**</mark> This project is a robust, high-performance private file management ecosystem engineered with a focus on absolute flexibility and security. Conceptualized, architected, and designed by **0xgrey**, it delivers a highly compatible and intuitive cloud storage interface powered by Cloudflare R2. By bridging the gap between streamlined user experience and enterprise-grade security protocols, the project anticipates the evolving needs of personal data management while ensuring a seamless, low-latency operational environment.

### Key Features

- ❇️ **Full-Stack Architecture**: End-to-end deployment (Flask/Nginx) featuring a fully responsive, desktop-and-mobile-optimized UI/UX.
- 📊 **Real-Time Analytics**: Live API data tracking for bucket utilization, active progress bars, storage capacity metrics, and monthly bandwidth reset monitoring (e.g., 10GB quotas).
- 📁 **Advanced File Management**: High-speed chunked uploads (1GB+ scalable), real-time filename search, download analytics, secure sharing links, and direct RAW streaming modes.
- 🎨 **Dynamic Media Interface**: Intelligent media handling supporting extensive file-type icons, rich preview effects, and a responsive sliding-grid layout.
- 🧩 **Universal S3 Compatibility**: Built on the robust Amazon S3 API (`boto3`) ensuring seamless deployment, high-throughput streaming, and interoperability across cloud providers.
- 🗑️ **Lifecycle & Cleanup (Trash & Burn)**: Comprehensive state management with global bucket wipe capabilities, preventing orphaned data and maintaining R2 integrity.
- 🐳 **Containerized Infrastructure**: Production-ready Docker environment featuring a dual-proxy setup, highly optimized zero-cache Nginx configurations, and strict isolation.
- ☁️ **Cloudflare R2 Backbone**: Powered by Cloudflare's distributed edge infrastructure for zero-egress, high-availability private data management.
- 🔐 **Zero-Trust Security Gate**: Formidable authentication barrier utilizing timing-safe passwords, strict HttpOnly/Secure JWT sessions, proactive rate-limiting, and hardened HTTP security headers.

### **Preview Frontend Web UI Dashboard**

> https://arcxteam.github.io/cloudflare-storage/frontend/

**Password:** `project123`

## Requirements

<p>
  <img src="https://img.shields.io/badge/VPS_Server-232F3E?style=for-the-badge&logo=digitalocean&logoColor=red" alt="VPS">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Cloudflare-orange?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
</p>

## **Project Structure**

```diff
cloudflare-storage/
├── .gitignore
├── .dockerignore
├── .env.example
├── docker-compose.yml
├── backend/
+   ├── README.md           # Guides delete buckets R2/AWS-S3
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py
│   ├── delete_buckets.py
│   └── data/
│       └── .gitkeep
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf.template # Enhanced for reverse proxy nginx + cloudflare
│   ├── index.html
│   ├── login.html
│   ├── style.css
│   ├── script.js
│   └── src/
│       └── favicon.ico
├── docs/
+   ├── README.md          # Guides main host nginx + template
│   └── /etc/nginx/sites-available/your-domain
│
├── LICENSE
└── README.md
```

## **Quick Start**
### 1. Prerequisites

**Signup & Securely Cloudflare Access**
- Dashboard R2 settings → https://dash.cloudflare.com/?to=/:account/r2/overview
- Buy domain up to you (Recommended for use an infra cloudflare)
- Free tier is limit Per/month 10GB (resetting)

**Install Docker & Compose** <mark>if not already installed</mark>
> Instal docker is optional, if you don't have.. try securely

```
curl -sSL https://raw.githubusercontent.com/arcxteam/succinct-prover/refs/heads/main/docker.sh | sudo bash
```

### 2. Clone Repository

```
git clone https://github.com/arcxteam/cloudflare-storage.git
cd cloudflare-storage
```

#### **Configure Environment**
> Create edit & save configuration file

```bash
cp .env.example .env
nano .env
```
> Example config environment variable

```diff
R2_ACCOUNT_ID=YOUR_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
R2_BUCKET_NAME=YOUR_NAME_CREATE_BUCKETS
+ Enabled (Public Development URL or Custom Domains, Create Record A sub-sub-domain)
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev or https://sub-sub-your-domain.com

# NOTE: Choose one, personal access web-ui dashboard (upload/download)
+ Option A: IP Public server
PUBLIC_BASE_URL=http://your-ip-address

+ Option B: Localnetwork (VSCode/Codespaces/etc)
PUBLIC_BASE_URL=http://localhost

+ Option C: Custom domains
PUBLIC_BASE_URL=https://your-domain.com or sub-domain

+ Auth Security (admin login for web UI dashboard)
ADMIN_PASSWORD=Password-Here
+ Auto-generated if not set
AUTH_SECRET_KEY=your-random-secret-key
AUTH_SESSION_HOURS=24
```

### Create Buckets
1. **Access Dashboard Cloudflare**
2. **Chosee Storage & database** → **R2 Object Storage** →  **Overview**
3. **Create bucket**
4. **Add Detail Bucket:**
     - **Bucket name**: Create unique
     - **Location**: Automatic
5. **Save → Create bucket**

### Create R2 API token
1. Return to **R2**, then select **Manage R2 API tokens**.
2. Select **Create Account API Tokens**.
3. In **Permissions**, select **Object Read & Write**.
4. In **Specify bucket(s)**, choose *Apply to specific buckets only*. Select the bucket you created.
5. For **TTL** default is **forever** or Define how long this token will stay active:
6. For **Client IP Address Filtering** no have action default is blank/null
7. Select **Create API Token**.
8. Copy the **Access Key ID**, **Secret Access Key**, and endpoint URL values. You will not be able to access these values again.
9. Select **Finish**.

### Config CORS Policy
> 1. Use mode Custom Domain (Production)
- **Policy name**: `web-app-cors`
- **Allowed origins**: `https://your-domain`
- **Allowed methods**: Pilih `GET`, `POST`, `PUT`, `DELETE`, `HEAD`
- **Allowed headers**: `*`
- **Max age seconds**: `86400`
- **Click "Add policy or save"`**
> 2. Use mode Localhost/Development
- **Policy name**: `dev-cors-policy`
- **Allowed origins**: `http://localhost:5000, http://127.0.0.1:5000`
- **Other are same** & **TLS 1.3** optional

<mark>Choose one CORS above, a format JSON</mark>
```json
[
  {
    "AllowedOrigins": ["https://your-domain", "http://localhost:5000", "http://127.0.0.1:5000"],
    "AllowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

### 3. Build and Start
> Starting running

```
docker compose up --build -d
```

> Monitor logs & stop

```
docker compose logs -f
# docker compose down
```

## Security: Admin Portal Authentication

This project includes a built-in **admin login portal** to protect your private storage from unauthorized access. When anyone visits the web UI, they must enter the admin password before accessing the dashboard.

### How It Works

| Layer | Protection |
|-------|------------|
| **Nginx** | `auth_request` blocks all pages/API without valid session |
| **Backend** | JWT token in `HttpOnly` cookie (invisible to JavaScript/DevTools) |
| **Rate Limit** | Max 5 login attempts per 15 minutes per IP |
| **Headers** | CSP, X-Frame-Options DENY, XSS Protection, no-cache |

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | ✅ Yes | Your admin login password (plain text in `.env`) |
| `AUTH_SECRET_KEY` | ❌ Optional | JWT signing key. **Auto-generated** if empty, but session resets on container restart. Set for persistence |
| `AUTH_SESSION_HOURS` | ❌ Optional | Login session duration in hours (default: `24`) |


### Change Password

```bash
nano .env
# Edit: ADMIN_PASSWORD=YourNewPassword
docker compose up -d --build
```

### Generate AUTH_SECRET_KEY (optional)

```bash
python3 -c "import secrets; print(secrets.token_hex(64))"
# Copy the output to AUTH_SECRET_KEY in .env
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
