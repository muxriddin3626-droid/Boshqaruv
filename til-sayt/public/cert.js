// Til Ustoz yutuq sertifikati: kursning bir darajasi (A1, A2, B1) to'liq tugatilganda
// ism yozilgan sertifikat rasmini chizadi. Bu rasmiy til sertifikati emas.
window.Cert = (() => {
  const App = window.App;
  const C = window.COURSE;
  const Learn = window.Learn;
  const $ = (id) => document.getElementById(id);
  const LEVELS = ['A1', 'A2', 'B1'];
  const LANG_NAMES = { ru: 'Rus tili', de: 'Nemis tili', ko: 'Koreys tili' };
  const NAME_KEY = 'tu-name';
  const certsKey = () => `tu-certs-${App.lang()}`;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function levelUnits(level) {
    return C.UNITS.filter((u) => u.level === level);
  }

  function levelProgress(level) {
    const progress = Learn.courseProgress(App.lang());
    const units = levelUnits(level);
    const done = units.filter((u) => (progress[u.id] || {}).exam).length;
    return { done, total: units.length, earned: done === units.length };
  }

  // Sana: 14.10.2026 ko'rinishida.
  function fmtDate(t) {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }

  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // Yangi qo'lga kiritilgan sertifikatlarni saqlaydi va xabar beradi.
  function checkNew() {
    const certs = App.loadStored(certsKey()) || {};
    let added = null;
    for (const level of LEVELS) {
      if (!certs[level] && levelProgress(level).earned) {
        certs[level] = { date: Date.now(), code: `TU-${App.lang().toUpperCase()}-${level}-${randomCode()}` };
        added = level;
      }
    }
    if (added) {
      App.store(certsKey(), certs);
      window.Practice.toast(`📜 Tabriklaymiz! ${added} darajasi sertifikati tayyor — "Sertifikatlar" bo'limida`, 4000);
    }
    return certs;
  }

  // ---------- Sertifikatlar ekrani ----------

  let selected = null;

  function open() {
    const certs = checkNew();
    $('certName').value = window.Store.get(NAME_KEY, '') || '';
    const list = $('certList');
    list.textContent = '';
    for (const level of LEVELS) {
      const p = levelProgress(level);
      const cert = certs[level];
      const item = el('button', `cert-item${cert ? ' earned' : ''}`);
      item.type = 'button';
      item.appendChild(el('span', 'cert-badge', cert ? '📜' : '🔒'));
      const t = el('span', 'act-text');
      t.appendChild(el('span', 'act-title', `${LANG_NAMES[App.lang()]} — ${level}`));
      t.appendChild(
        el(
          'span',
          'act-desc',
          cert
            ? `Olingan: ${fmtDate(cert.date)} · ko'rish uchun bosing`
            : `${p.done}/${p.total} bosqich imtihoni topshirilgan`
        )
      );
      item.appendChild(t);
      item.disabled = !cert;
      item.addEventListener('click', () => show(level));
      list.appendChild(item);
    }
    $('certPreview').hidden = true;
    selected = null;
    App.show('cert');
  }

  function show(level) {
    const name = $('certName').value.trim();
    if (!name) {
      $('certName').focus();
      window.Practice.toast('✏️ Avval ism-familiyangizni yozing');
      return;
    }
    window.Store.set(NAME_KEY, name);
    selected = level;
    draw(level, name);
    $('certPreview').hidden = false;
    $('certPreview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('certName').addEventListener('change', () => {
    if (selected) show(selected);
  });

  // ---------- Chizish ----------

  function wrap(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = w;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(level, name) {
    const canvas = $('certCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cert = (App.loadStored(certsKey()) || {})[level];
    const tutor = App.tutor();
    const ink = '#23262b';
    const gold = '#b8892d';
    const green = '#2fb36d';
    const serif = 'Georgia, "Times New Roman", serif';
    const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    // Fon va ramka
    ctx.fillStyle = '#fbf8f1';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 10;
    ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.lineWidth = 2;
    ctx.strokeRect(62, 62, W - 124, H - 124);
    // Burchak bezaklari
    ctx.fillStyle = gold;
    for (const [x, y] of [[62, 62], [W - 62, 62], [62, H - 62], [W - 62, H - 62]]) {
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ustoz yuzchasi (xursand)
    const fx = W / 2 - 70;
    const fy = 110;
    roundRect(ctx, fx, fy, 140, 72, 36);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = green;
    ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (const ex of [fx + 45, fx + 95]) {
      ctx.beginPath();
      ctx.moveTo(ex - 11, fy + 36);
      ctx.quadraticCurveTo(ex, fy + 22, ex + 11, fy + 36);
      ctx.stroke();
    }
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(fx + 56, fy + 46);
    ctx.quadraticCurveTo(fx + 70, fy + 64, fx + 84, fy + 46);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = gold;
    ctx.font = `600 26px ${sans}`;
    ctx.fillText('T I L   U S T O Z', W / 2, 232);

    ctx.fillStyle = ink;
    ctx.font = `bold 76px ${serif}`;
    ctx.fillText('YUTUQ SERTIFIKATI', W / 2, 330);

    ctx.font = `30px ${serif}`;
    ctx.fillStyle = '#5f6670';
    ctx.fillText('Ushbu sertifikat', W / 2, 400);

    // Ism
    let size = 86;
    ctx.font = `italic bold ${size}px ${serif}`;
    while (ctx.measureText(name).width > W - 360 && size > 40) {
      size -= 4;
      ctx.font = `italic bold ${size}px ${serif}`;
    }
    ctx.fillStyle = ink;
    ctx.fillText(name, W / 2, 500);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(300, 530);
    ctx.lineTo(W - 300, 530);
    ctx.stroke();

    const units = levelUnits(level);
    ctx.font = `32px ${serif}`;
    ctx.fillStyle = '#3a3f46';
    wrap(
      ctx,
      `${LANG_NAMES[App.lang()].toLowerCase()} kursining ${level} darajasini — ${units.length} ta bosqich va ularning imtihonlarini — muvaffaqiyatli tugatgani uchun beriladi.`,
      W / 2,
      595,
      W - 440,
      46
    );
    ctx.font = `italic 26px ${serif}`;
    ctx.fillStyle = '#6b7178';
    wrap(ctx, units.map((u) => u.title).join(' · '), W / 2, 700, W - 400, 36);

    // Muhr
    const sx = W / 2;
    const sy = 880;
    ctx.fillStyle = gold;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24;
      const r = i % 2 ? 78 : 88;
      ctx.lineTo(sx + r * Math.cos(a), sy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fbf8f1';
    ctx.beginPath();
    ctx.arc(sx, sy, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.font = `bold 52px ${serif}`;
    ctx.fillText(level, sx, sy + 12);
    ctx.font = `bold 15px ${sans}`;
    ctx.fillText(LANG_NAMES[App.lang()].toUpperCase(), sx, sy + 40);

    // Sana va imzo
    const date = fmtDate(cert ? cert.date : Date.now());
    ctx.fillStyle = ink;
    ctx.font = `28px ${serif}`;
    ctx.fillText(date, 340, 880);
    ctx.font = `italic 46px ${serif}`;
    ctx.fillText(tutor.name, W - 340, 872);
    ctx.strokeStyle = '#9aa0a6';
    ctx.lineWidth = 2;
    for (const x of [340, W - 340]) {
      ctx.beginPath();
      ctx.moveTo(x - 150, 898);
      ctx.lineTo(x + 150, 898);
      ctx.stroke();
    }
    ctx.fillStyle = '#6b7178';
    ctx.font = `22px ${sans}`;
    ctx.fillText('Berilgan sana', 340, 930);
    ctx.fillText('Ustoz', W - 340, 930);

    ctx.font = `20px ${sans}`;
    ctx.fillText(`№ ${cert ? cert.code : ''}`, W / 2, 1000);
    ctx.font = `18px ${sans}`;
    ctx.fillStyle = '#8a8f96';
    ctx.fillText(
      "Bu rasmiy til sertifikati emas — Til Ustoz ilovasidagi o'quv yutug'ini tasdiqlaydi. Rasmiy sertifikat: ТРКИ / Goethe-Zertifikat / TOPIK.",
      W / 2,
      1040
    );
  }

  function toFile() {
    return new Promise((resolve) => {
      $('certCanvas').toBlob((blob) => {
        resolve(new File([blob], `til-ustoz-sertifikat-${App.lang()}-${selected}.png`, { type: 'image/png' }));
      }, 'image/png');
    });
  }

  $('certDownload').addEventListener('click', async () => {
    const file = await toFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });

  $('certShare').addEventListener('click', async () => {
    const file = await toFile();
    const text = `Men Til Ustoz'da ${LANG_NAMES[App.lang()].toLowerCase()} ${selected} darajasini tugatdim! 🎓`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
      } catch {}
    } else {
      window.Practice.toast("Bu brauzerda ulashib bo'lmaydi — yuklab olib, o'zingiz yuboring");
    }
  });

  $('certBtn').addEventListener('click', open);

  return { open, checkNew };
})();
