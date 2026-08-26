const msg = document.getElementById('msg');
let currentPin = null;
let watchId = null;
let intervalId = null;

function showMsg(text, ok = false) {
  msg.textContent = text;
  msg.className = ok ? 'msg ok' : 'msg error';
}

document.getElementById('startBtn').addEventListener('click', async () => {
  const pin = document.getElementById('pin').value.trim();
  if (!pin) return;
  if (!navigator.geolocation) { showMsg('Bu qurilma joylashuvni aniqlay olmaydi'); return; }

  try {
    const { employee } = await Api.identify(pin);
    currentPin = pin;
    document.getElementById('welcome').textContent = `Salom, ${employee.name}! Kuzatish yoqildi.`;
    document.getElementById('pinStep').style.display = 'none';
    document.getElementById('trackingStep').style.display = 'block';
    showMsg('');
    startTracking();
  } catch (e) {
    showMsg(e.message);
  }
});

function sendCurrentPosition() {
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        await Api.updateLocation(currentPin, pos.coords.latitude, pos.coords.longitude);
        document.getElementById('lastSent').textContent =
          `Oxirgi yuborilgan: ${new Date().toLocaleTimeString('uz-UZ')}`;
      } catch (e) {
        document.getElementById('lastSent').textContent = `Xato: ${e.message}`;
      }
    },
    (err) => {
      document.getElementById('lastSent').textContent = `Joylashuv xatosi: ${err.message}`;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function startTracking() {
  sendCurrentPosition();
  intervalId = setInterval(sendCurrentPosition, 15000);
}

document.getElementById('stopBtn').addEventListener('click', () => {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  currentPin = null;
  document.getElementById('pin').value = '';
  document.getElementById('trackingStep').style.display = 'none';
  document.getElementById('pinStep').style.display = 'block';
  document.getElementById('lastSent').textContent = 'Hali yuborilmagan.';
  showMsg('Kuzatish to\'xtatildi.', true);
});
