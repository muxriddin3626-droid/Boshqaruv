// Bitta tayyor "post"ni yig'ib beradigan asosiy quvur: iqtibos tanlash ->
// fon video yuklash -> ovoz yaratish -> video montaj -> caption tayyorlash.
const path = require('path');
const fs = require('fs');
const { pickQuote } = require('./quotes');
const { readHistory, markUsed } = require('./history');
const { fetchBackgroundVideo } = require('./backgroundService');
const { synthesize } = require('./ttsService');
const { generateVideo } = require('./videoGenerator');

const MEDIA_DIR = path.join(__dirname, '..', 'media');
const TTS_DIR = path.join(__dirname, '..', 'media', 'tts');

const HASHTAGS = '#motivatsiya #maqsad #ozini_rivojlantirish #ilhom #ozbekiston';

function buildCaption(quoteText) {
  return `${quoteText}\n\n${HASHTAGS}\n\nKo'proq motivatsiya uchun kuzatib boring 🔔`;
}

async function createPost({ pexelsApiKey } = {}) {
  const quote = pickQuote(readHistory());
  const backgroundPath = await fetchBackgroundVideo(
    quote.mood,
    pexelsApiKey || process.env.PEXELS_API_KEY
  );
  const audioPath = await synthesize(quote.text, TTS_DIR);

  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const fileName = `post-${Date.now()}.mp4`;
  const outPath = path.join(MEDIA_DIR, fileName);

  await generateVideo({
    quoteText: quote.text,
    backgroundPath,
    audioPath,
    outPath,
  });

  markUsed(quote.index);
  fs.unlink(audioPath, () => {});

  return {
    videoPath: outPath,
    fileName,
    caption: buildCaption(quote.text),
    quoteText: quote.text,
  };
}

module.exports = { createPost, buildCaption };
