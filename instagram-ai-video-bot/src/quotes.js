// Motivatsion iqtiboslar ro'yxati. Har biri fon video qidirish uchun
// "mood" (kalit so'z, Pexels'dan inglizcha qidiriladi) bilan birga keladi.
const QUOTES = [
  { text: "Har bir kun - yangi imkoniyat. Uni qo'ldan boy berma.", mood: "sunrise motivation" },
  { text: "Muvaffaqiyat sabr qilganlarning mukofoti.", mood: "mountain climb" },
  { text: "Kichik qadamlar katta yo'lni bosib o'tadi.", mood: "walking path" },
  { text: "Qiyinchilik - kuchli bo'lishing uchun berilgan imtihon.", mood: "storm ocean" },
  { text: "Orzuing kattaligicha harakat qil.", mood: "sky clouds" },
  { text: "Bugun qilgan mehnating ertangi natijang.", mood: "sunset work" },
  { text: "O'zingga ishon, boshqalar keyin ishonadi.", mood: "confidence city" },
  { text: "Har bir mag'lubiyat - yangi saboq.", mood: "rain window" },
  { text: "Vaqtni behuda ketkazma, u qaytmaydi.", mood: "clock time" },
  { text: "Maqsading aniq bo'lsa, yo'ling ham aniq bo'ladi.", mood: "road forest" },
  { text: "Kurashni to'xtatma, g'alaba yaqin.", mood: "runner sunrise" },
  { text: "Sen o'ylaganingdan ancha kuchlisan.", mood: "strong ocean waves" },
  { text: "Har bir tong - yangi boshlanish.", mood: "morning light" },
  { text: "Boshla, mukammal bo'lishi shart emas.", mood: "start journey" },
  { text: "Sabr - muvaffaqiyat kalitidir.", mood: "calm nature" },
  { text: "Katta orzular kichik harakatlardan boshlanadi.", mood: "seed growing" },
  { text: "O'zgarish qiyin, lekin turg'unlik battar.", mood: "wind trees" },
  { text: "Bugun harakat qil, ertaga minnatdor bo'lasan.", mood: "city lights" },
  { text: "Qo'rquv - faqat harakat qilmasang g'olib chiqadi.", mood: "cliff jump" },
  { text: "Sening vaqting hozir.", mood: "clock sunrise" },
];

// moodScores - ixtiyoriy {mood: o'rtacha_engagement_darajasi} xaritasi
// (src/analytics.js dan keladi, Instagram'da haqiqatda joylangan
// postlarning natijalariga asoslanadi). Berilsa, yaxshi natija bergan
// mood'lar ko'proq ehtimol bilan tanlanadi; berilmasa (yoki hali yetarli
// tarix bo'lmasa) - hammasi teng ehtimollik bilan tanlanadi.
function pickQuote(usedIndexes = [], moodScores = {}) {
  const available = QUOTES.map((q, i) => i).filter((i) => !usedIndexes.includes(i));
  const pool = available.length > 0 ? available : QUOTES.map((_, i) => i);

  const scores = pool.map((i) => moodScores[QUOTES[i].mood]);
  const known = scores.filter((s) => typeof s === 'number');
  let weights;
  if (known.length >= 3) {
    const min = Math.min(...known);
    const max = Math.max(...known);
    weights = scores.map((s) => {
      if (typeof s !== 'number') return 1; // hali natijasi noma'lum mood - o'rtacha imkoniyat
      const normalized = max > min ? (s - min) / (max - min) : 0.5;
      return 0.5 + normalized * 1.5; // eng yomoni x0.5, eng yaxshisi x2
    });
  } else {
    weights = pool.map(() => 1); // tarix hali kam - sof tasodifiy tanlov
  }

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let chosen = pool[pool.length - 1];
  for (let k = 0; k < pool.length; k++) {
    r -= weights[k];
    if (r <= 0) {
      chosen = pool[k];
      break;
    }
  }

  return { index: chosen, ...QUOTES[chosen] };
}

module.exports = { QUOTES, pickQuote };
