/**
 * Ommaviy yuklab olish sahifasi va APK'ni uzatish (TOKENSIZ).
 * ----------------------------------------------------------------
 * Maqsad: foydalanuvchi bitta havola (`.../get`) yuboradi; qabul qiluvchi uni
 * Chrome'da ochib, ilovani (Agent) yuklab oladi va o'rnatadi - GitHub hisobi
 * ham, hech qanday token ham kerak emas.
 *
 * APK fayllar CI (GitHub Actions) tomonidan build'dan keyin to'g'ridan-to'g'ri
 * backend/public/ papkasiga joylab qo'yiladi va Render deploy bilan birga keladi.
 * Shuning uchun bu yerda faqat diskdan o'qib uzatamiz.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function page() {
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
  .muted { color:#7d918e; font-size:12px; text-align:center; margin-top:28px; line-height:1.6; }
</style></head>
<body><div class="wrap">
  <div class="shield">🛡️</div>
  <h1>Masofaviy yordam</h1>
  <p class="sub">Ekraningizni ishonchli odamga ko'rsatish uchun ilovani o'rnating.</p>

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

  const serve = (which) => (req, res) => {
    const file = path.join(PUBLIC_DIR, `${which}.apk`);
    if (!fs.existsSync(file)) {
      return res.status(503).type('html').send(
        `<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">` +
        `APK hali tayyor emas (build davom etyapti bo'lishi mumkin). ` +
        `Bir necha daqiqadan keyin qayta urinib ko'ring.<br><br>` +
        `<a href="/get">Orqaga</a></p>`
      );
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${which}-app-debug.apk"`);
    fs.createReadStream(file).pipe(res);
  };

  app.get('/download/agent.apk', serve('agent'));
  app.get('/download/controller.apk', serve('controller'));
}

module.exports = { mountDownloadRoutes };
