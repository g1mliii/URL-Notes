// Main Application Orchestrator
class App {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.init();
  }

  async init() {
    // Initialize theme
    this.initTheme();
    
    // Wait for auth module to be ready
    await this.waitForAuthModule();
    
    // Check authentication status
    await this.checkAuthStatus();
    
    // Initialize page-specific functionality
    this.initPageHandlers();
    
    // Set up global event listeners
    this.setupGlobalListeners();
  }

  // Wait for auth module to initialize
  async waitForAuthModule() {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    while (!window.auth && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (window.auth) {
      console.log('✅ Auth module ready');
    } else {
      console.warn('⚠️ Auth module not available after timeout');
    }
  }

  initTheme() {
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (systemPrefersDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }

  async checkAuthStatus() {
    try {
      // Wait for auth module to initialize
      if (window.auth && window.auth.supabaseClient) {
        // Use enhanced authentication status check
        const isAuthed = await window.auth.checkAuthenticationStatus();
        const user = await window.auth.getCurrentUser();
        
        this.isAuthenticated = isAuthed;
        this.currentUser = user;
        
        if (isAuthed && user) {
          // User is authenticated - redirect to dashboard if on login page
          const currentPath = window.location.pathname;
          if (currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('index.html')) {
            // Don't redirect if we're handling a password reset callback
            const urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.has('type') || urlParams.get('type') !== 'recovery') {
              window.location.href = 'dashboard.html';
              return;
            }
          }
        } else {
          // User is not authenticated - redirect to login if on protected pages
          const currentPath = window.location.pathname;
          if (currentPath.includes('dashboard.html') || currentPath.includes('account.html')) {
            window.location.href = 'index.html';
            return;
          }
        }
      } else {
        // Auth module not ready yet, will be handled by auth module initialization
        this.isAuthenticated = false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.isAuthenticated = false;
    }
  }

  initPageHandlers() {
    const path = window.location.pathname;
    
    if (path === '/' || path === '/index.html' || path.endsWith('index.html')) {
      this.initLandingPage();
    } else if (path.includes('dashboard.html')) {
      this.initDashboardPage();
    } else if (path.includes('account.html')) {
      this.initAccountPage();
    }
  }

  initLandingPage() {
    // Auth form switching
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const showForgotPassword = document.getElementById('showForgotPassword');
    const backToLogin = document.getElementById('backToLogin');
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    if (showRegister) {
      showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthForm(loginForm, registerForm);
      });
    }

    if (showLogin) {
      showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthForm(registerForm, loginForm);
      });
    }

    if (showForgotPassword) {
      showForgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthForm(loginForm, forgotPasswordForm);
      });
    }

    if (backToLogin) {
      backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthForm(forgotPasswordForm, loginForm);
      });
    }

    // Form submissions will be handled in auth.js (task 3)
  }

  initDashboardPage() {
    // Dashboard-specific initialization will be handled in dashboard.js (task 4)
    console.log('Dashboard page initialized');
  }

  initAccountPage() {
    // Account-specific initialization will be handled in account.js (task 5)
    console.log('Account page initialized');
  }

  switchAuthForm(hideForm, showForm) {
    hideForm.classList.add('hidden');
    showForm.classList.remove('hidden');
  }

  setupGlobalListeners() {
    // Global logout functionality
    const logoutBtns = document.querySelectorAll('#logoutBtn');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', () => this.logout());
    });

    // Global modal close functionality
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModal(e.target);
      }
      if (e.target.classList.contains('modal-close')) {
        this.closeModal(e.target.closest('.modal'));
      }
    });

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal:not(.hidden)');
        if (openModal) {
          this.closeModal(openModal);
        }
      }
    });
  }

  logout() {
    // Delegate to auth module if available
    if (window.auth && window.auth.handleSignOut) {
      window.auth.handleSignOut();
    } else {
      // Fallback logout
      localStorage.clear();
      this.isAuthenticated = false;
      this.currentUser = null;
      window.location.href = 'index.html';
    }
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  closeModal(modal) {
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  showMessage(message, type = 'info') {
    // Create and show a temporary message
    const messageEl = document.createElement('div');
    messageEl.className = `${type}-message`;
    messageEl.textContent = message;
    
    // Insert at top of page
    const container = document.querySelector('.app-container');
    if (container) {
      container.insertBefore(messageEl, container.firstChild);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 5000);
    }
  }

  // Utility method for API calls (will be enhanced in task 2)
  async apiCall(endpoint, options = {}) {
    const baseUrl = 'https://your-supabase-url.supabase.co'; // Will be configured properly in task 2
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (this.isAuthenticated) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, finalOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

// Export for use in other modules
window.App = App;