# 1. Gunakan image resmi Nginx sebagai dasar
FROM nginx:alpine

# 2. Hapus konfigurasi default Nginx
RUN rm /etc/nginx/conf.d/default.conf

# 3. Salin konfigurasi Nginx kustom kita ke dalam kontainer
COPY nginx.conf /etc/nginx/conf.d/

# 4. Salin semua file statis (HTML, CSS, JS) ke folder yang disajikan Nginx
COPY . /usr/share/nginx/html

# 5. Jalankan server Nginx
CMD ["nginx", "-g", "daemon off;"]