// Qaysi iqtiboslar ishlatilganini oddiy JSON faylda saqlaydi, shu bilan
// bot bir xil matnni ketma-ket takrorlamaydi. Render'ning bepul tarifida
// disk doimiy emasligini unutmang - server qayta ishga tushganda tarix
// tozalanishi mumkin, bu MVP uchun muammo emas.
const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', 'data', 'used-quotes.json');

function readHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markUsed(index) {
  const history = readHistory();
  history.push(index);
  const trimmed = history.slice(-15);
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed));
}

module.exports = { readHistory, markUsed };
