document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const fileList = document.getElementById('fileSlider');
    const loadingMessage = document.getElementById('loadingMessage');
    const fileCount = document.getElementById('fileCount');
    const bucketSize = document.getElementById('bucketSize');
    const remainingQuota = document.getElementById('remainingQuota');
    const resetCountdown = document.getElementById('resetCountdown');
    const quotaProgress = document.getElementById('quotaProgress');
    const quotaText = document.getElementById('quotaText');
    const searchInput = document.getElementById('searchInput');
    const fileSliderContainer = document.getElementById('fileSliderContainer');
    const sliderControls = document.getElementById('sliderControls');
    const sliderIndicators = document.getElementById('sliderIndicators');
    const prevSlide = document.getElementById('prevSlide');
    const nextSlide = document.getElementById('nextSlide');
    const fabButton = document.getElementById('fabButton');
    const uploadModal = document.getElementById('uploadModal');
    const modalClose = document.getElementById('modalClose');
    const modalUploadForm = document.getElementById('modalUploadForm');
    const modalFileInput = document.getElementById('modalFileInput');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Variabel sliding windows
    let currentSlide = 0;
    let allFiles = [];
    let filteredFiles = [];
    const filesPerSlide = 6;

    // --- Sample data testing --- [DIPERBAIKI: HAPUS SELURUH SAMPLE DATA]
    // (Tidak ada lagi fallback ke sample)

    // --- Funct Utility ---
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };
    
    const getFileIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf', 'doc': 'fa-file-word', 'docx': 'fa-file-word',
            'xls': 'fa-file-excel', 'xlsx': 'fa-file-excel', 'ppt': 'fa-file-powerpoint',
            'pptx': 'fa-file-powerpoint', 'jpg': 'fa-file-image', 'jpeg': 'fa-file-image',
            'png': 'fa-file-image', 'gif': 'fa-file-image', 'mp4': 'fa-file-video', 'csv': 'fa-file-excel',
            'mp3': 'fa-file-audio', 'zip': 'fa-file-zipper', 'rar': 'fa-file-zipper', 'svg': 'fa-file-image',
            'sketch': 'fa-file-fragment', 'sh': 'fa-file-code', 'py': 'fa-file-code', 'js': 'fa-file-code',
            'html': 'fa-file-code', 'yml': 'fa-file-code', 'sol': 'fa-file-code', 'ts': 'fa-file-code',
            'json': 'fa-file-code', 'php': 'fa-file-code', 'java': 'fa-file-code', 'rb': 'fa-file-code',
            'ipynb': 'fa-file-code', 'cpp': 'fa-file-code', 'go': 'fa-file-code', 'md': 'fa-file-shield',
            'txt': 'fa-file-contract', 'dwg': 'fa-file-fragment'
        };
        return iconMap[ext] || 'fa-file';
    };

    // --- Funct Update Statistic Bucket ---
    const updateBucketStats = (stats) => {
        animateValue(fileCount, parseInt(fileCount.textContent) || 0, stats.total_files, 1000);
        animateText(bucketSize, stats.formatted_current_period_size);
        animateText(remainingQuota, stats.formatted_remaining);
        animateText(resetCountdown, `${stats.days_until_reset} days Bucket Time Reset`);
        
        const quotaLimit = 10 * 1024 * 1024 * 1024;
        const usedPercentage = (stats.current_period_size / quotaLimit) * 100;
        quotaProgress.style.width = `${usedPercentage}%`;
        quotaText.textContent = `${usedPercentage.toFixed(2)}% of 10GB used`;
        
        if (usedPercentage > 90) {
            quotaProgress.style.background = 'linear-gradient(to right, #e74c3c, #c0392b)';
        } else if (usedPercentage > 70) {
            quotaProgress.style.background = 'linear-gradient(to right, #f39c12, #e67e22)';
        } else {
            quotaProgress.style.background = 'var(--gradient-1)';
        }
    };

    // --- Funcnt Animated ---
    const animateValue = (element, start, end, duration) => {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = `${end} Bucket Files Stored`;
                clearInterval(timer);
            } else {
                element.textContent = `${Math.floor(current)} Bucket Files Stored`;
            }
        }, 16);
    };
    
    const animateText = (element, newText) => {
        element.style.opacity = '0';
        setTimeout(() => {
            if (element.id === 'bucketSize') {
                element.textContent = `${newText} Bucket Size Stored`;
            } else if (element.id === 'remainingQuota') {
                element.textContent = `${newText} UnBucket Size Stored`;
            } else if (element.id === 'resetCountdown') {
                element.innerHTML = newText;
            }
            element.style.opacity = '1';
        }, 300);
    };

    // --- Function sliding windows ---
    const createFileSlides = () => {
        fileList.innerHTML = '';
        sliderIndicators.innerHTML = '';
        
        if (filteredFiles.length === 0) {
            fileList.innerHTML = '<p class="text-center text-muted">No files found.</p>';
            fileSliderContainer.style.display = 'none';
            sliderControls.style.display = 'none';
            sliderIndicators.style.display = 'none';
            return;
        }
        
        fileSliderContainer.style.display = 'block';
        
        const slideCount = Math.ceil(filteredFiles.length / filesPerSlide);
        
        // DIPERBAIKI: Reset currentSlide jika melebihi batas slide (hindari slide kosong)
        if (currentSlide >= slideCount) {
            currentSlide = Math.max(0, slideCount - 1);
        }
        
        for (let i = 0; i < slideCount; i++) {
            const slide = document.createElement('div');
            slide.className = 'file-slide';
            if (i === currentSlide) slide.classList.add('active');
            
            const startIdx = i * filesPerSlide;
            const endIdx = Math.min(startIdx + filesPerSlide, filteredFiles.length);
            
            for (let j = startIdx; j < endIdx; j++) {
                const file = filteredFiles[j];
                const fileCard = document.createElement('div');
                fileCard.className = 'file-card';
                
                fileCard.innerHTML = `
                    <div class="file-card-header">
                        <!-- DIPERBAIKI: Kembalikan icon file dari getFileIcon -->
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
                        <!-- DIPERBAIKI: Kembalikan icon fa-download di count + buttons -->
                        <span class="download-count"><i class="fas fa-download"></i> ${file.download_count} times</span>
                        <div>
                            <button class="btn btn-download btn-sm" data-filename="${file.key}">
                                <i class="fas fa-file-arrow-down"></i>
                            </button>
                            <button class="btn btn-copy btn-sm" data-filename="${file.key}" data-public-url="${file.public_url}">
                                <i class="fas fa-arrow-up-from-bracket"></i>
                            </button>
                        </div>
                    </div>
                `;
                slide.appendChild(fileCard);
            }
            
            fileList.appendChild(slide);
            
            const indicator = document.createElement('div');
            indicator.className = 'indicator';
            if (i === currentSlide) indicator.classList.add('active');
            indicator.addEventListener('click', () => goToSlide(i));
            sliderIndicators.appendChild(indicator);
        }
        
        if (slideCount > 1) {
            sliderControls.style.display = 'flex';
            sliderIndicators.style.display = 'flex';
        } else {
            sliderControls.style.display = 'none';
            sliderIndicators.style.display = 'none';
        }
        
        updateSlidePosition();
        
        // DIPERBAIKI: Re-attach event listeners (aman untuk icons)
        document.querySelectorAll('.btn-download').forEach(button => {
            button.addEventListener('click', handleDownloadClick);
        });
        document.querySelectorAll('.btn-copy').forEach(button => {
            button.addEventListener('click', handleCopyClick);
        });
    };

    const updateSlidePosition = () => {
        const slides = document.querySelectorAll('.file-slide');
        slides.forEach((slide, i) => {
            slide.style.transform = `translateX(${(i - currentSlide) * 100}%)`;
        });
        
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === currentSlide);
        });
        
        prevSlide.disabled = currentSlide === 0;
        nextSlide.disabled = currentSlide === (slides.length - 1);
    };

    const goToSlide = (index) => {
        currentSlide = index;
        updateSlidePosition();
    };

    prevSlide.addEventListener('click', () => {
        if (currentSlide > 0) goToSlide(currentSlide - 1);
    });

    nextSlide.addEventListener('click', () => {
        const totalSlides = Math.ceil(filteredFiles.length / filesPerSlide);
        if (currentSlide < totalSlides - 1) goToSlide(currentSlide + 1);
    });

    // --- Function handle download/copy --- [DIPERBAIKI: PAKSA DOWNLOAD + REFRESH COUNT]
    const handleFileAction = async (filename, publicUrl, action) => {
        console.log('handleFileAction called with:', { filename, publicUrl, action });
    
        try {
            if (action === 'download') {
                // DIPERBAIKI: Gunakan fetch + blob untuk Save As (tidak render di tab)
                const downloadUrl = `/api/serve-file/${encodeURIComponent(filename)}?t=${Date.now()}`;
                console.log('Final download URL:', downloadUrl);
            
                const response = await fetch(downloadUrl, { cache: 'no-cache' });
                if (!response.ok) throw new Error('Download failed');
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.setAttribute('download', filename);
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            
            } else if (action === 'copy') {
                await navigator.clipboard.writeText(publicUrl);
                showNotification('Link copied!', 'success');
            }

            // DIPERBAIKI: Selalu refresh UI setelah aksi (count naik, no fallback)
            fetchAndDisplayFiles();

        } catch (error) {
            console.error('Action failed:', error);
            showNotification('Action failed. Please try again.', 'error');
        }
    };
    
    // --- Event handlers for download/copy buttons ---
    const handleDownloadClick = async (e) => {
        const button = e.currentTarget;
        const filename = button.dataset.filename;
        await handleFileAction(filename, null, 'download');
    };

    const handleCopyClick = async (e) => {
        const button = e.currentTarget;
        const filename = button.dataset.filename;
        const publicUrl = button.dataset.publicUrl;
        await handleFileAction(filename, publicUrl, 'copy');
    };

    // --- Upload progress bar ---
    const uploadFileXHR = (file, callback) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                progressBar.style.width = `${percent}%`;
                progressBar.textContent = `${Math.round(percent)}%`;
                progressContainer.style.display = 'block';
            }
        };

        xhr.onload = () => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            progressBar.textContent = '0%';

            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    callback(null, result);
                } catch (e) {
                    callback('Invalid response from server.');
                }
            } else {
                let errorMessage = `Upload failed with status: ${xhr.status}`;
                if (xhr.status === 413) {
                    errorMessage = 'File is too large. Please try a smaller file or contact support.';
                }
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {}
                callback(errorMessage);
            }
        };

        xhr.onerror = () => {
            progressContainer.style.display = 'none';
            callback('Network error. Please check your connection.');
        };

        xhr.open('POST', '/api/upload', true);
        xhr.send(formData);
    };

    // --- Event listener upload form ---
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!uploadForm.checkValidity()) {
            uploadForm.classList.add('was-validated');
            return;
        }

        const file = fileInput.files[0];
        // DIPERBAIKI: Kembalikan icon + text loading
        uploadButton.disabled = true;
        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';

        uploadFileXHR(file, (err, result) => {
            if (err) {
                showNotification(`Error: ${err}`, 'error');
            } else {
                uploadForm.reset();
                uploadForm.classList.remove('was-validated');
                fetchAndDisplayFiles();
                showNotification(result.message, 'success');
            }
            // DIPERBAIKI: Kembalikan icon upload
            uploadButton.disabled = false;
            uploadButton.innerHTML = '<i class="fas fa-cloud-upload-alt me-2"></i>Upload File';
        });
    });

    // --- Event listener modal upload ---
    modalUploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!modalFileInput.files.length) {
            showNotification('Please select a file to upload', 'error');
            return;
        }
        
        const file = modalFileInput.files[0];
        
        uploadFileXHR(file, (err, result) => {
            if (err) {
                showNotification(`Error: ${err}`, 'error');
            } else {
                modalUploadForm.reset();
                uploadModal.classList.remove('show');
                fetchAndDisplayFiles();
                showNotification(result.message, 'success');
            }
        });
    });

    // --- Event listener modal controls ---
    fabButton.addEventListener('click', () => {
        uploadModal.classList.add('show');
    });
    
    modalClose.addEventListener('click', () => {
        uploadModal.classList.remove('show');
    });
    
    uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            uploadModal.classList.remove('show');
        }
    });

    // --- Funct searching --- [DIPERBAIKI: Tambah debounce (tidak ganggu slide/icons)]
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.toLowerCase();
            
            if (searchTerm === '') {
                filteredFiles = [...allFiles];
            } else {
                filteredFiles = allFiles.filter(file => 
                    file.key.toLowerCase().includes(searchTerm)
                );
            }
            
            currentSlide = 0;
            createFileSlides();
        }, 300);
    });

    // --- Funct notify ---
    const showNotification = (message, type = 'info') => {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    };

    // --- Fetch data & view file --- [DIPERBAIKI: NO SAMPLE, BYPASS CACHE, REFRESH UI]
    const fetchAndDisplayFiles = async () => {
        try {
            loadingMessage.style.display = 'block';
            loadingMessage.innerHTML = '<span class="loading-spinner"></span> Loading files...';
            fileSliderContainer.style.display = 'none';
            
            // DIPERBAIKI: Bypass cache dengan timestamp + no-cache
            const response = await fetch(`/api/files?t=${Date.now()}`, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            allFiles = result.files || [];
            filteredFiles = [...allFiles];
            
            createFileSlides();
            updateBucketStats(result.stats || {
                total_files: 0,
                formatted_current_period_size: "0 Bytes",
                formatted_remaining: "10 GB",
                days_until_reset: 30,
                current_period_size: 0
            });
            
            loadingMessage.style.display = 'none';

        } catch (error) {
            console.error('Failed to load files:', error);
            loadingMessage.textContent = `Error: ${error.message}`;
            loadingMessage.style.color = '#e74c3c';
            allFiles = [];
            filteredFiles = [];
            createFileSlides(); // Tampilkan "No files" dengan icons utuh
        }
    };

    // Initialize
    fetchAndDisplayFiles();
    
    // Update countdown every day
    setInterval(fetchAndDisplayFiles, 24 * 60 * 60 * 1000);
});