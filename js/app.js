// Main Application Orchestrator
class App {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.init();
  }

  // Detect search engine crawlers to prevent redirect issues
  isSearchEngineCrawler() {
    const userAgent = navigator.userAgent.toLowerCase();
    const crawlers = [
      'googlebot',
      'bingbot', 
      'slurp',
      'duckduckbot',
      'baiduspider',
      'yandexbot',
      'facebookexternalhit',
      'twitterbot',
      'linkedinbot'
    ];
    
    return crawlers.some(crawler => userAgent.includes(crawler));
  }

  async init() {
    // Show loading state for protected pages to prevent flashing
    this.showLoadingStateIfNeeded();

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

    // Hide loading state
    this.hideLoadingState();
  }

  // Show loading state for protected pages to prevent redirect flashing
  showLoadingStateIfNeeded() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/dashboard') || currentPath.includes('/account')) {
      // Add a loading overlay to prevent content flashing during auth check
      const loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'auth-loading-overlay';
      loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--bg-primary, #ffffff);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      loadingOverlay.innerHTML = `
        <div style="text-align: center;">
          <div style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #007aff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
          <p style="color: var(--text-secondary, #666); margin: 0;">Loading...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      document.body.appendChild(loadingOverlay);
    }
  }

  // Hide loading state
  hideLoadingState() {
    const loadingOverlay = document.getElementById('auth-loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
  }

  // Wait for auth module to initialize
  async waitForAuthModule() {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait

    while (!window.auth && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.auth) {
      // Auth module not available after timeout
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
      // Skip redirects for search engine crawlers
      if (this.isSearchEngineCrawler()) {
        return;
      }

      // Check for cached authentication state first to prevent race conditions
      const cachedSession = localStorage.getItem('supabase_session');
      const currentPath = window.location.pathname;
      
      // If we have a cached session, use it temporarily to prevent redirects during initialization
      if (cachedSession) {
        try {
          const sessionData = JSON.parse(cachedSession);
          if (sessionData.access_token && sessionData.user) {
            // Temporarily set authenticated state from cache
            this.isAuthenticated = true;
            this.currentUser = sessionData.user;
          }
        } catch (e) {
          // Invalid cached session data
        }
      }

      // Wait for auth module to initialize with timeout
      let authReady = false;
      let attempts = 0;
      const maxAttempts = 30; // 3 seconds max wait
      
      while (!authReady && attempts < maxAttempts) {
        if (window.auth && window.auth.supabaseClient && window.auth.supabaseClient.accessToken !== undefined) {
          authReady = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (authReady && window.auth && window.auth.supabaseClient) {
        // Use authentication status check after API client is fully initialized
        const isAuthed = window.auth.isAuthenticated();
        const user = window.auth.getCurrentUser();

        this.isAuthenticated = isAuthed;
        this.currentUser = user;

        if (isAuthed && user) {
          // User is authenticated - redirect to dashboard if on login page
          if (currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('index.html')) {
            // Don't redirect if we're handling a password reset callback
            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            
            const isRecovery = (urlParams.has('type') && urlParams.get('type') === 'recovery') ||
                              (hashParams.has('type') && hashParams.get('type') === 'recovery');
            
            if (!isRecovery) {
              window.location.href = '/dashboard';
              return;
            }
          }
        } else {
          // User is not authenticated - redirect to login if on protected pages
          if (currentPath.includes('/dashboard') || currentPath.includes('/account')) {
            // Only redirect if we're sure the user is not authenticated (not during initialization)
            if (attempts < maxAttempts) {
              console.log('🚫 Redirecting to login: User not authenticated on protected page', currentPath);
              // Show a message and redirect after a short delay
              if (window.auth && window.auth.showNotification) {
                window.auth.showNotification('Please sign in to access this page', 'info');
              }
              setTimeout(() => {
                window.location.href = '/?redirect=' + encodeURIComponent(currentPath);
              }, 1500);
              return;
            } else {
              console.log('⚠️ Auth module timeout: Staying on page with cached session fallback');
            }
          }
          this.isAuthenticated = false;
        }
      } else {
        // Auth module not ready after timeout
        if (currentPath.includes('/dashboard') || currentPath.includes('/account')) {
          // Only redirect if we don't have cached session data
          if (!cachedSession) {
            window.location.href = '/?redirect=' + encodeURIComponent(currentPath);
            return;
          }
          // If we have cached session, stay on page and let it load
        }
        
        // Set authenticated state based on cached session if available
        if (!this.isAuthenticated && cachedSession) {
          try {
            const sessionData = JSON.parse(cachedSession);
            if (sessionData.access_token && sessionData.user) {
              this.isAuthenticated = true;
              this.currentUser = sessionData.user;
            }
          } catch (e) {
            this.isAuthenticated = false;
          }
        }
      }
    } catch (error) {
      // Auth check failed silently
      const currentPath = window.location.pathname;
      
      // Check for cached session as fallback
      try {
        const cachedSession = localStorage.getItem('supabase_session');
        if (cachedSession) {
          const sessionData = JSON.parse(cachedSession);
          if (sessionData.access_token && sessionData.user) {
            this.isAuthenticated = true;
            this.currentUser = sessionData.user;
            return; // Don't redirect if we have valid cached session
          }
        }
      } catch (e) {
        // Cached session check failed
      }
      
      this.isAuthenticated = false;

      // On error, redirect protected pages to login only if no cached session
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
  }

  initAccountPage() {
    // Account-specific initialization will be handled in account.js (task 5)
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

    // Account navigation links - handle with authentication check
    const accountLinks = document.querySelectorAll('a[href="/account"], a[href*="/account"]');
    accountLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔗 Account link clicked');
        this.handleAccountAccess();
      });
    });

    // Dashboard navigation links - handle with authentication check  
    const dashboardLinks = document.querySelectorAll('a[href="/dashboard"], a[href*="/dashboard"]');
    dashboardLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔗 Dashboard link clicked');
        this.handleDashboardAccess();
      });
    });

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
    // Check authentication with fallback to cached session
    const isAuthenticated = this.checkAuthenticationForNavigation();
    
    if (isAuthenticated) {
      // User is authenticated, go to dashboard
      window.location.href = '/dashboard';
    } else {
      // User is not authenticated, show message and scroll to sign-in form
      this.showAuthPrompt();
    }
  }

  async handleAccountAccess() {
    // Check authentication with fallback to cached session
    const isAuthenticated = this.checkAuthenticationForNavigation();
    
    if (isAuthenticated) {
      // User is authenticated, go to account page
      window.location.href = '/account';
    } else {
      // User is not authenticated, show message and scroll to sign-in form
      this.showAuthPrompt();
    }
  }

  // Helper method to check authentication for navigation with cached session fallback
  checkAuthenticationForNavigation() {
    // First check if auth module is available and user is authenticated
    if (window.auth && window.auth.isAuthenticated()) {
      console.log('🔐 Auth check: Authenticated via auth module');
      return true;
    }

    // Fallback: check cached session
    try {
      const cachedSession = localStorage.getItem('supabase_session');
      if (cachedSession) {
        const sessionData = JSON.parse(cachedSession);
        if (sessionData.access_token && sessionData.user) {
          // Check if token is not expired
          const expiresAt = sessionData.expires_at || 0;
          const now = Date.now() / 1000; // Convert to seconds
          
          if (expiresAt > now) {
            console.log('🔐 Auth check: Authenticated via cached session');
            return true; // Valid cached session
          } else {
            console.log('🔐 Auth check: Cached session expired');
          }
        } else {
          console.log('🔐 Auth check: Invalid cached session data');
        }
      } else {
        console.log('🔐 Auth check: No cached session found');
      }
    } catch (e) {
      console.log('🔐 Auth check: Error checking cached session:', e);
    }

    console.log('🔐 Auth check: Not authenticated');
    return false;
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
      // API call failed silently
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