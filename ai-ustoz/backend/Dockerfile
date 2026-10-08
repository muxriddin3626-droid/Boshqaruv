FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# --no-proxy-headers: mijoz IP'sini faqat TRUSTED_PROXY_COUNT sozlamasi aniqlaydi (app/services/rate_limit.py).
# Aks holda uvicorn o'zi X-Forwarded-For'ga ishonib, IP cheklovini chetlab o'tish mumkin bo'ladi.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
