// Bot ishlab turgan paytda /auto_yoq va /auto_ochir buyruqlari orqali
// o'zgartiriladigan sozlamalar (masalan AUTO_POST). Qayta ishga tushganda
// .env dagi qiymatdan boshlanadi, keyin shu faylda saqlangan holat ustun
// turadi.
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg));
}

function isAutoPostEnabled() {
  const stored = readConfig();
  if (typeof stored.autoPost === 'boolean') return stored.autoPost;
  return String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
}

function setAutoPost(enabled) {
  const cfg = readConfig();
  cfg.autoPost = enabled;
  writeConfig(cfg);
}

module.exports = { isAutoPostEnabled, setAutoPost };
