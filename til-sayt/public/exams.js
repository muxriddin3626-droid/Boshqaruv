// Sinov imtihonlari: rasmiy imtihonlar (Goethe, ТРКИ) formatiga o'xshatilgan mashq.
// Bu fayl ham brauzerda, ham serverda ishlatiladi.
(function (root) {
  const SECTION_INFO = {
    grammar: { title: "Lug'at va grammatika", icon: '🔤', kind: 'choice' },
    reading: { title: "O'qish", icon: '📖', kind: 'choice' },
    listening: { title: 'Tinglash', icon: '🎧', kind: 'choice' },
    writing: { title: 'Yozish', icon: '✍️', kind: 'writing' },
    speaking: { title: 'Gapirish', icon: '🗣️', kind: 'speaking' },
    history: { title: 'Rossiya tarixi', icon: '📜', kind: 'choice' },
    law: { title: 'Qonunchilik asoslari', icon: '⚖️', kind: 'choice' },
  };

  const EXAMS = {
    de: [
      {
        id: 'goethe-a1',
        name: 'Goethe-Zertifikat A1 (Start Deutsch 1)',
        short: 'Goethe A1',
        level: 'A1',
        pass: 0.6,
        rule: 'total',
        about: "Nemis tilining boshlang'ich darajasi. Ko'pincha oila birlashuvi vizasi uchun so'raladi.",
        sections: [
          { id: 'listening', minutes: 8, format: "Hören: qisqa dialoglar, telefon xabarlari va e'lonlar (vokzal, do'kon). Har biriga 1-2 savol, 3 variantli (a/b/c) yoki richtig/falsch." },
          { id: 'reading', minutes: 10, format: "Lesen: qisqa xat yoki e-mail, e'lonlar, ko'rsatkichlar. richtig/falsch va a/b/c savollar." },
          { id: 'writing', minutes: 10, format: "Schreiben: qisqa xabar yoki xat (30-40 so'z) — 3 ta berilgan nuqtaga javob, masalan do'stga taklif yoki uzr." },
          { id: 'speaking', minutes: 6, format: "Sprechen: o'zini tanishtirish (ism, yosh, qayerdan, tillar, kasb, hobbi), kundalik mavzuda savol berish va javob berish, iltimos qilish." },
        ],
      },
      {
        id: 'goethe-b1',
        name: 'Goethe-Zertifikat B1',
        short: 'Goethe B1',
        level: 'B1',
        pass: 0.6,
        rule: 'total',
        about: "Mustaqil foydalanuvchi darajasi. Ish, o'qish va doimiy yashash uchun keng so'raladi.",
        sections: [
          { id: 'reading', minutes: 14, format: "Lesen: blog yozuvi, gazeta maqolasi, e'lonlar va qoidalar matni. richtig/falsch va a/b/c savollar." },
          { id: 'listening', minutes: 10, format: "Hören: radio e'lonlari, suhbatlar, munozara. Asosiy fikr va tafsilotlarni tushunish, a/b/c va ja/nein savollar." },
          { id: 'writing', minutes: 15, format: "Schreiben: do'stga e-mail (80 so'z atrofida) — voqea haqida yozish, fikr bildirish va taklif qilish; 3 ta nuqta." },
          { id: 'speaking', minutes: 8, format: "Sprechen: sherik bilan reja tuzish, mavzu bo'yicha qisqa taqdimot (fikr, tajriba, afzallik va kamchiliklar), savollarga javob." },
        ],
      },
    ],
    ru: [
      {
        id: 'patent',
        name: 'Patent imtihoni (rus tili, tarix, qonunchilik)',
        short: 'Patent',
        level: 'A1-A2',
        pass: 0.8,
        rule: 'total',
        // Haqiqiy imtihonda tinglash va gapirishdan alohida eng kam ball kerak (aniq qiymati rasmiy manbada).
        required: { listening: 0.5, speaking: 0.5 },
        about: "Rossiyada ishlash uchun patent olishda topshiriladigan imtihon: rus tili, Rossiya tarixi va qonunchilik asoslari. 2026 yildan faqat kompyuterda.",
        note: "O'tish chegarasi taxminiy (≈80% va tinglash/gapirishdan alohida minimum). Qoidalar, muddat va jarimalar o'zgarib turadi — imtihondan oldin rasmiy manbadan (МВД, Рособрнадзор, test markazi) tekshiring.",
        sections: [
          { id: 'reading', minutes: 8, format: "Чтение: kundalik hayotdagi qisqa matnlar — e'lon, yozuv, jadval (dorixona, avtobus, ish e'loni, do'kon). Matndan aniq ma'lumotni topish, 3 variantli savollar." },
          { id: 'grammar', minutes: 8, format: "Лексика и грамматика: kundalik va ish hayotiga oid gaplarda bo'sh joyga to'g'ri shaklni tanlash (kelishiklar: на стройке, в магазине; fe'l shakli; sonlar), 3 variant." },
          { id: 'listening', minutes: 8, format: "Аудирование: 4 ta qisqa dialog yoki e'lon (ish beruvchi bilan suhbat, do'kon, transport e'loni, shifokor). Har biriga 1-2 savol, 3 variantli." },
          { id: 'writing', minutes: 8, format: "Письмо: anketa yoki blankani to'ldirish (Фамилия, Имя, Гражданство, Дата рождения, Адрес, Профессия) va 3-4 gaplik qisqa xabar yozish (masalan, ish beruvchiga yoki do'stga)." },
          { id: 'speaking', minutes: 5, format: "Говорение: imtihon oluvchining savollariga javob (ism, qayerdan, kim bo'lib ishlaydi, oila) va vaziyatda gapirish (do'konda narsa so'rash, shifokorga nima og'riyotganini aytish, yo'l so'rash)." },
          { id: 'history', minutes: 6, format: "История России: davlat ramzlari (bayroq, gerb, madhiya), poytaxt, asosiy bayramlar (9 May — G'alaba kuni, 12 Iyun — Rossiya kuni, Yangi yil), mashhur shaxslar (Pyotr I, Gagarin, Pushkin), muhim tarixiy voqealar. 3 variantli savollar." },
          { id: 'law', minutes: 6, format: "Основы законодательства: chet el fuqarosining huquq va majburiyatlari, ishlash uchun patent kerakligi, mehnat shartnomasi, patent uchun soliq to'lash, migratsiya hisobiga turish, favqulodda telefon raqamlari (112), qonunlarga rioya qilish. 3 variantli savollar." },
        ],
      },
      {
        id: 'trki-a1',
        name: 'ТРКИ — Элементарный уровень (A1)',
        short: 'ТРКИ A1',
        level: 'A1',
        pass: 0.66,
        rule: 'each',
        about: "Rus tilining boshlang'ich darajasi bo'yicha davlat testi. Har bir qismdan 66% to'plash kerak.",
        sections: [
          { id: 'grammar', minutes: 10, format: "Лексика. Грамматика: gapdagi bo'sh joyga to'g'ri so'z yoki shaklni tanlash (kelishiklar, fe'l shakli, predloglar), 3-4 variant." },
          { id: 'reading', minutes: 10, format: "Чтение: qisqa matn (o'zi haqida, shahar, oila) va uning mazmuni bo'yicha savollar, 3 variantli." },
          { id: 'listening', minutes: 8, format: "Аудирование: qisqa dialoglar va monolog, mazmun bo'yicha savollar, 3 variantli." },
          { id: 'writing', minutes: 10, format: "Письмо: o'zi haqida yoki do'stga qisqa xat (8-10 gap) berilgan savollar asosida." },
          { id: 'speaking', minutes: 6, format: "Говорение: savollarga javob berish, dialogda qatnashish (do'kon, ko'cha), o'zi haqida gapirish." },
        ],
      },
      {
        id: 'trki-b1',
        name: 'ТРКИ-1 — Первый уровень (B1)',
        short: 'ТРКИ-1 (B1)',
        level: 'B1',
        pass: 0.66,
        rule: 'each',
        about: "Rossiya oliy o'quv yurtlariga kirish va fuqarolik uchun so'raladigan daraja.",
        sections: [
          { id: 'grammar', minutes: 12, format: "Лексика. Грамматика: kelishiklar, fe'l turlari (вид), harakat fe'llari, sifatdosh va ravishdoshlar, bog'lovchilar — to'g'ri shaklni tanlash." },
          { id: 'reading', minutes: 14, format: "Чтение: publitsistik yoki badiiy matn parchasi, asosiy fikr va tafsilotlar bo'yicha savollar." },
          { id: 'listening', minutes: 10, format: "Аудирование: radio e'loni, suhbat, intervyu parchasi, mazmun bo'yicha savollar." },
          { id: 'writing', minutes: 15, format: "Письмо: matn asosida xat yoki o'z fikrini bildiruvchi yozma ish (20 gap atrofida)." },
          { id: 'speaking', minutes: 8, format: "Говорение: dialog-vaziyatlarda qatnashish, mavzu bo'yicha monolog (o'z fikri va misollar)." },
        ],
      },
    ],
  };

  function find(lang, id) {
    return (EXAMS[lang] || []).find((e) => e.id === id) || null;
  }

  const EXAMS_API = { EXAMS, SECTION_INFO, find };

  if (typeof module !== 'undefined' && module.exports) module.exports = EXAMS_API;
  else root.EXAMS = EXAMS_API;
})(typeof window !== 'undefined' ? window : globalThis);
