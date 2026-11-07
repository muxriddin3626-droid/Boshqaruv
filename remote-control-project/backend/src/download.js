/**
 * Ommaviy yuklab olish sahifasi va APK'ni uzatish.
 * ----------------------------------------------------
 * Maqsad: foydalanuvchi bitta havola (`.../get`) yuboradi; qabul qiluvchi uni
 * Chrome'da ochib, ilovani (Agent) yuklab oladi va o'rnatadi.
 *
 * APK fayllar GitHub Actions artifaktlarida turadi (login talab qiladi), shuning
 * uchun backend ularni serverdagi GITHUB_TOKEN bilan olib, ommaviy ravishda
 * uzatib beradi. Token faqat serverda qoladi - qabul qiluvchiga GitHub hisobi
 * kerak emas.
 *
 * Kerak:
 *   - Render env: GITHUB_TOKEN  (fine-grained PAT, Actions: read)
 *   - (ixtiyoriy) GH_OWNER, GH_REPO - standart: muxriddin3626-droid/Boshqaruv
 */

const GH_OWNER = process.env.GH_OWNER || 'muxriddin3626-droid';
const GH_REPO = process.env.GH_REPO || 'Boshqaruv';
const GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const ARTIFACTS = {
  agent: 'remote-agent-debug-apk',
  controller: 'remote-controller-debug-apk'
};

// Oddiy keshlash (5 daqiqa) - har so'rovda GitHub'ga bormaslik uchun
const cache = {}; // artifactName -> { buf, ts }
const CACHE_MS = 5 * 60 * 1000;

async function fetchLatestApk(artifactName) {
  if (!GH_TOKEN) throw new Error('Serverda GITHUB_TOKEN sozlanmagan');
  const c = cache[artifactName];
  if (c && Date.now() - c.ts < CACHE_MS) return c.buf;

  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'remote-control-backend'
  };

  // 1) Shu nomli eng yangi (muddati o'tmagan) artifaktni topamiz
  const listUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/artifacts?name=${encodeURIComponent(artifactName)}&per_page=100`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) throw new Error(`Artifact ro'yxati (${listRes.status})`);
  const data = await listRes.json();
  const arts = (data.artifacts || [])
    .filter(a => !a.expired)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!arts.length) throw new Error('Artifact topilmadi (avval build o\'tishi kerak)');

  // 2) Zip'ni yuklab olamiz (GitHub blob'ga redirect qiladi - fetch o'zi kuzatadi)
  const zipUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/artifacts/${arts[0].id}/zip`;
  const zipRes = await fetch(zipUrl, { headers });
  if (!zipRes.ok) throw new Error(`Zip yuklab olish (${zipRes.status})`);
  const zipBuf = Buffer.from(await zipRes.arrayBuffer());

  // 3) Zip ichidan .apk ni ajratamiz
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipBuf);
  const entry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith('.apk'));
  if (!entry) throw new Error('Zip ichida APK topilmadi');
  const apk = entry.getData();

  cache[artifactName] = { buf: apk, ts: Date.now() };
  return apk;
}

function page() {
  const ready = GH_TOKEN ? '' : `
    <div class="warn">⚠️ Server hali to'liq sozlanmagan (GITHUB_TOKEN yo'q).
    Yuklab olish ishlashi uchun egasi Render'da tokenni qo'shishi kerak.</div>`;
  return `<!doctype html>
<html lang="uz"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Masofaviy yordam — ilovani o'rnatish</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; font-family:-apple-system,Segoe UI,Roboto,sans-serif; background:#0d1917; color:#eaf2f0; }
  .wrap { max-width:460px; margin:0 auto; padding:28px 20px 48px; }
  .shield { font-size:46px; text-align:center; margin:18px 0 6px; }
  h1 { font-size:22px; text-align:center; margin:0 0 6px; }
  p.sub { text-align:center; color:#9fb3b0; font-size:14px; margin:0 0 26px; }
  a.btn { display:block; text-align:center; text-decoration:none; font-weight:600;
          padding:16px; border-radius:14px; margin:12px 0; }
  a.primary { background:#0f5c5c; color:#fff; }
  a.secondary { background:transparent; color:#4e8c8c; border:1px solid #2c4340; font-weight:500; }
  ol { color:#cfe0dd; font-size:14px; line-height:1.7; padding-left:20px; }
  .card { background:#132320; border:1px solid #1b2e2a; border-radius:16px; padding:16px 18px; margin:22px 0; }
  .warn { background:#3a2a10; border:1px solid #6b4d16; color:#ffcf8f; padding:12px 14px; border-radius:12px; font-size:13px; margin:16px 0; }
  .muted { color:#7d918e; font-size:12px; text-align:center; margin-top:28px; line-height:1.6; }
</style></head>
<body><div class="wrap">
  <div class="shield">🛡️</div>
  <h1>Masofaviy yordam</h1>
  <p class="sub">Ekraningizni ishonchli odamga ko'rsatish uchun ilovani o'rnating.</p>
  ${ready}

  <a class="btn primary" href="/download/agent.apk">📲 Ilovani yuklab olish (Agent)</a>

  <div class="card">
    <b>O'rnatish:</b>
    <ol>
      <li>Yuqoridagi tugmani bosing — <b>app-debug.apk</b> yuklanadi.</li>
      <li>Yuklangan faylni bosing.</li>
      <li>"Noma'lum manbalardan o'rnatish"ga <b>ruxsat bering</b>.</li>
      <li>Ilovani oching → ro'yxatdan o'ting.</li>
      <li>Boshqaruvchi ulanganda <b>"Ruxsat berish"</b> tugmasini bosing.</li>
    </ol>
  </div>

  <a class="btn secondary" href="/download/controller.apk">Men boshqaruvchiman — Controller ilovasi</a>

  <p class="muted">Bu ilova faqat siz <b>ruxsat berganingizda</b> ishlaydi.
  Ekran uzatilayotganda doimiy bildirishnoma ko'rinadi va istalgan vaqtda
  to'xtatishingiz mumkin.</p>
</div></body></html>`;
}

function mountDownloadRoutes(app) {
  app.get(['/get', '/'], (req, res) => {
    res.type('html').send(page());
  });

  const serve = (which) => async (req, res) => {
    const artifactName = ARTIFACTS[which];
    try {
      const apk = await fetchLatestApk(artifactName);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${which}-app-debug.apk"`);
      res.send(apk);
    } catch (e) {
      res.status(503).type('html').send(
        `<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">` +
        `APK hozircha mavjud emas: ${e.message}.<br><br>` +
        `<a href="/get">Orqaga</a></p>`
      );
    }
  };

  app.get('/download/agent.apk', serve('agent'));
  app.get('/download/controller.apk', serve('controller'));
}

module.exports = { mountDownloadRoutes };
