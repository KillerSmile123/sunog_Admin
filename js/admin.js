// Admin Login JavaScript
// This file handles the admin login functionality

class AdminLogin {
  constructor() {
    this.init();
  }

  init() {
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', () => {
      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Password toggle functionality
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
      togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
    }

    // Clear error message when user starts typing
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (emailInput) {
      emailInput.addEventListener('input', () => this.clearErrorMessage());
    }
    
    if (passwordInput) {
      passwordInput.addEventListener('input', () => this.clearErrorMessage());
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('error-message');
    const submitButton = e.target.querySelector('button[type="submit"]');

    // Basic validation
    if (!this.validateInputs(email, password)) {
      return;
    }

    // Show loading state
    this.setLoadingState(submitButton, true);

    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        this.handleLoginSuccess(data);
      } else {
        this.handleLoginError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.handleLoginError('Server error. Please try again later.');
    } finally {
      this.setLoadingState(submitButton, false);
    }
  }

  validateInputs(email, password) {
    const errorMsg = document.getElementById('error-message');

    // Check if fields are empty
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showError('Please enter a valid email address');
      return false;
    }

    // Password length validation
    if (password.length < 6) {
      this.showError('Password must be at least 6 characters long');
      return false;
    }

    return true;
  }

  handleLoginSuccess(data) {
    // Store admin token if provided
    if (data.token) {
      localStorage.setItem('adminToken', data.token);
    }

    // Store admin info if provided
    if (data.admin) {
      localStorage.setItem('adminInfo', JSON.stringify(data.admin));
    }

    // Show success message
    this.showSuccess('Login successful!');

    // Redirect to admin dashboard after a short delay
    setTimeout(() => {
      window.location.href = 'adminDashboard.html';
    }, 1000);
  }

  handleLoginError(message) {
    this.showError(message);
  }

  togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('togglePassword');

    if (passwordInput && toggleIcon) {
      const currentType = passwordInput.getAttribute('type');
      const newType = currentType === 'password' ? 'text' : 'password';
      
      passwordInput.setAttribute('type', newType);
      toggleIcon.classList.toggle('fa-eye');
      toggleIcon.classList.toggle('fa-eye-slash');
    }
  }

  showError(message) {
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.style.color = 'red';
      errorMsg.style.display = 'block';
    }
  }

  showSuccess(message) {
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.style.color = 'green';
      errorMsg.style.display = 'block';
    }
  }

  clearErrorMessage() {
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) {
      errorMsg.textContent = '';
      errorMsg.style.display = 'none';
    }
  }

  setLoadingState(button, isLoading) {
    if (button) {
      if (isLoading) {
        button.disabled = true;
        button.textContent = 'Logging in...';
        button.style.opacity = '0.7';
      } else {
        button.disabled = false;
        button.textContent = 'Login';
        button.style.opacity = '1';
      }
    }
  }
}

// Utility functions for admin authentication
class AdminAuth {
  static isLoggedIn() {
    return localStorage.getItem('adminToken') !== null;
  }

  static getToken() {
    return localStorage.getItem('adminToken');
  }

  static getAdminInfo() {
    const adminInfo = localStorage.getItem('adminInfo');
    return adminInfo ? JSON.parse(adminInfo) : null;
  }

  static logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    window.location.href = 'adminLogin.html';
  }

  static checkAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'adminLogin.html';
      return false;
    }
    return true;
  }
}

// Initialize the admin login when the script loads
const adminLogin = new AdminLogin();

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AdminLogin, AdminAuth };
}