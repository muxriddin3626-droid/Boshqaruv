const msg = document.getElementById('msg');
let currentPin = null;

function showMsg(text, ok = false) {
  msg.textContent = text;
  msg.className = ok ? 'msg ok' : 'msg error';
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { timeout: 5000 }
    );
  });
}

document.getElementById('identifyBtn').addEventListener('click', async () => {
  const pin = document.getElementById('pin').value.trim();
  if (!pin) return;
  try {
    const { employee } = await Api.identify(pin);
    currentPin = pin;
    document.getElementById('welcome').textContent = `Salom, ${employee.name}!`;
    document.getElementById('pinStep').style.display = 'none';
    document.getElementById('actionStep').style.display = 'block';
    showMsg('');
  } catch (e) {
    showMsg(e.message);
  }
});

document.getElementById('backBtn').addEventListener('click', () => {
  currentPin = null;
  document.getElementById('pin').value = '';
  document.getElementById('actionStep').style.display = 'none';
  document.getElementById('pinStep').style.display = 'block';
  showMsg('');
});

async function record(type) {
  showMsg('Yuborilmoqda…', true);
  const { lat, lng } = await getLocation();
  try {
    if (type === 'in') await Api.checkin(currentPin, lat, lng);
    else await Api.checkout(currentPin, lat, lng);
    showMsg(type === 'in' ? 'Keldingiz belgilandi ✓' : 'Ketishingiz belgilandi ✓', true);
  } catch (e) {
    showMsg(e.message);
  }
}

document.getElementById('inBtn').addEventListener('click', () => record('in'));
document.getElementById('outBtn').addEventListener('click', () => record('out'));
