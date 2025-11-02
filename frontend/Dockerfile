FROM nginx:alpine

# default config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy file static
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/

# Copy config NGINX
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80