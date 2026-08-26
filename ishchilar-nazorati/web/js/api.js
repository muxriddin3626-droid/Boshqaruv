const Api = {
  token: localStorage.getItem('admin_token') || null,

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('admin_token', token);
    else localStorage.removeItem('admin_token');
  },

  async request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `So'rov xato: ${res.status}`);
    return data;
  },

  login(username, password) {
    return this.request('/auth/login', { method: 'POST', body: { username, password } });
  },
  getEmployees() {
    return this.request('/employees', { auth: true });
  },
  addEmployee(payload) {
    return this.request('/employees', { method: 'POST', body: payload, auth: true });
  },
  setEmployeeActive(id, active) {
    return this.request(`/employees/${id}`, { method: 'PATCH', body: { active }, auth: true });
  },
  identify(pin) {
    return this.request('/employees/identify', { method: 'POST', body: { pin } });
  },
  checkin(pin, lat, lng) {
    return this.request('/attendance/checkin', { method: 'POST', body: { pin, lat, lng } });
  },
  checkout(pin, lat, lng) {
    return this.request('/attendance/checkout', { method: 'POST', body: { pin, lat, lng } });
  },
  getStatus() {
    return this.request('/attendance/status', { auth: true });
  },
  getAttendance(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/attendance${qs ? `?${qs}` : ''}`, { auth: true });
  },
  updateLocation(pin, lat, lng) {
    return this.request('/location/update', { method: 'POST', body: { pin, lat, lng } });
  },
  getLiveLocations() {
    return this.request('/location/live', { auth: true });
  },
};
