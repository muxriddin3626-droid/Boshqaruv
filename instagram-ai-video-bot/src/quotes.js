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

function pickQuote(usedIndexes = []) {
  const available = QUOTES.map((q, i) => i).filter((i) => !usedIndexes.includes(i));
  const pool = available.length > 0 ? available : QUOTES.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  return { index: idx, ...QUOTES[idx] };
}

module.exports = { QUOTES, pickQuote };
