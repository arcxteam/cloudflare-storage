FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY index.html style.css script.js /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/

# Copy template config
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

EXPOSE 80

# Placeholder template & read R2 & run nginx
CMD ["/bin/sh", "-c", "envsubst '$R2_PUBLIC_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]