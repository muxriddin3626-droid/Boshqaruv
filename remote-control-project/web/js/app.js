// ===================== Holat ===================== //
let pc = null;          // RTCPeerConnection
let ws = null;          // Signaling WebSocket
let sessionId = null;
let ringTimer = null;

const $ = (sel) => document.querySelector(sel);

// ===================== Boshlanish ===================== //
window.addEventListener("DOMContentLoaded", () => {
  if (Api.isLoggedIn()) showConsole();
  else showAuth();

  $("#btn-login").addEventListener("click", () => submitAuth("login"));
  $("#btn-register").addEventListener("click", () => submitAuth("register"));
  $("#btn-logout").addEventListener("click", () => {
    endSession();
    Api.logout();
    showAuth();
  });
  $("#btn-connect").addEventListener("click", onConnectClick);

  document.querySelectorAll(".nav__item").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Havoladagi kod: https://.../#/pair/123456 formatida bo'lishi mumkin
  const hashMatch = location.hash.match(/pair\/(\d{6})/);
  if (hashMatch) $("#pairing-code").value = hashMatch[1];
});

// ===================== Auth ===================== //
async function submitAuth(mode) {
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const errEl = $("#auth-error");
  errEl.textContent = "";

  if (!email || password.length < 6) {
    errEl.textContent = "Email va kamida 6 belgili parol kiriting";
    return;
  }
  try {
    if (mode === "register") await Api.register(email, password);
    else await Api.login(email, password);

    if (!Api.deviceId) await Api.registerDevice();
    showConsole();
  } catch (e) {
    errEl.textContent = e.message;
  }
}

function showAuth() {
  $("#view-auth").classList.remove("hidden");
  $("#view-console").classList.add("hidden");
}

function showConsole() {
  $("#view-auth").classList.add("hidden");
  $("#view-console").classList.remove("hidden");
  connectSignaling();
  loadDevices();
  loadSessions();
}

// ===================== Tab navigatsiyasi ===================== //
function switchTab(name) {
  document.querySelectorAll(".nav__item").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.classList.contains(`tab--${name}`)));
  if (name === "devices") loadDevices();
  if (name === "sessions") loadSessions();
}

// ===================== Signaling (WebSocket) ===================== //
function connectSignaling() {
  const url = `${CONFIG.WS_BASE_URL}/ws?token=${Api.token}&deviceId=${Api.deviceId}`;
  ws = new WebSocket(url);

  ws.onmessage = async (evt) => {
    const msg = JSON.parse(evt.data);
    switch (msg.type) {
      case "pairing-result":
        if (msg.approved) {
          setStatus("Ulangan", true);
          await startPeerConnection();
        } else {
          setStatus("Rad etildi", false);
        }
        break;
      case "answer":
        await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
        break;
      case "ice-candidate":
        if (msg.candidate) {
          await pc.addIceCandidate({
            candidate: msg.candidate,
            sdpMid: msg.sdpMid,
            sdpMLineIndex: msg.sdpMLineIndex,
          });
        }
        break;
      case "session-ended":
        setStatus("Ulanmagan", false);
        $("#screen-wrap").classList.add("hidden");
        break;
    }
  };
}

function wsSend(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ===================== Pairing oqimi ===================== //
async function onConnectClick() {
  const code = $("#pairing-code").value.trim();
  if (code.length !== 6) return;

  setStatus("Ulanmoqda...", false);
  startRing();
  try {
    const { sessionId: sid } = await Api.claimPairingCode(code);
    sessionId = sid;
    setStatus("Kutilmoqda: tasdiqlash kerak...", false);
  } catch (e) {
    setStatus("Ulanmagan", false);
    stopRing();
    alert(e.message);
  }
}

function setStatus(text, isLive) {
  $("#status-text").textContent = text;
  $("#status-dot").classList.toggle("is-live", !!isLive);
}

// 5 daqiqalik kod muddatini aylana progress sifatida ko'rsatish
function startRing() {
  const ring = $("#ring-progress");
  const totalSeconds = 300;
  const circumference = 339.3;
  let elapsed = 0;
  stopRing();
  ringTimer = setInterval(() => {
    elapsed += 1;
    const fraction = Math.min(elapsed / totalSeconds, 1);
    ring.style.strokeDashoffset = String(circumference * fraction);
    if (elapsed >= totalSeconds) stopRing();
  }, 1000);
}
function stopRing() {
  if (ringTimer) clearInterval(ringTimer);
  $("#ring-progress").style.strokeDashoffset = "0";
}

// ===================== WebRTC (faqat qabul qiluvchi) ===================== //
async function startPeerConnection() {
  pc = new RTCPeerConnection({ iceServers: [] /* TURN/STUN shu yerga qo'shiladi */ });

  pc.ontrack = (evt) => {
    const video = $("#remote-video");
    video.srcObject = evt.streams[0];
    $("#screen-wrap").classList.remove("hidden");
  };

  pc.onicecandidate = (evt) => {
    if (evt.candidate) {
      wsSend({
        type: "ice-candidate",
        sessionId,
        candidate: evt.candidate.candidate,
        sdpMid: evt.candidate.sdpMid,
        sdpMLineIndex: evt.candidate.sdpMLineIndex,
      });
    }
  };

  pc.addTransceiver("video", { direction: "recvonly" });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  wsSend({ type: "offer", sessionId, sdp: offer.sdp });

  // Ekranga bosilganda normalizatsiya qilingan koordinata yuboriladi
  $("#remote-video").addEventListener("click", (evt) => {
    const rect = evt.target.getBoundingClientRect();
    const nx = (evt.clientX - rect.left) / rect.width;
    const ny = (evt.clientY - rect.top) / rect.height;
    wsSend({
      type: "input-command",
      sessionId,
      payload: { action: "tap", x: nx, y: ny },
    });
  });
}

function endSession() {
  if (sessionId) wsSend({ type: "end-session", sessionId });
  if (pc) pc.close();
  pc = null;
  sessionId = null;
}

// ===================== Qurilmalar / Sessiyalar jadvali ===================== //
async function loadDevices() {
  const el = $("#devices-table");
  try {
    const { devices } = await Api._get("/devices");
    if (!devices.length) {
      el.innerHTML = `<div class="table__empty">Hali qurilma yo'q.</div>`;
      return;
    }
    el.innerHTML = devices.map(d => `
      <div class="table__row">
        <div>
          <div class="table__row-title">${escapeHtml(d.name)}</div>
          <div class="table__row-meta">${d.role} · ${d.platform}</div>
        </div>
        <span class="badge ${d.online ? "badge--online" : "badge--offline"}">${d.online ? "onlayn" : "oflayn"}</span>
      </div>
    `).join("");
  } catch (e) {
    el.innerHTML = `<div class="table__empty">Yuklashda xatolik: ${escapeHtml(e.message)}</div>`;
  }
}

async function loadSessions() {
  const el = $("#sessions-table");
  try {
    const { sessions } = await Api._get("/sessions");
    if (!sessions.length) {
      el.innerHTML = `<div class="table__empty">Hali sessiya yo'q.</div>`;
      return;
    }
    el.innerHTML = sessions.map(s => `
      <div class="table__row">
        <div>
          <div class="table__row-title">${escapeHtml(s.controllerName)} → ${escapeHtml(s.agentName)}</div>
          <div class="table__row-meta">${new Date(s.startedAt).toLocaleString("uz-UZ")}</div>
        </div>
        <span class="badge ${s.approved ? "badge--online" : "badge--offline"}">${s.approved ? "tasdiqlangan" : "rad etilgan"}</span>
      </div>
    `).join("");
  } catch (e) {
    el.innerHTML = `<div class="table__empty">Yuklashda xatolik: ${escapeHtml(e.message)}</div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
