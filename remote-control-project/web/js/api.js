const Api = {
  token: localStorage.getItem("rc_token") || null,
  deviceId: localStorage.getItem("rc_device_id") || null,

  async _post(path, body, auth = false) {
    const headers = { "Content-Type": "application/json" };
    if (auth && this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Server xatosi: ${res.status}`);
    return json;
  },

  async _get(path) {
    const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Server xatosi: ${res.status}`);
    return json;
  },

  async register(email, password) {
    const { token } = await this._post("/auth/register", { email, password });
    this._setToken(token);
  },

  async login(email, password) {
    const { token } = await this._post("/auth/login", { email, password });
    this._setToken(token);
  },

  async registerDevice() {
    const { deviceId } = await this._post(
      "/devices/register",
      { name: "Web Controller", role: "controller", platform: "web" },
      true
    );
    this.deviceId = deviceId;
    localStorage.setItem("rc_device_id", deviceId);
    return deviceId;
  },

  async claimPairingCode(code) {
    return this._post(
      "/pair/claim",
      { code, controllerDeviceId: this.deviceId },
      true
    );
  },

  _setToken(token) {
    this.token = token;
    localStorage.setItem("rc_token", token);
  },

  logout() {
    this.token = null;
    this.deviceId = null;
    localStorage.removeItem("rc_token");
    localStorage.removeItem("rc_device_id");
  },

  isLoggedIn() {
    return !!(this.token && this.deviceId);
  },
};
