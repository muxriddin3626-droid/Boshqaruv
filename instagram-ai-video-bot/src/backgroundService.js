// Pexels'dan (bepul, litsenziyasiz stok video xizmati) mavzuga mos fon
// video qidiradi va yuklab oladi.
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('pexels');

const BG_DIR = path.join(__dirname, '..', 'media', 'bg');

function pickVideoFile(files) {
  // Fayl hajmini nazorat qilish uchun kenglik <=1080 bo'lgan eng sifatli
  // variantni tanlaymiz (Instagram Reels 1080x1920 talab qiladi).
  const sorted = [...files]
    .filter((f) => f.file_type === 'video/mp4' && f.width && f.width <= 1080)
    .sort((a, b) => b.width - a.width);
  return sorted[0] || files[0];
}

async function fetchBackgroundVideo(mood, apiKey) {
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY sozlanmagan. .env fayliga qo\'shing.');
  }
  const client = createClient(apiKey);
  const result = await client.videos.search({
    query: mood,
    per_page: 6,
    orientation: 'portrait',
  });

  const videos = result.videos || [];
  if (videos.length === 0) {
    throw new Error(`"${mood}" bo'yicha Pexels'da fon video topilmadi.`);
  }

  const video = videos[Math.floor(Math.random() * videos.length)];
  const file = pickVideoFile(video.video_files);
  if (!file) {
    throw new Error('Mos formatdagi video fayl topilmadi.');
  }

  fs.mkdirSync(BG_DIR, { recursive: true });
  const outPath = path.join(BG_DIR, `bg-${video.id}.mp4`);

  if (!fs.existsSync(outPath)) {
    const response = await axios.get(file.link, { responseType: 'stream' });
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(outPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  return outPath;
}

module.exports = { fetchBackgroundVideo };
