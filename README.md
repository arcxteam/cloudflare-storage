<h1 align="center">Supercharge Your Buckets Files with Cloudflare R2 Storage</h1>


> [!IMPORTANT]
> <mark>Project knowledgment.</mark>
> This project a powerful and user-friendly private file storage management, was born from a its self flexibility vision. The core concept, direction, and design were by
> **© Greyscope&Co | 0xgrey** resulting in a compactibility and intuitive storage clouding but securing. The project not only meets current needs but also anticipates personal requirements, ensuring a seamless and secure user experience.


## Preview Frontend Web UI Dashboard
> https://arcxteam.github.io/cloudflare-storage/frontend/

### A Comprehensive Guide: How to Set Up Private Storage with Cloudflare R2 Bucket and S3 API Compatibility

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


#### **Config File `.env`**

```bash
nano .env
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
