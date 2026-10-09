# Render (yoki boshqa bulut) uchun bitta obraz: sayt (Next.js statik eksport) + API (FastAPI)
# + baza sxemasi + ilova ichidagi darsliklar. Build konteksti — `ai-ustoz/` papkasi.
#
#   docker build -t ai-ustoz -f Dockerfile .
#
# Ishga tushganda avval baza jadvallari yaratiladi/yangilanadi (scripts/apply_schema.py),
# keyin server PORT (Render beradi) portida ochiladi.

# --- 1) Sayt: tayyor HTML/JS fayllar --------------------------------------------------
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
# API sayt bilan bitta manzilda — so'rovlar nisbiy yo'l bilan ketadi (CORS kerak emas).
ENV NEXT_PUBLIC_API_BASE_URL="" NEXT_OUTPUT=export NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- 2) API ---------------------------------------------------------------------------
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 WEB_DIR=/app/web SCHEMA_DIR=/app/database TEXTBOOKS_DIR=/data/textbooks MEDIA_DIR=/app/media

# Tesseract — skaner darslik sahifalarini serverning o'zida bepul o'qish (o'zbek tili paketi bilan).
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-uzb \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/scripts ./scripts
COPY database/schema.sql database/seed.sql ./database/
COPY data/textbooks /data/textbooks
COPY --from=web /web/out ./web

# Yuklangan fayllar, audiolar, darslik nusxalari — Render'da doimiy disk shu yerga ulanadi.
RUN mkdir -p /app/media

EXPOSE 8000
CMD ["sh", "-c", "python scripts/apply_schema.py && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-proxy-headers"]
