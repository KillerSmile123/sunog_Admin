// Central admin auth utilities
window.AdminAuth = {
  setToken(token) {
    if (token) localStorage.setItem('adminToken', token);
  },
  getToken() {
    return localStorage.getItem('adminToken');
  },
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
  logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    window.location.href = 'adminLogin.html';
  },
  requireAuth(redirectTo = 'adminLogin.html') {
    if (!this.isLoggedIn()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }
};
