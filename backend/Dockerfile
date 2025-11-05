FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000
CMD ["gunicorn", "--workers", "1", "--bind", "0.0.0.0:5000", "--timeout", "300", "--log-level", "info", "app:app"]
