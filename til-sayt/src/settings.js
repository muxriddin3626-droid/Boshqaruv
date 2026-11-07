// Sayt sozlamalari: standart qiymatlar muhit o'zgaruvchilaridan (.env), admin panelida
// o'zgartirilganlari bazadan olinadi. O'zgarish serverni qayta ishga tushirmasdan kuchga kiradi.
const db = require('./db');
const P = require('../public/plans.js');

const DEFAULTS = {
  limitsOn: process.env.FREE_LIMITS !== 'off',
  freeLessons: Number(process.env.FREE_LESSONS || 2),
  freePractice: Number(process.env.FREE_PRACTICE || 6),
  freeExam: Number(process.env.FREE_EXAM_SECTIONS || 10),
  refBonusDays: Number(process.env.REF_BONUS_DAYS || 3),
  premiumPrice: process.env.PREMIUM_PRICE || '',
  premiumContact: process.env.PREMIUM_CONTACT || '',
  announcement: '',
  prices: P.DEFAULT_PRICES,
};

// Narxlar: har tarif uchun { 1: so'm, 3: so'm, 12: so'm }.
function validPrices(v) {
  return (
    v &&
    typeof v === 'object' &&
    P.PLANS.every((p) => v[p.id] && P.PERIODS.every((d) => Number.isInteger(v[p.id][d.months]) && v[p.id][d.months] >= 0 && v[p.id][d.months] <= 100000000))
  );
}

// Har sozlama uchun tekshiruv: noto'g'ri qiymat qabul qilinmaydi.
const VALIDATE = {
  limitsOn: (v) => typeof v === 'boolean',
  freeLessons: (v) => Number.isInteger(v) && v >= 0 && v <= 1000,
  freePractice: (v) => Number.isInteger(v) && v >= 0 && v <= 1000,
  freeExam: (v) => Number.isInteger(v) && v >= 0 && v <= 1000,
  refBonusDays: (v) => Number.isInteger(v) && v >= 0 && v <= 365,
  premiumPrice: (v) => typeof v === 'string' && v.length <= 100,
  premiumContact: (v) => typeof v === 'string' && v.length <= 100,
  announcement: (v) => typeof v === 'string' && v.length <= 300,
  prices: validPrices,
};

let current = { ...DEFAULTS };

async function load() {
  const saved = await db.getSettings();
  current = { ...DEFAULTS };
  for (const [k, v] of Object.entries(saved)) {
    if (Object.hasOwn(VALIDATE, k) && VALIDATE[k](v)) current[k] = v;
  }
  return current;
}

// patch: { kalit: qiymat }. Faqat ma'lum va to'g'ri qiymatlar saqlanadi.
async function update(patch) {
  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (Object.hasOwn(VALIDATE, k) && VALIDATE[k](v)) clean[k] = typeof v === 'string' ? v.trim() : v;
  }
  if (Object.keys(clean).length) await db.setSettings(clean);
  return load();
}

const get = () => current;
const freeLimits = () => ({ lesson: current.freeLessons, practice: current.freePractice, exam: current.freeExam });

module.exports = { load, update, get, freeLimits, DEFAULTS };
