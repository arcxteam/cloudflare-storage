<h1 align="center">Supercharge Your Buckets Files with Cloudflare R2 Storage</h1>

<p align="center">
  <strong>A Comprehensive Guide: How to Set Up Private Storage with Cloudflare R2 Buckets and S3 API Compatibility</strong><br>
  <em>Supports continuous full stack deployment, a powerful and user-friendly private file storage management</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.1.2-FF0069" alt="Version">
  <img src="https://img.shields.io/badge/R2-Cloudflare-orange" alt="cloudflare">
  <img src="https://img.shields.io/badge/Amazon_S3-AWS-brightgreen" alt="AWS">
  <img src="https://img.shields.io/badge/Buckets-Private_Storage-blue" alt="Storage">
  <a href="https://github.com/arcxteam/cloudflare-storage/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License"></a>
</p>

---

## Overview

<mark>**Project knowledgment.**</mark> This project a powerful and user-friendly private file storage management, was born from a its self flexibility vision. The core concept, direction, and design were by **© Greyscope&Co | 0xgrey** resulting in a compactibility and intuitive storage clouding but securing. The project not only meets current needs but also anticipates personal requirements, ensuring a seamless and secure user experience.

### Key Features

- 🔄 **Continuous Monitoring**: Automatically detects and converts new model updates from HuggingFace repositories
- 🤖 **Auto-Detection**: Intelligent tokenizer detection for 50+ popular model architectures (Qwen, Llama, Mistral, Phi, Gemma, etc.)
- 📦 **Multiple Quantization**: Supports F16, F32, BF16, and all K-quant formats (Q2_K to Q8_0)
- 🎯 **Flexible Deploy**: Three (3) upload modes - same repository, new repository, or local-only storage
- 🧹 **Smart Cleanup**: Automatic temporary file management to prevent storage used
- 🐳 **Docker**: Fully container with optimized build times and resource usage
- 📊 **Progress Tracking**: Clean, milestone-based logging with colorized console output

### **Preview Frontend Web UI Dashboard**
> https://arcxteam.github.io/cloudflare-storage/frontend/

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
│   ├── nginx.conf.template
│   ├── index.html
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

**Signup to Cloudflare Access**
- Visit R2 settings → https://dash.cloudflare.com/?to=/:account/r2/overview
- Buy domains up to you (Recommended for use cloudflare infra)
- 

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
````

### Create an R2 API token

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

<mark>Choose one above - JSON format</mark>
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

### 3. **Build and Start**
> Starting running

```
docker compose up --build -d
```

> Monitor logs & stop

```
docker compose logs -f
# docker compose down
```


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
