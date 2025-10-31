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