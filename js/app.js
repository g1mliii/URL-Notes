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
              window.location.href = '/dashboard';
              return;
            }
          }
        } else {
          // User is not authenticated - redirect to login if on protected pages
          const currentPath = window.location.pathname;
          if (currentPath.includes('/dashboard') || currentPath.includes('/account')) {
            // Show a message and redirect after a short delay
            if (window.auth && window.auth.showNotification) {
              window.auth.showNotification('Please sign in to access this page', 'info');
            }
            setTimeout(() => {
              window.location.href = '/?redirect=' + encodeURIComponent(currentPath);
            }, 1500);
            return;
          }
        }
      } else {
        // Auth module not ready yet - for protected pages, redirect immediately
        const currentPath = window.location.pathname;
        if (currentPath.includes('/dashboard') || currentPath.includes('/account')) {
          window.location.href = '/?redirect=' + encodeURIComponent(currentPath);
          return;
        }
        this.isAuthenticated = false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.isAuthenticated = false;

      // On error, redirect protected pages to login
      const currentPath = window.location.pathname;
      if (currentPath.includes('/dashboard') || currentPath.includes('/account')) {
        window.location.href = '/?redirect=' + encodeURIComponent(currentPath);
      }
    }
  }

  initPageHandlers() {
    const path = window.location.pathname;

    if (path === '/' || path === '/index.html' || path.endsWith('index.html')) {
      this.initLandingPage();
    } else if (path.includes('/dashboard')) {
      this.initDashboardPage();
    } else if (path.includes('/account')) {
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
    // Dashboard link handler - check authentication first
    const dashboardLink = document.getElementById('dashboardLink');
    if (dashboardLink) {
      dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDashboardAccess();
      });
    }

    // Note: Logout functionality is handled in auth.js to avoid duplicate listeners

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

  async handleDashboardAccess() {
    // Check if user is authenticated
    if (window.auth && window.auth.isAuthenticated()) {
      // User is authenticated, go to dashboard
      window.location.href = '/dashboard';
    } else {
      // User is not authenticated, show message and scroll to sign-in form
      this.showAuthPrompt();
    }
  }

  showAuthPrompt() {
    // Show a notification
    if (window.auth && window.auth.showNotification) {
      window.auth.showNotification('Please sign in to access your dashboard', 'info');
    }

    // Scroll to the auth form
    const authContainer = document.querySelector('.auth-container');
    if (authContainer) {
      authContainer.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Focus on email input
      setTimeout(() => {
        const emailInput = document.getElementById('loginEmail');
        if (emailInput) {
          emailInput.focus();
        }
      }, 500);
    }
  }

  logout() {
    // Delegate to auth module if available
    if (window.auth && window.auth.handleSignOut) {
      window.auth.handleSignOut();
    } else {
      // Fallback logout - clear all auth-related data
      console.log('Fallback logout - auth module not available');
      localStorage.removeItem('supabase_session');
      localStorage.removeItem('userTier');
      localStorage.removeItem('profileLastChecked');
      localStorage.removeItem('subscriptionLastChecked');
      localStorage.removeItem('cachedSubscription');
      localStorage.removeItem('encryptionKeyLastChecked');
      localStorage.removeItem('cachedKeyMaterial');
      localStorage.removeItem('cachedSalt');

      this.isAuthenticated = false;
      this.currentUser = null;

      // Show message and redirect
      this.showMessage('Signed out', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
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