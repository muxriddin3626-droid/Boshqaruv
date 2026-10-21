if (!Api.token) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
  Api.setToken(null);
  window.location.href = 'index.html';
});

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('uz-UZ');
}

// ---------- Xarita ----------
const map = L.map('map').setView([41.311081, 69.240562], 11); // Toshkent markazi (default)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
}).addTo(map);
const markers = new Map(); // employeeId -> Leaflet marker

async function refreshMap() {
  try {
    const { locations } = await Api.getLiveLocations();
    const seen = new Set();
    for (const loc of locations) {
      seen.add(loc.employee_id);
      const label = `${loc.name}<br><span class="muted">${fmtTime(loc.updated_at)}</span>`;
      if (markers.has(loc.employee_id)) {
        markers.get(loc.employee_id).setLatLng([loc.lat, loc.lng]).setPopupContent(label);
      } else {
        const marker = L.marker([loc.lat, loc.lng]).addTo(map).bindPopup(label);
        markers.set(loc.employee_id, marker);
      }
    }
    for (const [id, marker] of markers) {
      if (!seen.has(id)) { map.removeLayer(marker); markers.delete(id); }
    }
  } catch (e) {
    console.error(e);
  }
}

// ---------- Joriy holat ----------
async function refreshStatus() {
  const wrap = document.getElementById('statusTableWrap');
  try {
    const { status } = await Api.getStatus();
    if (status.length === 0) { wrap.innerHTML = '<p class="muted">Xodimlar hali qo\'shilmagan.</p>'; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Ism</th><th>Lavozim</th><th>Holat</th><th>Vaqt</th></tr></thead>
        <tbody>
          ${status.map(s => `
            <tr>
              <td>${s.name}</td>
              <td>${s.role}</td>
              <td>${s.last_type === 'in' ? '<span class="badge in">Ishda</span>' : '<span class="badge out">Ishda emas</span>'}</td>
              <td>${fmtTime(s.last_ts)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    wrap.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

// ---------- Xodimlar ro'yxati ----------
function populateHistoryEmployeeSelect(employees) {
  const select = document.getElementById('historyEmployee');
  const previous = select.value;
  const drivers = employees.filter(e => e.role === 'haydovchi' && e.active);
  select.innerHTML = drivers.length
    ? drivers.map(e => `<option value="${e.id}">${e.name}</option>`).join('')
    : '<option value="">Haydovchi yo\'q</option>';
  if (drivers.some(e => e.id === previous)) select.value = previous;
}

async function refreshEmployees() {
  const wrap = document.getElementById('employeesTableWrap');
  try {
    const { employees } = await Api.getEmployees();
    populateHistoryEmployeeSelect(employees);
    if (employees.length === 0) { wrap.innerHTML = '<p class="muted">Xodimlar hali qo\'shilmagan.</p>'; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Ism</th><th>Lavozim</th><th>Telefon</th><th>PIN</th><th>Holat</th><th></th></tr></thead>
        <tbody>
          ${employees.map(e => `
            <tr>
              <td>${e.name}</td>
              <td>${e.role}</td>
              <td>${e.phone || '—'}</td>
              <td><span class="pin-display">${e.pin_code}</span></td>
              <td>${e.active ? 'Faol' : 'Nofaol'}</td>
              <td><button class="ghost" data-toggle="${e.id}" data-active="${e.active}">${e.active ? 'O\'chirish' : 'Yoqish'}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    wrap.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-toggle');
        const isActive = btn.getAttribute('data-active') === '1';
        await Api.setEmployeeActive(id, !isActive);
        refreshEmployees();
        refreshStatus();
      });
    });
  } catch (e) {
    wrap.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

// ---------- Tarix ----------
async function refreshAttendance() {
  const wrap = document.getElementById('attendanceTableWrap');
  try {
    const { attendance } = await Api.getAttendance();
    if (attendance.length === 0) { wrap.innerHTML = '<p class="muted">Hali hodisalar yo\'q.</p>'; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Ism</th><th>Turi</th><th>Vaqt</th></tr></thead>
        <tbody>
          ${attendance.map(a => `
            <tr>
              <td>${a.employee_name}</td>
              <td>${a.type === 'in' ? '<span class="badge in">Keldi</span>' : '<span class="badge out">Ketdi</span>'}</td>
              <td>${fmtTime(a.ts)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    wrap.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

// ---------- Yangi xodim qo'shish ----------
document.getElementById('addBtn').addEventListener('click', async () => {
  const msg = document.getElementById('addMsg');
  msg.textContent = '';
  msg.className = 'msg';
  const name = document.getElementById('name').value.trim();
  const role = document.getElementById('role').value;
  const phone = document.getElementById('phone').value.trim();
  if (!name) { msg.textContent = 'Ism kiriting'; msg.className = 'msg error'; return; }
  try {
    const emp = await Api.addEmployee({ name, role, phone });
    msg.textContent = `Qo'shildi. PIN kod: ${emp.pin_code}`;
    msg.className = 'msg ok';
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    refreshEmployees();
    refreshStatus();
  } catch (e) {
    msg.textContent = e.message;
    msg.className = 'msg error';
  }
});

// ---------- Haydovchi yo'l tarixi ----------
let historyMap = null;
let historyLayer = null;

function ensureHistoryMap() {
  if (historyMap) return historyMap;
  historyMap = L.map('historyMap');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
  }).addTo(historyMap);
  return historyMap;
}

document.getElementById('historyDate').value = new Date().toISOString().slice(0, 10);

document.getElementById('showHistoryBtn').addEventListener('click', async () => {
  const msg = document.getElementById('historyMsg');
  msg.textContent = '';
  msg.className = 'msg';

  const employeeId = document.getElementById('historyEmployee').value;
  const dateStr = document.getElementById('historyDate').value;
  if (!employeeId) { msg.textContent = 'Haydovchini tanlang'; msg.className = 'msg error'; return; }

  const params = { employeeId };
  if (dateStr) {
    const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
    params.from = dayStart;
    params.to = dayStart + 24 * 60 * 60 * 1000 - 1;
  }

  try {
    const { points } = await Api.getLocationHistory(params);
    const wrap = document.getElementById('historyMap');
    wrap.style.display = 'block';
    const hmap = ensureHistoryMap();
    setTimeout(() => hmap.invalidateSize(), 50);

    if (historyLayer) { hmap.removeLayer(historyLayer); historyLayer = null; }

    if (points.length === 0) {
      msg.textContent = 'Bu sana uchun joylashuv topilmadi.';
      return;
    }

    const latlngs = points.map(p => [p.lat, p.lng]);
    historyLayer = L.layerGroup().addTo(hmap);
    L.polyline(latlngs, { color: '#3b82f6' }).addTo(historyLayer);
    L.marker(latlngs[0]).addTo(historyLayer).bindPopup(`Boshlanish — ${fmtTime(points[0].ts)}`);
    L.marker(latlngs[latlngs.length - 1]).addTo(historyLayer)
      .bindPopup(`Oxirgi nuqta — ${fmtTime(points[points.length - 1].ts)}`);
    hmap.fitBounds(latlngs, { padding: [20, 20] });

    msg.textContent = `${points.length} ta nuqta topildi.`;
    msg.className = 'msg ok';
  } catch (e) {
    msg.textContent = e.message;
    msg.className = 'msg error';
  }
});

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  document.getElementById('historyMap').style.display = 'none';
  document.getElementById('historyMsg').textContent = '';
  if (historyLayer && historyMap) { historyMap.removeLayer(historyLayer); historyLayer = null; }
});

refreshStatus();
refreshEmployees();
refreshAttendance();
refreshMap();
setInterval(refreshMap, 10000);
setInterval(refreshStatus, 15000);
