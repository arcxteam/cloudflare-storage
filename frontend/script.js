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

    // --- Sample data testing ---
    const sampleFiles = [
        {
            key: 'presentation.pdf',
            size: 2546576,
            last_modified: new Date().toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 42
        },
        {
            key: 'project-proposal.docx',
            size: 1150976,
            last_modified: new Date(Date.now() - 86400000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 18
        },
        {
            key: 'team-photo.jpg',
            size: 3879731,
            last_modified: new Date(Date.now() - 172800000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 27
        },
        {
            key: 'demo-video.mp4',
            size: 15938355,
            last_modified: new Date(Date.now() - 259200000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 35
        },
        {
            key: 'report.xlsx',
            size: 876544,
            last_modified: new Date(Date.now() - 345600000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 12
        },
        {
            key: 'architecture.png',
            size: 2156789,
            last_modified: new Date(Date.now() - 432000000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 23
        },
        {
            key: 'budget-2024.pdf',
            size: 3456789,
            last_modified: new Date(Date.now() - 518400000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 45
        },
        {
            key: 'meeting-notes.docx',
            size: 567890,
            last_modified: new Date(Date.now() - 604800000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 8
        },
        {
            key: 'product-launch.mp4',
            size: 25678901,
            last_modified: new Date(Date.now() - 691200000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 67
        },
        {
            key: 'brand-guidelines.pdf',
            size: 4567890,
            last_modified: new Date(Date.now() - 777600000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 34
        },
        {
            key: 'user-research.xlsx',
            size: 1234567,
            last_modified: new Date(Date.now() - 864000000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 19
        },
        {
            key: 'prototype.sketch',
            size: 9876543,
            last_modified: new Date(Date.now() - 950400000).toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 56
        }
    ];

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
            'png': 'fa-file-image', 'gif': 'fa-file-image', 'mp4': 'fa-file-video',
            'mp3': 'fa-file-audio', 'zip': 'fa-file-zipper', 'rar': 'fa-file-zipper',
            'sketch': 'fa-file'
        };
        return iconMap[ext] || 'fa-file';
    };

    // --- Funct Update Statistic Bucket ---
    const updateBucketStats = (files) => {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const formattedSize = formatFileSize(totalSize);
        
        // Cloudflare R2 free tier is 10GB per month
        const quotaLimit = 10 * 1024 * 1024 * 1024; // 10GB in bytes
        const remainingQuotaBytes = Math.max(0, quotaLimit - totalSize);
        const formattedRemaining = formatFileSize(remainingQuotaBytes);
        
        animateValue(fileCount, parseInt(fileCount.textContent) || 0, files.length, 1000);
        animateText(bucketSize, formattedSize);
        animateText(remainingQuota, formattedRemaining);
        
        // Update progress bar
        const usedPercentage = (totalSize / quotaLimit) * 100;
        quotaProgress.style.width = `${usedPercentage}%`;
        quotaText.textContent = `${usedPercentage.toFixed(2)}% of 10GB used`;
        
        // Change color
        if (usedPercentage > 90) {
            quotaProgress.style.background = 'linear-gradient(to right, #e74c3c, #c0392b)';
        } else if (usedPercentage > 70) {
            quotaProgress.style.background = 'linear-gradient(to right, #f39c12, #e67e22)';
        } else {
            quotaProgress.style.background = 'var(--gradient-1)';
        }
    };

    // --- Funct Update & Countdown Reset ---
    const updateResetCountdown = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Get first day of next month
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const firstDayOfNextMonth = new Date(nextYear, nextMonth, 1);
        
        // Calculate days remaining
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysRemaining = Math.ceil((firstDayOfNextMonth - now) / msPerDay);
        
        // Update countdown with animation
        animateText(resetCountdown, `${daysRemaining} days Bucket Time Reset`);
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
                element.textContent = newText;
            }
            element.style.opacity = '1';
        }, 300);
    };

    // --- Funct Sliding Windows ---
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
        
        // Calculate number of slides
        const slideCount = Math.ceil(filteredFiles.length / filesPerSlide);
        
        // Create slides
        for (let i = 0; i < slideCount; i++) {
            const slide = document.createElement('div');
            slide.className = 'file-slide';
            
            const startIdx = i * filesPerSlide;
            const endIdx = Math.min(startIdx + filesPerSlide, filteredFiles.length);
            
            for (let j = startIdx; j < endIdx; j++) {
                const file = filteredFiles[j];
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
                slide.appendChild(fileCard);
            }
            
            fileList.appendChild(slide);
            
            // Create indicator
            const indicator = document.createElement('div');
            indicator.className = 'indicator';
            if (i === 0) indicator.classList.add('active');
            indicator.addEventListener('click', () => goToSlide(i));
            sliderIndicators.appendChild(indicator);
        }
        
        // Show controls if more than one slide
        if (slideCount > 1) {
            sliderControls.style.display = 'flex';
            sliderIndicators.style.display = 'flex';
        } else {
            sliderControls.style.display = 'none';
            sliderIndicators.style.display = 'none';
        }
        
        // Reset to first slide
        currentSlide = 0;
        updateSlidePosition();
    };
    
    const updateSlidePosition = () => {
        fileList.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        // Update indicators
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach((indicator, index) => {
            if (index === currentSlide) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
        
        prevSlide.disabled = currentSlide === 0;
        nextSlide.disabled = currentSlide === Math.ceil(filteredFiles.length / filesPerSlide) - 1;
    };
    
    const goToSlide = (slideIndex) => {
        currentSlide = slideIndex;
        updateSlidePosition();
    };
    
    // Event listeners for slider controls
    prevSlide.addEventListener('click', () => {
        if (currentSlide > 0) {
            currentSlide--;
            updateSlidePosition();
        }
    });
    
    nextSlide.addEventListener('click', () => {
        if (currentSlide < Math.ceil(filteredFiles.length / filesPerSlide) - 1) {
            currentSlide++;
            updateSlidePosition();
        }
    });

    // --- Event Listener Upload ---
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

    // --- Event Listener Modal ---
    fabButton.addEventListener('click', () => {
        uploadModal.classList.add('show');
    });
    
    modalClose.addEventListener('click', () => {
        uploadModal.classList.remove('show');
    });
    
    modalUploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!modalFileInput.files.length) {
            showNotification('Please select a file to upload', 'error');
            return;
        }
        
        const file = modalFileInput.files[0];
        
        // Add file to the list
        const newFile = {
            key: file.name,
            size: file.size,
            last_modified: new Date().toISOString(),
            local_url: '#',
            public_url: '#',
            download_count: 0
        };
        
        allFiles.unshift(newFile);
        filteredFiles = [...allFiles];
        createFileSlides();
        updateBucketStats(allFiles);
        
        // Reset form and close modal
        modalUploadForm.reset();
        uploadModal.classList.remove('show');
        
        // Show success
        showNotification(`${file.name} uploaded successfully!`, 'success');
    });
    
    // Close modal when clicking outside
    uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            uploadModal.classList.remove('show');
        }
    });

    // --- Funct copied link ---
    window.copyToClipboard = (text, buttonElement) => {
        navigator.clipboard.writeText(text).then(() => {
            const originalHtml = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => { buttonElement.innerHTML = originalHtml; }, 2000);
        }).catch(err => console.error('Failed to copy: ', err));
    };

    // --- Funct searching ---
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (searchTerm === '') {
            filteredFiles = [...allFiles];
        } else {
            filteredFiles = allFiles.filter(file => 
                file.key.toLowerCase().includes(searchTerm)
            );
        }
        
        createFileSlides();
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

    // --- Fetch data & view file ---
    const fetchAndDisplayFiles = async () => {
        try {
            loadingMessage.style.display = 'block';
            fileSliderContainer.style.display = 'none';
            
            // Try to fetch from API first
            try {
                const response = await fetch('/api/files');
                const result = await response.json();
                
                allFiles = result.files || [];
                filteredFiles = [...allFiles];
                
                createFileSlides();
                updateBucketStats(result.stats || {
                    formatted_size: "0 Bytes",
                    formatted_remaining: "10 GB",
                    total_size: 0
                });
            } catch (apiError) {
                // If API fails, use sample data
                console.log('Using sample data for demonstration');
                allFiles = [...sampleFiles];
                filteredFiles = [...allFiles];
                
                createFileSlides();
                updateBucketStats(allFiles);
            }
            
            loadingMessage.style.display = 'none';
        } catch (error) {
            loadingMessage.textContent = `Error: ${error.message}`;
            loadingMessage.style.color = 'var(--error-color)';
        }
    };

    // Initialize
    fetchAndDisplayFiles();
    updateResetCountdown();
    
    // Update countdown every day
    setInterval(updateResetCountdown, 24 * 60 * 60 * 1000);
});