FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf

# Copy file static
COPY index.html style.css script.js /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/

# Copy config (default.conf)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]