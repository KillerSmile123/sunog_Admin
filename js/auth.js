// Central admin auth utilities
window.AdminAuth = {
  // Backwards-compatible token storage (kept for compatibility; prefer server-side cookies)
  setToken(token) {
    if (token) localStorage.setItem('adminToken', token);
  },
  getToken() {
    return localStorage.getItem('adminToken');
  },
  // Quick synchronous check (fast, uses localStorage if present)
  isLoggedIn() {
    return !!localStorage.getItem('adminToken');
  },
  setAdminInfo(info) {
    if (info) localStorage.setItem('adminInfo', JSON.stringify(info));
  },
  getAdminInfo() {
    const v = localStorage.getItem('adminInfo');
    return v ? JSON.parse(v) : null;
  },
  // Logout: try server logout, then clear client state
  logout() {
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
      .catch(() => {})
      .finally(() => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminInfo');
        window.location.href = 'adminLogin.html';
      });
  },
  // Non-blocking requireAuth: quick local check, then verify with server asynchronously
  requireAuth(redirectTo = 'adminLogin.html') {
    if (!this.isLoggedIn()) {
      // No local token -> redirect immediately
      window.location.href = redirectTo;
      return false;
    }

    // Verify with server in background; if invalid, redirect
    fetch(`${API_BASE}/auth/verify`, { method: 'GET', credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (data && data.auth === false) {
          window.location.href = redirectTo;
        }
      })
      .catch(() => {
        // If verification endpoint fails, keep local behaviour (no further action)
      });

    return true;
  },
  // Try to get admin info from server (async)
  async fetchAdminInfo() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (!res.ok) throw new Error('no');
      const data = await res.json();
      if (data && data.admin) {
        this.setAdminInfo(data.admin);
        return data.admin;
      }
    } catch (err) {
      // fallback to localStorage
    }
    return this.getAdminInfo();
  }
};
