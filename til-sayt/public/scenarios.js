// Kasbiy kurslar va rolli vaziyatlar. Bu fayl ham brauzerda, ham serverda ishlatiladi.
// Har kasbda 4 ta mavzu; har mavzuda o'z rolli vaziyati bor.
(function (root) {
  const COUNTRY = "o'rganilayotgan til mamlakatida (rus tili bo'lsa — Rossiyada, nemis tili bo'lsa — Germaniyada)";

  const PROFESSIONS = [
    {
      id: 'builder',
      icon: '👷',
      title: 'Quruvchi',
      themes: [
        { id: 'tools', title: 'Asboblar va materiallar', topic: "qurilish asboblari (bolg'a, drel, arra, narvon), materiallar (g'isht, sement, taxta), o'lchov birliklari", role: "brigadirsan, yangi ishchidan kerakli asbob va materiallarni olib kelishni so'raysan", goal: "brigadir so'ragan 3 ta asbob yoki materialni tushunib, borligini yoki yo'qligini aytish va qayerdan olishni so'rash" },
        { id: 'safety', title: 'Xavfsizlik texnikasi', topic: "kaska, xavfsizlik kamari, qo'lqop, ehtiyot bo'l, xavfli, taqiqlangan, jarohat", role: "xavfsizlik bo'yicha muhandissan, ishchini kaskasiz ko'rib qolding", goal: "xatoni tan olish, qoidalarni tushunganini aytish va jarohat bo'lsa nima qilishni so'rash" },
        { id: 'boss', title: 'Brigadir bilan suhbat', topic: "ish vazifasi, ish vaqti, tanaffus, smena, kechikish, ruxsat so'rash", role: "brigadirsan, ishchi ertaga ishga kela olmasligini aytmoqchi", goal: "nima uchun kela olmasligini tushuntirish va ruxsat olish yoki boshqa kunga kelishib olish" },
        { id: 'salary', title: 'Ish haqi va hujjatlar', topic: "ish haqi, avans, shartnoma, patent, soatlik to'lov, qo'shimcha ish", role: "kompaniya hisobchisisan, ishchi oyligi to'liq to'lanmaganini aytmoqda", goal: "qancha pul kam to'langanini va qaysi kunlar ishlaganini tushuntirib, qachon to'lanishini aniqlab olish" },
      ],
    },
    {
      id: 'driver',
      icon: '🚕',
      title: 'Haydovchi (taksi, yuk)',
      themes: [
        { id: 'city', title: "Shahar va yo'llar", topic: "manzil, ko'cha, chorraha, burilish, to'g'ri, chapga, o'ngga, tirbandlik", role: "taksi yo'lovchisisan, manzilni og'zaki tushuntirasan va yo'lda fikringni o'zgartirasan", goal: "manzilni aniqlashtirish, yo'lni tasdiqlash va yangi manzilga borishni kelishib olish" },
        { id: 'passenger', title: "Yo'lovchi bilan muloqot", topic: "salomlashish, narx, to'lov (naqd, karta), kutish, yuk, xayrlashish", role: "yo'lovchisan, narxdan norozisan va karta bilan to'lamoqchisan", goal: "narxni tushuntirish, to'lov usulini kelishish va muloyim xayrlashish" },
        { id: 'police', title: "YPX (DPS/Polizei) tekshiruvi", topic: "haydovchilik guvohnomasi, texpasport, sug'urta, tezlik, jarima", role: "yo'l harakati politsiyachisisan, mashinani to'xtatding", goal: "hujjatlarni ko'rsatish, nima uchun to'xtatilganini tushunish va muloyim javob berish" },
        { id: 'car', title: 'Mashina va texnik xizmat', topic: "g'ildirak, yoqilg'i, moy, tormoz, buzildi, ustaxona, ehtiyot qism", role: "avtoustaxona ustasisan, haydovchi mashinasidagi muammoni tushuntirmoqda", goal: "muammoni tasvirlash, narx va qachon tayyor bo'lishini so'rash" },
      ],
    },
    {
      id: 'cook',
      icon: '👨‍🍳',
      title: 'Oshpaz va ofitsiant',
      themes: [
        { id: 'kitchen', title: 'Oshxona so\'zlari', topic: "mahsulotlar, idishlar, pishirish usullari (qovurish, qaynatish), ziravorlar", role: "bosh oshpazsan, yordamchiga buyurtma uchun nima tayyorlashni aytasan", goal: "topshiriqni tushunish, kerakli mahsulot yetishmasa aytish va aniqlashtiruvchi savol berish" },
        { id: 'order', title: 'Buyurtma qabul qilish', topic: "menyu, buyurtma, ichimlik, hisob, choychaqa, tavsiya qilish", role: "restoran mijozisan, menyu haqida savol berasan va buyurtma berasan", goal: "salomlashish, taom tavsiya qilish, buyurtmani to'g'ri yozib olish va takrorlab tasdiqlash" },
        { id: 'complaint', title: 'Mijoz shikoyati', topic: "sovuq, sho'r, kech qoldi, uzr, almashtirish, chegirma", role: "noroziy mijozsan, taoming sovuq va kech keldi", goal: "uzr so'rash, muammoni hal qilish yo'lini taklif qilish va mijozni tinchlantirish" },
        { id: 'hygiene', title: 'Gigiyena va qoidalar', topic: "qo'l yuvish, forma, yaroqlilik muddati, muzlatkich, tozalik", role: "sanitariya tekshiruvchisisan, oshxonani tekshirmoqdasan", goal: "savollarga javob berish va qoidalarga qanday rioya qilinishini tushuntirish" },
      ],
    },
    {
      id: 'seller',
      icon: '🛒',
      title: 'Sotuvchi va kassir',
      themes: [
        { id: 'goods', title: 'Mahsulot va narx', topic: "mahsulot turlari, narx, chegirma, aksiya, o'lcham, rang", role: "xaridorsan, kerakli mahsulotni qidirmoqdasan va narxini so'raysan", goal: "mahsulot qayerdaligini aytish, narx va chegirmani tushuntirish" },
        { id: 'cashier', title: 'Kassada', topic: "to'lov, naqd, karta, qaytim, chek, paket, keshbek", role: "kassadagi xaridorsan, kartang o'tmayapti", goal: "muammoni tushuntirish, boshqa to'lov usulini taklif qilish va xaridni yakunlash" },
        { id: 'return', title: 'Qaytarish va almashtirish', topic: "nuqson, qaytarish, almashtirish, chek, kafolat", role: "xaridorsan, kecha olgan narsang buzuq chiqdi va pulingni qaytarmoqchisan", goal: "chekni so'rash, qoidani tushuntirish va almashtirish yoki qaytarishni rasmiylashtirish" },
        { id: 'stock', title: 'Ombor va tovar qabul qilish', topic: "yetkazib berish, qutilar, soni, hisob-faktura, yetishmaydi, imzo", role: "yetkazib beruvchi haydovchisan, tovarni topshirmoqdasan", goal: "tovar sonini tekshirish, yetishmovchilikni aytish va hujjatga imzo qo'yishni kelishish" },
      ],
    },
    {
      id: 'courier',
      icon: '📦',
      title: 'Kuryer va omborchi',
      themes: [
        { id: 'address', title: 'Manzil va yetkazish', topic: "manzil, kirish (podyezd), qavat, domofon, kod, kech qolish", role: "buyurtma bergan mijozsan, kuryer uyingni topa olmayapti va telefon qilmoqda", goal: "telefonda manzilni aniqlash va buyurtmani topshirish vaqtini kelishish" },
        { id: 'client', title: 'Mijozga topshirish', topic: "buyurtma raqami, to'lov, imzo, shikastlangan quti, baho berish", role: "mijozsan, qutini ochib ichidagi narsa shikastlanganini ko'rding", goal: "vaziyatni tushuntirish, nima qilish kerakligini aytish va muloyim yakunlash" },
        { id: 'warehouse', title: 'Omborda ishlash', topic: "javon, qator, yuklash, tushirish, skaner, inventarizatsiya, og'ir", role: "ombor mudirisan, ishchiga qaysi tovarlarni qayerga qo'yishni aytasan", goal: "topshiriqni tushunish, aniqlashtirish va bajarilganini xabar qilish" },
        { id: 'shift', title: 'Smena va ish jadvali', topic: "smena, kunduzgi, tungi, dam olish kuni, almashish, ortiqcha soat", role: "menejersan, ishchi smenani almashtirmoqchi", goal: "qaysi smenani nima uchun almashtirmoqchi ekanini tushuntirib, kelishib olish" },
      ],
    },
    {
      id: 'nurse',
      icon: '🧑‍⚕️',
      title: 'Hamshira va parvarishchi',
      themes: [
        { id: 'body', title: "Tana va kasalliklar", topic: "tana a'zolari, og'riq, harorat, bosim, dori, allergiya", role: "bemorsan, o'zingni yomon his qilyapsan", goal: "qayeri og'riyotganini so'rash, harorat va bosimni o'lchashni aytish va shifokorni chaqirishni tushuntirish" },
        { id: 'care', title: 'Keksalarni parvarish qilish', topic: "ovqatlantirish, dori ichish vaqti, yurish, cho'milish, yordam", role: "parvarishdagi keksa odamsan, dori ichishni xohlamaysan", goal: "muloyimlik bilan nima uchun dori kerakligini tushuntirish va ichishga ko'ndirish" },
        { id: 'family', title: 'Qarindoshlar bilan suhbat', topic: "ahvoli, yaxshilandi, tashrif vaqti, tavsiya, xavotir", role: "bemorning qizisan, onangning ahvolini so'raysan", goal: "ahvolni oddiy so'zlarda tushuntirish va tashrif vaqtini aytish" },
        { id: 'emergency', title: 'Shoshilinch holat', topic: "tez yordam, 112, hushidan ketdi, nafas, qon, manzil", role: "tez yordam dispetcherisan, qo'ng'iroqni qabul qilmoqdasan", goal: "nima bo'lganini, manzilni va bemor ahvolini aniq aytish" },
      ],
    },
    {
      id: 'factory',
      icon: '🏭',
      title: 'Zavod ishchisi',
      themes: [
        { id: 'machines', title: 'Stanok va jihozlar', topic: "stanok, tugma, yoqish, o'chirish, sozlash, buzildi, ehtiyot bo'l", role: "usta (master)san, yangi ishchiga stanokni qanday ishlatishni ko'rsatasan", goal: "ko'rsatmalarni tushunish, takrorlab tasdiqlash va tushunmaganini so'rash" },
        { id: 'quality', title: 'Sifat nazorati', topic: "brak, nuqson, o'lcham, tekshirish, qayta ishlash, norma", role: "sifat nazoratchisisan, ishchining mahsulotida nuqson topding", goal: "nuqson sababini tushuntirish va qanday tuzatishni kelishish" },
        { id: 'shift', title: 'Smena va norma', topic: "smena, norma, reja, tanaffus, ortiqcha ish, bonus", role: "smena boshlig'isan, ishchi normani bajarmadi", goal: "sababini tushuntirish va keyingi smenada qanday bajarishini aytish" },
        { id: 'injury', title: 'Jarohat va kasallik varaqasi', topic: "jarohat, birinchi yordam, shifokor, kasallik varaqasi (bolnichniy/Krankmeldung)", role: "kadrlar bo'limi xodimisan, ishchi kasal bo'lib ishga kelolmasligini aytmoqda", goal: "nima bo'lganini tushuntirish va qanday hujjat kerakligini so'rash" },
      ],
    },
    {
      id: 'cleaner',
      icon: '🧹',
      title: 'Tozalash va xizmat ko\'rsatish',
      themes: [
        { id: 'supplies', title: 'Tozalash vositalari', topic: "chang yutgich, latta, chelak, yuvish vositasi, qo'lqop, axlat", role: "xo'jayinsan, tozalovchiga qaysi xonani qanday tozalashni aytasan", goal: "topshiriqni tushunish va kerakli vositalar yetishmasa aytish" },
        { id: 'hotel', title: 'Mehmonxonada', topic: "xona, choyshab, sochiq, mini-bar, mehmon, bezovta qilmang", role: "mehmonxona mehmonisan, xonangdagi muammo haqida aytasan", goal: "muammoni tushunish, uzr so'rash va qachon hal qilinishini aytish" },
        { id: 'schedule', title: 'Ish jadvali va kalitlar', topic: "kalit, signalizatsiya, ish vaqti, kech qolish, ogohlantirish", role: "ofis menejerisan, kalit va ish vaqti haqida kelishasan", goal: "ish vaqtini va kalitni qayerdan olishni aniqlashtirish" },
        { id: 'pay', title: "To'lov va shartnoma", topic: "soatlik to'lov, shartnoma, bayram kunlari, qo'shimcha ish", role: "ish beruvchisan, tozalovchi ish haqini oshirishni so'ramoqda", goal: "nima uchun ko'proq to'lov kerakligini muloyim asoslab, kelishib olish" },
      ],
    },
  ];

  // Umumiy hayotiy vaziyatlar.
  const SCENARIOS = [
    { id: 'police', icon: '👮', title: 'Politsiya hujjat tekshiruvi', role: `ko'chada hujjat tekshirayotgan politsiyachisan ${COUNTRY}`, goal: "salomlashish, hujjatlarni (pasport, patent yoki vizasi, ro'yxatdan o'tganlik) ko'rsatish, qayerda ishlashini va yashashini muloyim aytish" },
    { id: 'salary', icon: '💸', title: 'Ish haqi to\'lanmayapti', role: "ish beruvchisan, ishchiga ikki haftadan beri oylik to'lamagansan va bahona qilasan", goal: "qancha va qachondan beri to'lanmaganini aytish, aniq to'lov sanasini so'rash va o'z huquqini muloyim, lekin qat'iy himoya qilish" },
    { id: 'flat', icon: '🏠', title: 'Kvartira ijarasi', role: "kvartira egasisan, ijaraga beryapsan", goal: "narx, kommunal to'lovlar, depozit, nechta odam yashashi va ro'yxatdan o'tkazish (registratsiya/Anmeldung) haqida so'rab, kelishib olish" },
    { id: 'doctor', icon: '🩺', title: 'Shifokor qabulida', role: "poliklinika shifokorisan", goal: "qayeri og'riyotganini va qachondan beri ekanini aytish, shifokor savollariga javob berish va dori qanday ichilishini tushunib olish" },
    { id: 'office', icon: '🏢', title: 'Migratsiya xizmatida', role: `migratsiya xizmati (MFC/МВД yoki Ausländerbehörde) xodimisan ${COUNTRY}`, goal: "nima uchun kelganini aytish (masalan patent yoki ro'yxatdan o'tish), kerakli hujjatlarni so'rash va keyingi qadamni tushunib olish" },
    { id: 'bank', icon: '🏦', title: "Bank va pul o'tkazmasi", role: "bank xodimisan", goal: "karta ochish yoki uyga pul o'tkazish uchun nima kerakligini, komissiya va qancha vaqtda yetib borishini so'rab bilish" },
    { id: 'interview', icon: '💼', title: 'Ishga kirish suhbati', role: "kompaniya kadrlar menejerisan, ishga nomzod bilan suhbatlashasan", goal: "o'zini tanishtirish, tajriba va ko'nikmalarini aytish, ish vaqti va maosh haqida savol berish" },
    { id: 'shop', icon: '🧾', title: "Do'konda tovar qaytarish", role: "do'kon sotuvchisisan, qaytarishni unchalik xohlamaysan", goal: "tovardagi nuqsonni tushuntirish, chekni ko'rsatish va pulni qaytarish yoki almashtirishga erishish" },
  ];

  function findTheme(key) {
    const [profId, themeId] = String(key || '').split(':');
    const prof = PROFESSIONS.find((p) => p.id === profId);
    const theme = prof && prof.themes.find((t) => t.id === themeId);
    return theme ? { prof, theme } : null;
  }

  // Rolli vaziyat: "gen:police" yoki "prof:builder:salary".
  function findScenario(key) {
    const s = String(key || '');
    if (s.startsWith('gen:')) {
      const sc = SCENARIOS.find((x) => x.id === s.slice(4));
      return sc ? { key: s, icon: sc.icon, title: sc.title, role: sc.role, goal: sc.goal } : null;
    }
    if (s.startsWith('prof:')) {
      const found = findTheme(s.slice(5));
      if (!found) return null;
      const { prof, theme } = found;
      return {
        key: s,
        icon: prof.icon,
        title: `${prof.title}: ${theme.title}`,
        role: `${theme.role} (${COUNTRY}; o'quvchi — ${prof.title.toLowerCase()} bo'lib ishlaydi)`,
        goal: theme.goal,
      };
    }
    return null;
  }

  const API = { PROFESSIONS, SCENARIOS, findTheme, findScenario };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SCENARIOS = API;
})(typeof window !== 'undefined' ? window : globalThis);
