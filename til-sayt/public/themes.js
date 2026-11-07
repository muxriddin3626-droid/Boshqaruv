// Lug'at bo'limi mavzulari. Bu fayl ham brauzerda, ham serverda ishlatiladi.
(function (root) {
  const THEMES = [
    { id: 'basics', icon: '⭐', title: "Eng kerakli so'zlar", topic: "kundalik hayotda eng ko'p ishlatiladigan so'zlar: olmoshlar, savol so'zlari, ha/yo'q, iltimos, rahmat, bor/yo'q, yaxshi/yomon" },
    { id: 'greet', icon: '👋', title: 'Salomlashish va odob', topic: "salomlashish, xayrlashish, tanishuv, uzr so'rash, minnatdorchilik, muloyim iboralar" },
    { id: 'verbs', icon: '🏃', title: "Eng kerakli fe'llar", topic: "eng ko'p ishlatiladigan fe'llar: bormoq, kelmoq, qilmoq, yemoq, ichmoq, ishlamoq, gapirmoq, bilmoq, xohlamoq va boshqalar" },
    { id: 'adjectives', icon: '🎨', title: 'Sifatlar va ranglar', topic: "eng kerakli sifatlar (katta/kichik, issiq/sovuq, yangi/eski, arzon/qimmat) va ranglar" },
    { id: 'numbers', icon: '🔢', title: 'Raqamlar va vaqt', topic: "sonlar, soat, kunlar, oylar, bugun/ertaga/kecha, vaqt iboralari" },
    { id: 'family', icon: '👨‍👩‍👧', title: 'Oila va odamlar', topic: "oila a'zolari, qarindoshlar, yosh, odamlarni tasvirlash" },
    { id: 'body', icon: '🫀', title: "Tana va sog'liq", topic: "tana a'zolari, kasalliklar, og'riq, shifokorga aytiladigan iboralar" },
    { id: 'hospital', icon: '🏥', title: 'Kasalxona va dorixona', topic: "kasalxona, shifokor, dori, retsept, sug'urta, tez yordam" },
    { id: 'food', icon: '🍲', title: 'Ovqat va ichimliklar', topic: "taomlar, mevalar, sabzavotlar, ichimliklar, ta'm, oshxona buyumlari" },
    { id: 'shop', icon: '🛒', title: "Do'kon va pul", topic: "xarid qilish, narx, pul, chegirma, kassa, o'lchov birliklari" },
    { id: 'home', icon: '🏠', title: 'Uy va jihozlar', topic: "uy xonalari, mebel, maishiy texnika, ijara, kommunal to'lovlar" },
    { id: 'clothes', icon: '👕', title: 'Kiyim', topic: "kiyim-kechak, poyabzal, o'lcham, rang, kiyinish" },
    { id: 'city', icon: '🚌', title: 'Shahar va transport', topic: "shahardagi joylar, transport turlari, chipta, yo'l so'rash, yo'nalishlar" },
    { id: 'work', icon: '💼', title: 'Ish va kasblar', topic: "kasblar, ish joyi, ish haqi, ish vaqti, shartnoma, ta'til" },
    { id: 'safety', icon: '⛑️', title: 'Ish joyi va xavfsizlik', topic: "ish joyidagi xavfsizlik: ogohlantirish belgilari, himoya vositalari, xavfli holatlar, buyruqlar (to'xta, ehtiyot bo'l)" },
    { id: 'construction', icon: '🏗️', title: 'Qurilish', topic: "qurilish materiallari, asboblar, qurilish ishlari, o'lchash" },
    { id: 'factory', icon: '🏭', title: 'Zavod va ombor', topic: "zavod, stanok, konveyer, ombor, yuk, qadoqlash, smena" },
    { id: 'docs', icon: '📄', title: 'Hujjatlar va idoralar', topic: "pasport, viza, ro'yxatdan o'tish, ariza, bank, migratsiya idorasi" },
    { id: 'phone', icon: '📱', title: 'Telefon va internet', topic: "telefon, xabar, internet, ilovalar, qo'ng'iroq qilish iboralari" },
    { id: 'daily', icon: '⏰', title: 'Kun tartibi', topic: "uyg'onishdan uxlashgacha kundalik ishlar, odatlar" },
    { id: 'weather', icon: '🌦️', title: "Ob-havo va tabiat", topic: "ob-havo, fasllar, tabiat, harorat" },
    { id: 'feelings', icon: '😊', title: "His-tuyg'ular", topic: "his-tuyg'ular, kayfiyat, xarakter" },
    { id: 'travel', icon: '✈️', title: 'Sayohat', topic: "aeroport, mehmonxona, chipta, bagaj, sayohat iboralari" },
    { id: 'sport', icon: '⚽', title: "Sport va hordiq", topic: "sport turlari, sevimli mashg'ulotlar, dam olish" },
    { id: 'animals', icon: '🐾', title: 'Hayvonlar', topic: "uy va yovvoyi hayvonlar, qushlar" },
    { id: 'study', icon: '🎓', title: "O'qish va maktab", topic: "maktab, universitet, darslar, o'quv buyumlari" },
  ];

  const API = { THEMES, byId: (id) => THEMES.find((t) => t.id === id) || null, PACK_SIZE: 20 };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.THEMES = API;
})(typeof window !== 'undefined' ? window : globalThis);
