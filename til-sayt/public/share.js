// Natijani chiroyli rasm (kartochka) qilib ulashish: daraja testi, streak, bugungi dars.
// Rasmda sayt manzili (va kirgan bo'lsa — taklif havolasi) turadi.
window.Share = (() => {
  const App = window.App;
  const W = 1080;
  const H = 1350;
  const THEMES = {
    sun: ['#ffbf3c', '#ff5a36'],
    plum: ['#5b3fd6', '#ff5a36'],
    teal: ['#0f8a86', '#2a9d5c'],
  };

  function wrap(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
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

  function link() {
    const me = window.AccountUI && window.AccountUI.me();
    const ref = me && me.user ? `/?ref=${me.user.refCode}` : '';
    return `${location.origin}${ref}`;
  }

  // card: { emoji, kicker, big, title, sub, theme }
  async function draw(card) {
    try {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
    } catch {}
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const [c1, c2] = THEMES[card.theme] || THEMES.plum;

    ctx.fillStyle = '#f4ede2';
    ctx.fillRect(0, 0, W, H);
    // Rangli yuqori qism
    const g = ctx.createLinearGradient(0, 0, W, 760);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    roundRect(ctx, 50, 50, W - 100, 760, 70);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.arc(W - 170, 190, 210, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(150, 720, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = "700 44px Unbounded, 'Onest', sans-serif";
    ctx.fillText(card.kicker || 'Til Ustoz', W / 2, 170);
    ctx.font = '170px serif';
    ctx.fillText(card.emoji || '🎉', W / 2, 390);
    ctx.font = "800 150px Unbounded, 'Onest', sans-serif";
    let size = 150;
    while (ctx.measureText(card.big).width > W - 220 && size > 60) {
      size -= 8;
      ctx.font = `800 ${size}px Unbounded, 'Onest', sans-serif`;
    }
    ctx.fillText(card.big, W / 2, 610);
    ctx.font = "600 46px 'Onest', sans-serif";
    ctx.fillText(card.title || '', W / 2, 710);

    // Pastki qism: izoh va manzil
    ctx.fillStyle = '#221b13';
    ctx.font = "500 46px 'Onest', sans-serif";
    wrap(ctx, card.sub || '', W - 200)
      .slice(0, 3)
      .forEach((line, i) => ctx.fillText(line, W / 2, 920 + i * 62));

    ctx.fillStyle = '#221b13';
    roundRect(ctx, 140, 1130, W - 280, 120, 60);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = "700 44px Unbounded, 'Onest', sans-serif";
    ctx.fillText(`tilustoz · ${location.host}`, W / 2, 1206);
    ctx.fillStyle = '#7d705f';
    ctx.font = "500 34px 'Onest', sans-serif";
    ctx.fillText("Ustoz bilan gaplashib til o'rganing — bepul boshlang", W / 2, 1300);
    return canvas;
  }

  async function share(card) {
    const canvas = await draw(card);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const text = `${card.text || card.sub || ''} ${link()}`.trim();
    const file = new File([blob], 'til-ustoz.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    // Ulashish imkoni yo'q bo'lsa — rasmni yuklab olamiz va matnni nusxalaymiz.
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'til-ustoz.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    try {
      await navigator.clipboard.writeText(text);
      window.Practice.toast('🖼️ Rasm yuklab olindi, havola nusxalandi');
    } catch {
      window.Practice.toast('🖼️ Rasm yuklab olindi');
    }
  }

  // Tayyor kartochkalar
  function streak() {
    const d = window.Learn.daily();
    const words = window.Learn.deckStats(App.lang()).total;
    const lang = App.tutor().lang;
    return share({
      emoji: '🔥',
      kicker: `${lang.replace(/^./, (c) => c.toUpperCase())}ni o'rganyapman`,
      big: `${d.streak} kun`,
      title: 'ketma-ket mashq',
      sub: `${words} ta so'z yodladim. Har kuni ustoz bilan gaplashib o'rganyapman!`,
      text: `Men Til Ustoz'da ${d.streak} kundan beri ${lang} o'rganyapman 🔥 Qo'shiling:`,
      theme: 'sun',
    });
  }

  function level(levelName, code) {
    const lang = App.tutor().lang;
    return share({
      emoji: '📊',
      kicker: `${lang.replace(/^./, (c) => c.toUpperCase())} · daraja testi`,
      big: code,
      title: levelName,
      sub: "Darajamni 5 daqiqada aniqladim. Siz ham sinab ko'ring — bepul!",
      text: `Mening ${lang} darajam: ${code}. O'zingiznikini tekshirib ko'ring:`,
      theme: 'plum',
    });
  }

  function planDone() {
    const d = window.Learn.daily();
    return share({
      emoji: '🎯',
      kicker: 'Bugungi dars',
      big: 'Bajarildi!',
      title: `🔥 ${d.streak} kun ketma-ket`,
      sub: "Takrorlash, yangi so'zlar, qoida va ustoz bilan suhbat — hammasi bugun bajarildi.",
      text: "Bugungi til darsimni bajardim 🎯 Siz ham boshlang:",
      theme: 'teal',
    });
  }

  return { share, draw, streak, level, planDone };
})();
