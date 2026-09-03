// Instagramga joylangan postlar tarixi - keyinchalik ularning natijasini
// (like, reach va h.k.) so'rab, qaysi mood/uslub yaxshi ishlayotganini
// aniqlash uchun. Render'ning bepul tarifida disk doimiy emasligini
// unutmang - buni doimiy statistika sifatida emas, "so'nggi tendensiya"
// sifatida ko'ring.
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'post-log.json');
const MAX_ENTRIES = 200;

function readLog() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLog(entries) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries));
}

function recordPost({ mediaId, quoteIndex, mood, quoteText, permalink }) {
  const entries = readLog();
  entries.push({
    mediaId,
    quoteIndex,
    mood,
    quoteText,
    permalink: permalink || null,
    publishedAt: new Date().toISOString(),
    stats: null, // src/analytics.js keyinroq to'ldiradi
  });
  writeLog(entries.slice(-MAX_ENTRIES));
}

function updateStats(mediaId, stats) {
  const entries = readLog();
  const entry = entries.find((e) => e.mediaId === mediaId);
  if (!entry) return false;
  entry.stats = stats;
  entry.statsUpdatedAt = new Date().toISOString();
  writeLog(entries);
  return true;
}

module.exports = { readLog, recordPost, updateStats };
