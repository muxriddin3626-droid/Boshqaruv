// Obuna tariflari: kunlik ovozli dars daqiqalari va narxlar (so'm). Narxlarni admin panelida
// o'zgartirish mumkin — bu yerdagilar standart qiymatlar. Fayl brauzerda ham, serverda ham ishlatiladi.
(function (root) {
  const PLANS = [
    { id: 'light', name: 'Light', title: 'Oddiy', minutes: 20 },
    { id: 'standard', name: 'Standard', title: 'Asosiy', minutes: 30, popular: true },
    { id: 'pro', name: 'Pro', title: 'VIP', minutes: 60 },
  ];

  // Muddatlar: oylar soni va beriladigan kunlar.
  const PERIODS = [
    { months: 1, days: 30, label: '1 oy' },
    { months: 3, days: 90, label: '3 oy' },
    { months: 12, days: 365, label: '1 yil' },
  ];

  const DEFAULT_PRICES = {
    light: { 1: 150000, 3: 405000, 12: 1350000 },
    standard: { 1: 200000, 3: 540000, 12: 1800000 },
    pro: { 1: 400000, 3: 1080000, 12: 3600000 },
  };

  const byId = (id) => PLANS.find((p) => p.id === id) || null;
  const fmt = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;

  const API = { PLANS, PERIODS, DEFAULT_PRICES, byId, fmt, DEFAULT_PLAN: 'standard' };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PLANS = API;
})(typeof window !== 'undefined' ? window : globalThis);
