// Joylangan postlarning Instagram'dagi haqiqiy natijalarini yig'ib,
// qaysi mood (fon/uslub) ko'proq engagement berayotganini hisoblaydi.
// Natija src/quotes.js dagi pickQuote() ga uzatilib, keyingi videolar
// shunga moslab tanlanadi.
const { readLog, updateStats } = require('./postLog');
const { getMediaInsights } = require('./instagramInsights');

const REFRESH_LIMIT = 15; // bir chaqiriqda ko'pi bilan shuncha post yangilanadi (API limitidan saqlanish uchun)
const MIN_AGE_HOURS = 1; // Instagram statistikani yig'ib ulgurishi uchun postdan keyin kamida shuncha soat kutiladi

function engagementRate(stats) {
  if (!stats) return null;
  const reach = Number(stats.reach) || 0;
  if (reach === 0) return null;
  const interactions =
    (Number(stats.likes) || 0) +
    (Number(stats.comments) || 0) +
    (Number(stats.shares) || 0) +
    (Number(stats.saved) || 0);
  return interactions / reach;
}

async function refreshStats() {
  const entries = readLog();
  const now = Date.now();
  const candidates = entries
    .filter((e) => e.mediaId)
    .filter((e) => (now - new Date(e.publishedAt).getTime()) / 36e5 >= MIN_AGE_HOURS)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, REFRESH_LIMIT);

  let updated = 0;
  let failed = 0;
  for (const entry of candidates) {
    try {
      const stats = await getMediaInsights(entry.mediaId);
      updateStats(entry.mediaId, stats);
      updated += 1;
    } catch (err) {
      failed += 1;
      console.error(`Post statistikasini olishda xato (${entry.mediaId}):`, err.message);
    }
  }
  return { updated, failed, checked: candidates.length };
}

function computeMoodScores() {
  const entries = readLog().filter((e) => e.stats);
  const byMood = {};
  for (const entry of entries) {
    const rate = engagementRate(entry.stats);
    if (rate === null) continue;
    if (!byMood[entry.mood]) byMood[entry.mood] = [];
    byMood[entry.mood].push(rate);
  }
  const scores = {};
  for (const [mood, rates] of Object.entries(byMood)) {
    scores[mood] = rates.reduce((a, b) => a + b, 0) / rates.length;
  }
  return scores;
}

function topPosts(limit = 3) {
  return readLog()
    .filter((e) => e.stats)
    .map((e) => ({ ...e, rate: engagementRate(e.stats) }))
    .filter((e) => e.rate !== null)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, limit);
}

async function buildReport() {
  const { getAccountSummary } = require('./instagramInsights');
  const lines = [];

  try {
    const account = await getAccountSummary();
    lines.push(`👤 @${account.username}`);
    lines.push(`Obunachilar: ${account.followers_count}`);
    lines.push(`Postlar soni: ${account.media_count}`);
  } catch (err) {
    lines.push(`⚠️ Hisob ma'lumotini olib bo'lmadi: ${err.message}`);
  }

  const refresh = await refreshStats();
  lines.push('');
  lines.push(`📊 Statistika yangilandi: ${refresh.updated}/${refresh.checked} post (${refresh.failed} xato)`);

  const best = topPosts(3);
  if (best.length > 0) {
    lines.push('');
    lines.push('🏆 Eng yaxshi natijali postlar:');
    for (const post of best) {
      const pct = (post.rate * 100).toFixed(1);
      lines.push(`- "${post.quoteText.slice(0, 40)}${post.quoteText.length > 40 ? '…' : ''}" — ${pct}% engagement (mood: ${post.mood})`);
    }
  }

  const moodScores = computeMoodScores();
  const moodEntries = Object.entries(moodScores).sort((a, b) => b[1] - a[1]);
  if (moodEntries.length > 0) {
    lines.push('');
    lines.push("🎯 Mood bo'yicha o'rtacha natija:");
    for (const [mood, score] of moodEntries) {
      lines.push(`- ${mood}: ${(score * 100).toFixed(1)}%`);
    }
    lines.push('');
    lines.push("Keyingi videolar shu natijalarga moslab (yaxshi ishlaganlarga ko'proq ehtimollik bilan) tanlanadi.");
  } else {
    lines.push('');
    lines.push("Hali yetarli statistika yo'q - videolar hozircha tasodifiy tanlanadi.");
  }

  return lines.join('\n');
}

module.exports = { refreshStats, computeMoodScores, topPosts, buildReport };
