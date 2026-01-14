// API Configuration
const API_BASE = "https://backend-3-hqil.onrender.com";

// Admin Login Handler
class AdminLogin {
  constructor() {
    this.init();
  }

  init() {
    // Setup event listeners when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
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

    // Clear messages when user starts typing
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    [emailInput, passwordInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => this.clearMessages());
      }
    });
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const submitButton = e.target.querySelector('button[type="submit"]');

    // Validate inputs
    if (!this.validateInputs(email, password)) {
      return;
    }

    // Show loading state
    this.setLoadingState(submitButton, true);
    this.clearMessages();

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.message === 'Login successful') {
        this.handleLoginSuccess(data);
      } else {
        this.handleLoginError(data.message || 'Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.handleLoginError('Unable to connect to server. Please try again later.');
    } finally {
      this.setLoadingState(submitButton, false);
    }
  }

  validateInputs(email, password) {
    // Check if fields are empty
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return false;
    }

    // Email validation
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
    console.log('Login successful:', data);

    // Store authentication data in sessionStorage
    if (data.token) {
      sessionStorage.setItem('authToken', data.token);
    }

    if (data.admin) {
      sessionStorage.setItem('adminId', data.admin.id);
      sessionStorage.setItem('adminInfo', JSON.stringify(data.admin));
    }

    // Also store in localStorage as backup
    if (data.token) {
      localStorage.setItem('adminToken', data.token);
    }

    // Show success message
    this.showSuccess('Login successful! Redirecting...');

    // Redirect to admin dashboard
    setTimeout(() => {
      window.location.href = 'adminDashboard.html';
    }, 1000);
  }

  handleLoginError(message) {
    console.error('Login failed:', message);
    this.showError(message);
    
    // Shake the form for visual feedback
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
      loginCard.style.animation = 'none';
      setTimeout(() => {
        loginCard.style.animation = 'shake 0.5s ease';
      }, 10);
    }
  }

  togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('togglePassword');

    if (passwordInput && toggleIcon) {
      const isPassword = passwordInput.type === 'password';
      
      passwordInput.type = isPassword ? 'text' : 'password';
      toggleIcon.classList.toggle('fa-eye', !isPassword);
      toggleIcon.classList.toggle('fa-eye-slash', isPassword);
    }
  }

  showError(message) {
    const errorMsg = document.getElementById('error-message');
    const successMsg = document.getElementById('success-message');
    
    if (successMsg) {
      successMsg.classList.remove('show');
    }
    
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.classList.add('show');
    }
  }

  showSuccess(message) {
    const errorMsg = document.getElementById('error-message');
    const successMsg = document.getElementById('success-message');
    
    if (errorMsg) {
      errorMsg.classList.remove('show');
    }
    
    if (successMsg) {
      successMsg.textContent = message;
      successMsg.classList.add('show');
    }
  }

  clearMessages() {
    const errorMsg = document.getElementById('error-message');
    const successMsg = document.getElementById('success-message');
    
    if (errorMsg) {
      errorMsg.classList.remove('show');
    }
    
    if (successMsg) {
      successMsg.classList.remove('show');
    }
  }

  setLoadingState(button, isLoading) {
    if (!button) return;

    if (isLoading) {
      button.disabled = true;
      button.classList.add('loading');
    } else {
      button.disabled = false;
      button.classList.remove('loading');
    }
  }
}

// Check if user is already logged in
function checkExistingSession() {
  const authToken = sessionStorage.getItem('authToken') || localStorage.getItem('adminToken');
  const adminId = sessionStorage.getItem('adminId');
  
  if (authToken && adminId) {
    // User is already logged in, redirect to dashboard
    console.log('Existing session found, redirecting to dashboard...');
    window.location.href = 'adminDashboard.html';
  }
}

// Initialize the admin login system
checkExistingSession();
const adminLogin = new AdminLogin();

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminLogin;
}