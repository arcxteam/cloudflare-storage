// Update script.js v1.1.1
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
            'pptx': 'fa-file-powerpoint', 'jpg': 'fa-file-image', 'jpeg': 'fa-file-image', 'mov': 'fa-file-video',
            'png': 'fa-file-image', 'gif': 'fa-file-image', 'mp4': 'fa-file-video', 'csv': 'fa-file-excel',
            'mp3': 'fa-file-audio', 'zip': 'fa-file-zipper', 'rar': 'fa-file-zipper', 'svg': 'fa-file-image',
            'sketch': 'fa-file-fragment', 'sh': 'fa-file-code', 'py': 'fa-file-code', 'js': 'fa-file-code',
            'html': 'fa-file-code', 'yml': 'fa-file-code', 'sol': 'fa-file-code', 'ts': 'fa-file-code',
            'json': 'fa-file-code', 'php': 'fa-file-code', 'java': 'fa-file-code', 'rb': 'fa-file-code',
            'ipynb': 'fa-file-code', 'cpp': 'fa-file-code', 'go': 'fa-file-code', 'md': 'fa-file-shield',
            'txt': 'fa-file-contract', 'dwg': 'fa-file-fragment', 'heif': 'fa-file-image', 'tiff': 'fa-file-image'
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

    // --- Function Animated ---
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

    // --- Function sliding windows (DIPERBAIKI v1.1.1) ---
    const createFileSlides = () => {
        console.log('[createFileSlides] Starting with', filteredFiles.length, 'files');
        
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
        currentSlide = 0;
        
        const slideCount = Math.ceil(filteredFiles.length / filesPerSlide);
        console.log('[createFileSlides] Creating', slideCount, 'slides');
        
        let actualSlidesCreated = 0;
        
        for (let i = 0; i < slideCount; i++) {
            const startIdx = i * filesPerSlide;
            const endIdx = Math.min(startIdx + filesPerSlide, filteredFiles.length);
            
            // Pastikan ada file untuk diproses
            if (startIdx >= endIdx) {
                console.warn(`[createFileSlides] Slide ${i} skipped: startIdx >= endIdx`);
                continue;
            }
            
            // Counter untuk track file yang berhasil ditambahkan
            let filesAdded = 0;
            
            const slide = document.createElement('div');
            slide.className = 'file-slide';
            slide.setAttribute('data-slide-index', i);
            
            // Tambahkan file ke slide
            for (let j = startIdx; j < endIdx; j++) {
                try {
                    const file = filteredFiles[j];
                    
                    // Validasi file object
                    if (!file || typeof file !== 'object') {
                        console.warn(`[createFileSlides] File index ${j} invalid:`, file);
                        continue;
                    }
                    
                    const fileCard = document.createElement('div');
                    fileCard.className = 'file-card';
                    
                    // Escape HTML untuk mencegah error dari karakter khusus
                    const escapeHtml = (str) => {
                        const div = document.createElement('div');
                        div.textContent = str;
                        return div.innerHTML;
                    };
                    
                    fileCard.innerHTML = `
                        <div class="file-card-header">
                            <i class="fas ${getFileIcon(file.key || 'unknown')}"></i>
                            <h5 class="file-card-title">${escapeHtml(file.key || 'Unknown file')}</h5>
                        </div>
                        <div class="file-card-body">
                            <div class="meta-item">
                                <span>Size:</span>
                                <span>${formatFileSize(file.size || 0)}</span>
                            </div>
                            <div class="meta-item">
                                <span>Modified:</span>
                                <span>${formatDate(file.last_modified || new Date())}</span>
                            </div>
                        </div>
                        <div class="file-card-footer">
                            <span class="download-count"><i class="fas fa-download"></i> ${file.download_count || 0} times</span>
                            <div>
                                <button class="btn btn-download btn-sm" data-filename="${escapeHtml(file.key || '')}">
                                    <i class="fas fa-file-arrow-down"></i>
                                </button>
                                <button class="btn btn-copy btn-sm" data-filename="${escapeHtml(file.key || '')}" data-public-url="${escapeHtml(file.public_url || '')}">
                                    <i class="fas fa-arrow-up-from-bracket"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    
                    slide.appendChild(fileCard);
                    filesAdded++;
                    
                } catch (error) {
                    console.error(`[createFileSlides] Error creating card for file index ${j}:`, error);
                    continue;
                }
            }
            
            // Hanya append slide jika ada file yang berhasil ditambahkan
            if (filesAdded > 0) {
                fileList.appendChild(slide);
                
                const indicator = document.createElement('div');
                indicator.className = 'indicator';
                indicator.setAttribute('data-indicator-index', i);
                indicator.addEventListener('click', () => goToSlide(actualSlidesCreated));
                sliderIndicators.appendChild(indicator);
                
                console.log(`[createFileSlides] Slide ${actualSlidesCreated} created with ${filesAdded} files (original index: ${i})`);
                actualSlidesCreated++;
            } else {
                console.warn(`[createFileSlides] Slide ${i} tidak memiliki file valid, dilewati`);
            }
        }
        
        // Validasi apakah ada slide yang terbuat
        const actualSlides = fileList.querySelectorAll('.file-slide');
        console.log('[createFileSlides] Total slides in DOM:', actualSlides.length);
        
        if (actualSlides.length === 0) {
            fileList.innerHTML = '<p class="text-center text-muted">No valid files to display.</p>';
            fileSliderContainer.style.display = 'none';
            sliderControls.style.display = 'none';
            sliderIndicators.style.display = 'none';
            return;
        }
        
        if (actualSlides.length > 1) {
            sliderControls.style.display = 'flex';
            sliderIndicators.style.display = 'flex';
        } else {
            sliderControls.style.display = 'none';
            sliderIndicators.style.display = 'none';
        }
        
        // PENTING: Set currentSlide to 0 before updating position
        currentSlide = 0;
        
        // Update position dengan delay kecil untuk memastikan DOM sudah ready
        setTimeout(() => {
            updateSlidePosition();
            console.log('[createFileSlides] Initial slide position updated');
        }, 10);
        
        // Pasang kembali event listener
        document.querySelectorAll('.btn-download').forEach(button => {
            button.addEventListener('click', handleDownloadClick);
        });
        document.querySelectorAll('.btn-copy').forEach(button => {
            button.addEventListener('click', handleCopyClick);
        });
    };

    // --- Function update slide position (DIPERBAIKI v1.1.1) ---
    const updateSlidePosition = () => {
        const slides = document.querySelectorAll('.file-slide');
        
        if (slides.length === 0) {
            console.warn('[updateSlidePosition] No slides found');
            return;
        }
        
        // Validasi dan koreksi currentSlide
        if (currentSlide >= slides.length) {
            console.warn(`[updateSlidePosition] currentSlide ${currentSlide} >= slides.length ${slides.length}, resetting to last slide`);
            currentSlide = slides.length - 1;
        }
        if (currentSlide < 0) {
            console.warn(`[updateSlidePosition] currentSlide ${currentSlide} < 0, resetting to 0`);
            currentSlide = 0;
        }
        
        console.log(`[updateSlidePosition] Updating to slide ${currentSlide} of ${slides.length}`);
        
        // PENTING: Hapus semua class active terlebih dahulu
        slides.forEach((slide) => {
            slide.classList.remove('active');
        });
        
        // Set transform dan active class
        slides.forEach((slide, i) => {
            const translateX = (i - currentSlide) * 100;
            slide.style.transform = `translateX(${translateX}%)`;
            
            if (i === currentSlide) {
                slide.classList.add('active');
            }
            
            console.log(`  Slide ${i}: translateX(${translateX}%), active: ${i === currentSlide}`);
        });
        
        // Update indicators
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === currentSlide);
        });
        
        // Update navigation buttons
        prevSlide.disabled = currentSlide === 0;
        nextSlide.disabled = currentSlide === (slides.length - 1);
        
        console.log(`[updateSlidePosition] Prev disabled: ${currentSlide === 0}, Next disabled: ${currentSlide === (slides.length - 1)}`);
    };

    const goToSlide = (index) => {
        const slides = document.querySelectorAll('.file-slide');
        
        if (index >= 0 && index < slides.length) {
            console.log(`[goToSlide] Moving from slide ${currentSlide} to ${index}`);
            currentSlide = index;
            updateSlidePosition();
        } else {
            console.warn(`[goToSlide] Invalid index ${index}, slides.length: ${slides.length}`);
        }
    };

    prevSlide.addEventListener('click', () => {
        if (currentSlide > 0) {
            goToSlide(currentSlide - 1);
        }
    });

    nextSlide.addEventListener('click', () => {
        const slides = document.querySelectorAll('.file-slide');
        if (currentSlide < slides.length - 1) {
            goToSlide(currentSlide + 1);
        }
    });

    // --- Function handle download ---
    const handleDownloadClick = async (e) => {
        const button = e.currentTarget;
        const filename = button.dataset.filename;
        const originalHTML = button.innerHTML;
        
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        try {
            const downloadUrl = `/api/serve-file/${encodeURIComponent(filename)}?t=${Date.now()}`;
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
            
            fetchAndDisplayFiles();

        } catch (error) {
            console.error('Download failed:', error);
            showNotification('Download failed. Please try again.', 'error');
        } finally {
            button.innerHTML = originalHTML;
            button.disabled = false;
        }
    };

    // --- Function handle copy ---
    const handleCopyClick = async (e) => {
        const button = e.currentTarget;
        const publicUrl = button.dataset.publicUrl;
        const originalHTML = button.innerHTML;
        
        try {
            await navigator.clipboard.writeText(publicUrl);
            
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            button.disabled = true;

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Copy failed:', error);
            showNotification('Failed to copy link.', 'error');
        }
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
                progressContainer.style.display = 'block';
            }
        };

        xhr.onload = () => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';

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

    // --- Funct searching ---
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
            
            console.log(`[search] Found ${filteredFiles.length} files matching "${searchTerm}"`);
            currentSlide = 0;
            createFileSlides();
        }, 300);
    });

    // --- Function notify ---
    const showNotification = (message, type = 'info') => {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    };

    // --- Fetch data & view file ---
    const fetchAndDisplayFiles = async () => {
        try {
            loadingMessage.style.display = 'block';
            loadingMessage.innerHTML = '<span class="loading-spinner"></span> Loading files...';
            fileSliderContainer.style.display = 'none';
            
            const response = await fetch('/api/files?t=' + Date.now(), { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            console.log('[fetchAndDisplayFiles] Received', result.files?.length || 0, 'files from API');
            
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
            console.error('[fetchAndDisplayFiles] Failed to load files:', error);
            loadingMessage.textContent = `Error: ${error.message}`;
            loadingMessage.style.color = '#e74c3c';
            allFiles = [];
            filteredFiles = [];
            createFileSlides();
        }
    };

    // Initialize
    console.log('[init] Initializing Bucket Files Manager v1.1.1');
    fetchAndDisplayFiles();
    
    // Update countdown every day
    setInterval(fetchAndDisplayFiles, 24 * 60 * 60 * 1000);
});
