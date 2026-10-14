// Kurs xaritasi: A1 dan B1 gacha bosqichlar. Bu fayl ham brauzerda, ham serverda
// ishlatiladi (server bosqich mavzusini Claude'ga aytish uchun shu yerdan oladi).
(function (root) {
  const UNITS = [
    {
      id: 'u1',
      level: 'A1',
      icon: '👋',
      title: 'Salomlashish va tanishuv',
      topic: "salomlashish, xayrlashish, ism va qayerdan ekanini aytish",
      grammar: {
        ru: 'Меня зовут..., Я из..., Как тебя зовут? — «быть» hozirgi zamonda tushib qolishi',
        de: 'Ich heiße..., Ich komme aus..., Wie heißt du? — sein va heißen fe\'llari',
      },
    },
    {
      id: 'u2',
      level: 'A1',
      icon: '🔢',
      title: 'Raqamlar va yosh',
      topic: "1 dan 100 gacha sonlar, yosh, telefon raqami, narx",
      grammar: {
        ru: 'Мне ... лет (год/года/лет), Сколько тебе лет? Сколько стоит?',
        de: 'Ich bin ... Jahre alt, Zahlen 1-100, Wie viel kostet das?',
      },
    },
    {
      id: 'u3',
      level: 'A1',
      icon: '👨‍👩‍👧',
      title: 'Oila',
      topic: "oila a'zolari, ularning ismi, yoshi va kasbi",
      grammar: {
        ru: 'Это мой/моя/моё, У меня есть брат, otlarning jinsi (он/она/оно)',
        de: 'mein/meine, Ich habe einen Bruder, artikllar der/die/das',
      },
    },
    {
      id: 'u4',
      level: 'A1',
      icon: '⏰',
      title: 'Kun tartibi',
      topic: "ertalabdan kechgacha nima qilish, soat, hafta kunlari",
      grammar: {
        ru: "fe'llarning hozirgi zamonda tuslanishi (я делаю, ты делаешь), В котором часу?",
        de: "fe'llarning hozirgi zamonda tuslanishi, ajraluvchi fe'llar (aufstehen), Um wie viel Uhr?",
      },
    },
    {
      id: 'u5',
      level: 'A1',
      icon: '🍎',
      title: 'Ovqat va ichimliklar',
      topic: "sevimli taomlar, nonushta, kafe va restoranda buyurtma",
      grammar: {
        ru: 'Я люблю + vinitelniy kelishik, Я хочу..., Мне, пожалуйста...',
        de: 'Ich möchte..., Akkusativ (einen Kaffee), gern / nicht gern',
      },
    },
    {
      id: 'u6',
      level: 'A1',
      icon: '🛒',
      title: "Do'kon va xarid",
      topic: "do'konda narx so'rash, kiyim va oziq-ovqat sotib olish",
      grammar: {
        ru: "Сколько стоит?, ko'plik shakli (яблоки), Дайте, пожалуйста...",
        de: "Was kostet...?, ko'plik shakllari, Ich nehme...",
      },
    },
    {
      id: 'u7',
      level: 'A2',
      icon: '🏙️',
      title: "Shahar va yo'l so'rash",
      topic: "shahardagi joylar, yo'l so'rash va tushuntirish, transport",
      grammar: {
        ru: 'Где находится...?, предложный падеж (в парке, на улице), направо/налево',
        de: 'Wo ist...?, Präpositionen + Dativ (in der Stadt, neben dem Park), links/rechts',
      },
    },
    {
      id: 'u8',
      level: 'A2',
      icon: '🏖️',
      title: 'Dam olish kunlari (o\'tgan zamon)',
      topic: "o'tgan dam olish kunlari nima qilganini aytib berish",
      grammar: {
        ru: "o'tgan zamon (я был/была, мы ходили), вчера, на выходных",
        de: 'Perfekt (ich habe gemacht, ich bin gefahren), gestern, am Wochenende',
      },
    },
    {
      id: 'u9',
      level: 'A2',
      icon: '🌦️',
      title: 'Ob-havo va kiyim',
      topic: "ob-havo, fasllar, nima kiyish",
      grammar: {
        ru: "Сегодня холодно/тепло, Я ношу..., sifatlarning moslashuvi (красивая куртка)",
        de: 'Es ist kalt/warm, Ich trage..., sifat qo\'shimchalari (ein warmer Mantel)',
      },
    },
    {
      id: 'u10',
      level: 'A2',
      icon: '🩺',
      title: 'Sog\'liq va shifokorda',
      topic: "tana a'zolari, qayer og'riyotganini aytish, shifokor bilan suhbat",
      grammar: {
        ru: 'У меня болит..., Мне нужно..., должен/должна',
        de: 'Mir tut ... weh, Ich muss..., modal fe\'llar (müssen, sollen)',
      },
    },
    {
      id: 'u11',
      level: 'B1',
      icon: '💼',
      title: 'Ish va kasb',
      topic: "kasblar, ish tajribasi, ish suhbatida o'zini tanishtirish",
      grammar: {
        ru: 'работать + творительный падеж (работаю врачом), уже/ещё, Я умею...',
        de: 'Ich arbeite als..., seit + Dativ, weil-gaplar (so\'z tartibi)',
      },
    },
    {
      id: 'u12',
      level: 'B1',
      icon: '✈️',
      title: 'Sayohat rejalari',
      topic: "kelajakdagi sayohatni rejalashtirish, mehmonxona, chipta",
      grammar: {
        ru: 'kelasi zamon (я буду + fe\'l, я поеду), если бы..., Я хотел бы...',
        de: 'Futur (ich werde fahren), Ich würde gern..., wenn-gaplar',
      },
    },
  ];

  // Bosqich imtihonidan o'tish uchun kerakli to'g'ri javoblar ulushi.
  const PASS_RATIO = 0.75;

  const COURSE = { UNITS, PASS_RATIO, byId: (id) => UNITS.find((u) => u.id === id) || null };

  if (typeof module !== 'undefined' && module.exports) module.exports = COURSE;
  else root.COURSE = COURSE;
})(typeof window !== 'undefined' ? window : globalThis);
