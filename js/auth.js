// Authentication Module - Web Application Implementation
// Ported from extension settings.js with web-specific adaptations
class Auth {
  constructor() {
    this.supabaseClient = null; // Will be initialized from global instance
    this.encryption = null; // Will be set after encryption library loads
    
    // Auth form elements (similar to extension settings.js)
    this.authEmailInput = null;
    this.authPasswordInput = null;
    this.authTogglePwBtn = null;
    this.authSignUpBtn = null;
    this.authSignInBtn = null;
    this.authSignOutBtn = null;
    this.authStatusText = null;
    this.authForgotPwBtn = null;
    
    this.init();
  }

  async init() {
    // Initialize Supabase client from global instance
    if (window.supabaseClient) {
      this.supabaseClient = window.supabaseClient;
      await this.supabaseClient.init();
    } else {
      // Supabase client not available
    }
    
    // Initialize encryption library
    if (window.noteEncryption) {
      this.encryption = window.noteEncryption;
    } else {
      // Encryption library not available
    }
    
    // Initialize auth form elements
    this.initAuthElements();
    
    // Set up form listeners
    this.setupFormListeners();
    
    // Check for OAuth callback and password reset
    try {
      // Don't await - call it without blocking
      this.handleOAuthCallback().then(() => {
        // OAuth callback completed
      }).catch((error) => {
        // Error in handleOAuthCallback
      });
    } catch (error) {
      // Error calling handleOAuthCallback
    }
    
    // Update auth UI based on current state
    try {
      await this.updateAuthUI();
    } catch (error) {
      // Error in updateAuthUI
    }
    
    // Set up authentication state monitoring
    try {
      this.setupAuthStateMonitoring();
    } catch (error) {
      // Error in setupAuthStateMonitoring
    }
  }

  // Initialize auth form elements (adapted from extension settings.js)
  initAuthElements() {
    // Map web form elements to extension-style references
    this.authEmailInput = document.getElementById('loginEmail') || document.getElementById('registerEmail') || document.getElementById('resetEmail');
    this.authPasswordInput = document.getElementById('loginPassword') || document.getElementById('registerPassword');
    this.authSignInBtn = document.querySelector('#signInForm button[type="submit"]');
    this.authSignUpBtn = document.querySelector('#signUpForm button[type="submit"]');
    this.authForgotPwBtn = document.querySelector('#resetPasswordForm button[type="submit"]');
    
    // For dashboard/account pages
    this.authSignOutBtn = document.getElementById('logoutBtn');
    this.authStatusText = document.getElementById('authStatus');
  }

  setupFormListeners() {
    // Sign in form
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
      signInForm.addEventListener('submit', (e) => this.handleSignIn(e));
    }

    // Sign up form
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
      signUpForm.addEventListener('submit', (e) => this.handleSignUp(e));
    }

    // Reset password form
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
      resetPasswordForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
    }

    // Sign out button (for dashboard/account pages)
    if (this.authSignOutBtn) {
      this.authSignOutBtn.addEventListener('click', () => this.handleSignOut());
    }

    // Password visibility toggle (if available)
    const toggleBtns = document.querySelectorAll('.toggle-password');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => this.togglePasswordVisibility(btn));
    });

    // Enter key handlers for email/password inputs
    const emailInputs = document.querySelectorAll('input[type="email"]');
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    
    emailInputs.forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleEnterKeyAuth(input);
        }
      });
    });

    passwordInputs.forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleEnterKeyAuth(input);
        }
      });
    });
  }

  // Handle Enter key press in auth forms (adapted from extension)
  handleEnterKeyAuth(input) {
    const form = input.closest('form');
    if (!form) return;

    if (form.id === 'signInForm') {
      this.handleSignIn({ preventDefault: () => {} });
    } else if (form.id === 'signUpForm') {
      this.handleSignUp({ preventDefault: () => {} });
    } else if (form.id === 'resetPasswordForm') {
      this.handleForgotPassword({ preventDefault: () => {} });
    }
  }

  // Toggle password visibility (adapted from extension)
  togglePasswordVisibility(toggleBtn) {
    const passwordInput = toggleBtn.previousElementSibling || toggleBtn.parentElement.querySelector('input[type="password"], input[type="text"]');
    if (!passwordInput) return;

    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  }

  // Get auth inputs (adapted from extension settings.js)
  getAuthInputs() {
    const emailInput = document.getElementById('loginEmail') || document.getElementById('registerEmail') || document.getElementById('resetEmail');
    const passwordInput = document.getElementById('loginPassword') || document.getElementById('registerPassword');
    
    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';
    return { email, password };
  }

  // Handle sign in (adapted from extension settings.js)
  async handleSignIn(event) {
    event.preventDefault();
    
    if (!this.supabaseClient) {
      this.showNotification('Authentication service not available', 'error');
      return;
    }

    // Use enhanced sign in with redirect handling
    await this.signInWithRedirect();
  }

  // Handle sign up (adapted from extension settings.js)
  async handleSignUp(event) {
    event.preventDefault();
    
    const email = document.getElementById('registerEmail')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    if (!email || !password) {
      this.showNotification('Enter email and password', 'error');
      return;
    }

    if (password !== confirmPassword) {
      this.showNotification('Passwords do not match', 'error');
      return;
    }

    if (!this.supabaseClient) {
      this.showNotification('Authentication service not available', 'error');
      return;
    }

    // Use enhanced sign up with redirect handling
    await this.signUpWithRedirect(email, password);
  }

  // Handle forgot password (adapted from extension settings.js)
  async handleForgotPassword(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('resetEmail');
    const email = emailInput?.value?.trim();
    const submitBtn = document.querySelector('#resetPasswordForm button[type="submit"]');
    
    // Clear previous error states
    if (emailInput) {
      emailInput.style.borderColor = '';
    }
    
    if (!email) {
      this.showNotification('Please enter your email address', 'error');
      if (emailInput) {
        emailInput.style.borderColor = 'var(--error-color)';
        emailInput.focus();
      }
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showNotification('Please enter a valid email address', 'error');
      if (emailInput) {
        emailInput.style.borderColor = 'var(--error-color)';
        emailInput.focus();
      }
      return;
    }

    if (!this.supabaseClient) {
      this.showNotification('Authentication service not available', 'error');
      return;
    }

    try {
      this.setAuthBusy(true);
      
      // Update button state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Sending...';
      }
      
      // Password reset attempt for email
      
      // Use same resetPassword method as extension
      await this.supabaseClient.resetPassword(email);
      
      // Success state
      if (submitBtn) {
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'Email Sent!';
        submitBtn.style.background = 'var(--success-color)';
      }
      
      this.showNotification('Password reset email sent. Check your inbox and spam folder.', 'success');
      
      // Switch back to login form after delay (same as extension behavior)
      setTimeout(() => {
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');
        const loginForm = document.getElementById('loginForm');
        if (forgotPasswordForm && loginForm && window.app) {
          window.app.switchAuthForm(forgotPasswordForm, loginForm);
        }
        
        // Reset button state
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('loading');
          submitBtn.textContent = 'Send Reset Link';
          submitBtn.style.background = '';
        }
      }, 3000);
      
    } catch (error) {
      // Password reset error
      const userMessage = this.handlePasswordResetError(error);
      this.showNotification(userMessage, 'error');
      
      // Reset button state
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'Send Reset Link';
      }
      
      // Focus back to email input
      if (emailInput) {
        emailInput.focus();
      }
    } finally {
      this.setAuthBusy(false);
    }
  }

  // Handle sign out (adapted from extension settings.js)
  async handleSignOut() {
    if (!this.supabaseClient) {
      window.location.href = '/';
      return;
    }

    try {
      this.setAuthBusy(true);
      await this.supabaseClient.signOut();
      
      try {
        this.showNotification('Signed out', 'success');
      } catch (notifError) {
        // Notification error
      }
      
      // Redirect after short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
      
    } catch (error) {
      // Sign out error
      
      try {
        this.showNotification(`Sign out failed: ${error.message || error}`, 'error');
      } catch (notifError) {
        // Notification error during error handling
      }
      
      // Force redirect even if sign out fails
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } finally {
      try {
        this.setAuthBusy(false);
      } catch (finallyError) {
        // Error in finally block
      }
    }
  }

  // Update auth UI (adapted from extension settings.js)
  async updateAuthUI() {
    try {
      const isAuthed = this.supabaseClient?.isAuthenticated?.() || false;
      const user = this.supabaseClient?.getCurrentUser?.();
      
      // Helper to toggle element visibility
      const show = (el, on = true) => { 
        if (el) el.style.display = on ? 'block' : 'none'; 
      };

      if (isAuthed && user) {
        // User is authenticated - update status display
        if (this.authStatusText) {
          this.authStatusText.textContent = `Logged in as ${user.email || 'user'}`;
          this.authStatusText.style.display = '';
        }
        
        // Show/hide appropriate elements for authenticated state
        show(this.authSignOutBtn, true);
        
        // Hide auth forms if on landing page
        const authContainer = document.querySelector('.auth-container');
        if (authContainer) {
          authContainer.style.display = 'none';
        }
        
      } else {
        // User is not authenticated
        if (this.authStatusText) {
          this.authStatusText.textContent = '';
          this.authStatusText.style.display = 'none';
        }
        
        show(this.authSignOutBtn, false);
        
        // Show auth forms if on landing page
        const authContainer = document.querySelector('.auth-container');
        if (authContainer) {
          authContainer.style.display = 'block';
        }
      }
    } catch (e) {
      // updateAuthUI failed
    }
  }

  // Set auth busy state (adapted from extension settings.js)
  setAuthBusy(busy) {
    const controls = [
      document.getElementById('loginEmail'),
      document.getElementById('registerEmail'), 
      document.getElementById('resetEmail'),
      document.getElementById('loginPassword'),
      document.getElementById('registerPassword'),
      document.getElementById('confirmPassword'),
      this.authSignInBtn,
      this.authSignUpBtn,
      this.authForgotPwBtn,
      this.authSignOutBtn
    ];
    
    controls.forEach(el => { 
      if (el) el.disabled = !!busy; 
    });
    
    if (this.authStatusText) {
      this.authStatusText.style.opacity = busy ? '0.6' : '0.8';
    }
  }

  // Show notification (adapted from extension settings.js with glassmorphism styling)
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Add icon based on type
    let icon = 'ℹ';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠';
    
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
    `;
    
    // Apply glassmorphism styling to match extension design
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: var(--text-primary, #333);
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
      background: var(--glass-bg, rgba(255, 255, 255, 0.1));
      border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.2));
      box-shadow: var(--glass-inset, inset 0 1px 0 rgba(255, 255, 255, 0.1)), var(--glass-shadow, 0 8px 32px rgba(0, 0, 0, 0.1));
      backdrop-filter: blur(var(--backdrop-blur, 10px));
      -webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
      transform: translateX(100%);
      transition: transform 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    // Apply type-specific styling
    if (type === 'success') {
      notification.style.background = 'color-mix(in oklab, var(--accent-primary, #007aff) 20%, var(--glass-bg, rgba(255, 255, 255, 0.1)) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, var(--accent-primary, #007aff) 40%, var(--glass-border, rgba(255, 255, 255, 0.2)) 60%)';
    } else if (type === 'error') {
      notification.style.background = 'color-mix(in oklab, #ff3b30 20%, var(--glass-bg, rgba(255, 255, 255, 0.1)) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, #ff3b30 40%, var(--glass-border, rgba(255, 255, 255, 0.2)) 60%)';
    } else if (type === 'info') {
      notification.style.background = 'color-mix(in oklab, #007aff 20%, var(--glass-bg, rgba(255, 255, 255, 0.1)) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, #007aff 40%, var(--glass-border, rgba(255, 255, 255, 0.2)) 60%)';
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  async getCurrentUser() {
    if (this.supabaseClient) {
      return this.supabaseClient.getCurrentUser();
    }
    return null;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.supabaseClient?.isAuthenticated?.() || false;
  }

  // Web-specific session management (replaces chrome.storage with localStorage)
  async getSession() {
    try {
      const sessionData = localStorage.getItem('supabase_session');
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      // Error getting session
      return null;
    }
  }

  async setSession(sessionData) {
    try {
      localStorage.setItem('supabase_session', JSON.stringify(sessionData));
    } catch (error) {
      // Error setting session
    }
  }

  async clearSession() {
    try {
      localStorage.removeItem('supabase_session');
      // Clear other auth-related data
      localStorage.removeItem('userTier');
      localStorage.removeItem('profileLastChecked');
      localStorage.removeItem('subscriptionLastChecked');
      localStorage.removeItem('cachedSubscription');
      localStorage.removeItem('encryptionKeyLastChecked');
      localStorage.removeItem('cachedKeyMaterial');
      localStorage.removeItem('cachedSalt');
    } catch (error) {
      // Error clearing session
    }
  }

  // Handle authentication success with web-specific redirect logic
  async handleAuthenticationSuccess(user) {
    try {
      // Update UI immediately
      this.updateAuthUI();
      
      // Emit auth changed event if event bus is available
      try {
        window.eventBus?.emit('auth:changed', { user });
      } catch (_) {}
      
      // Check for redirect parameter first
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirect');
      
      if (redirectTo) {
        // Clear the redirect parameter and go to intended destination
        window.history.replaceState({}, document.title, window.location.pathname);
        return redirectTo;
      }
      
      // Determine redirect destination based on current page
      const currentPath = window.location.pathname;
      
      if (currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('index.html')) {
        // Redirect from landing page to dashboard
        return '/dashboard';
      } else if (currentPath.includes('/account')) {
        // Stay on account page, just update UI
        return null;
      } else if (currentPath.includes('/dashboard')) {
        // Stay on dashboard, just update UI
        return null;
      } else {
        // Default redirect to dashboard
        return '/dashboard';
      }
    } catch (error) {
      // Error handling authentication success
      return '/dashboard'; // Default fallback
    }
  }

  // Verify reset token validity
  async verifyResetToken(accessToken) {
    if (!this.supabaseClient || !accessToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.supabaseClient.authUrl}/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': this.supabaseClient.supabaseAnonKey
        }
      });

      if (!response.ok) {
        const error = await response.json();
        // Token verification failed
        return false;
      }

      return true;
    } catch (error) {
      // Token verification error
      return false;
    }
  }

  // Handle password reset errors with user-friendly messages
  handlePasswordResetError(error) {
    let userMessage = 'Password reset failed. Please try again.';
    
    if (error.message) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('expired') || errorMsg.includes('invalid')) {
        userMessage = 'Password reset link has expired. Please request a new one.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (errorMsg.includes('weak') || errorMsg.includes('password')) {
        userMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (errorMsg.includes('rate limit') || errorMsg.includes('too many')) {
        userMessage = 'Too many attempts. Please wait a few minutes before trying again.';
      } else if (errorMsg.includes('user not found') || errorMsg.includes('email')) {
        userMessage = 'Email address not found. Please check your email or create a new account.';
      }
    }
    
    return userMessage;
  }

  // Enhanced password reset flow with encryption key migration support
  async handlePasswordReset(newPassword, resetToken) {
    if (!this.supabaseClient) {
      throw new Error('Authentication service not available');
    }

    try {
      // First, update the password using Supabase
      const response = await fetch(`${this.supabaseClient.authUrl}/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resetToken}`,
          'apikey': this.supabaseClient.supabaseAnonKey
        },
        body: JSON.stringify({
          password: newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Password update failed');
      }

      const userData = await response.json();
      
      // Handle encryption key migration if user has existing notes
      if (userData.user && this.encryption) {
        await this.migrateEncryptionKeys(userData.user, newPassword);
      }

      // Update session with new user data
      await this.supabaseClient.handleAuthSuccess(userData);
      
      this.showNotification('Password updated successfully', 'success');
      return userData.user;
      
    } catch (error) {
      // Password reset error
      throw error;
    }
  }

  // Encryption key migration for password changes (reuses extension logic)
  async migrateEncryptionKeys(user, newPassword) {
    if (!this.encryption || !this.supabaseClient) {
      // Encryption or Supabase client not available for key migration
      return;
    }

    try {
      // Starting encryption key migration for password change
      
      // Get old encryption key (from cached data)
      const oldKey = await this.supabaseClient.getUserEncryptionKey();
      
      // Generate new encryption key with new password
      const keyMaterial = `${user.id}:${user.email}`;
      
      // Get salt from profile (should already exist)
      let salt = null;
      try {
        const profile = await this.supabaseClient._request(
          `${this.supabaseClient.apiUrl}/profiles?id=eq.${user.id}&select=salt`, 
          { auth: true }
        );
        salt = profile?.[0]?.salt;
      } catch (error) {
        // Could not fetch salt for key migration
        return; // Skip migration if we can't get salt
      }

      if (!salt) {
        // No salt found for key migration
        return;
      }

      const newKey = await this.encryption.generateKey(keyMaterial, salt);
      
      // Fetch all user's notes
      const notes = await this.supabaseClient.fetchNotes();
      
      if (notes.length === 0) {
        return;
      }
      
      // Re-encrypt all notes with new key
      const migratedNotes = [];
      for (const note of notes) {
        try {
          // Note is already decrypted from fetchNotes, so we just need to re-encrypt
          const reencryptedNote = await this.encryption.encryptNoteForCloud(note, newKey);
          migratedNotes.push(reencryptedNote);
        } catch (error) {
          // Failed to migrate note
          // Continue with other notes
        }
      }

      // Sync migrated notes back to cloud
      if (migratedNotes.length > 0) {
        await this.supabaseClient.syncNotes({
          operation: 'push',
          notes: migratedNotes,
          deletions: [],
          lastSyncTime: null,
          timestamp: Date.now()
        });
        
        // Successfully migrated notes
      }
      
      // Clear cached encryption key data to force regeneration
      await this.supabaseClient.removeStorage([
        'encryptionKeyLastChecked', 
        'cachedKeyMaterial', 
        'cachedSalt'
      ]);
      
    } catch (error) {
      // Encryption key migration failed
      // Don't throw - password change should still succeed even if migration fails
      this.showNotification('Password updated, but note encryption migration failed. Some notes may be inaccessible.', 'error');
    }
  }

  // Handle OAuth callback with proper error handling and redirect
  async handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Also check URL hash fragment for Supabase auth tokens
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Handle success messages from redirects
    const message = urlParams.get('message');
    if (message === 'password-reset-success') {
      this.showNotification('Password updated successfully! You can now sign in with your new password.', 'success');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Handle OAuth callback
    
    if (urlParams.has('code') && this.supabaseClient) {
      try {
        await this.supabaseClient.handleOAuthCallback();
        
        // Get user after successful OAuth
        const user = this.supabaseClient.getCurrentUser();
        
        // Handle authentication success and get redirect destination
        const redirectTo = await this.handleAuthenticationSuccess(user);
        
        if (redirectTo) {
          window.location.href = redirectTo;
        }
        
      } catch (error) {
        // OAuth callback error
        this.showNotification('Authentication failed. Please try again.', 'error');
        
        // Clean up URL and redirect to login
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.href = '/';
      }
    }
    
    // Handle password reset callback - check both query params and hash fragment
    const isRecovery = (urlParams.has('type') && urlParams.get('type') === 'recovery') ||
                      (hashParams.has('type') && hashParams.get('type') === 'recovery');
    
    if (isRecovery) {
      await this.handlePasswordResetCallback();
    }
  }

  // Handle password reset callback from email link
  async handlePasswordResetCallback() {
    
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Check both query params and hash fragment for tokens
    const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');
    const type = urlParams.get('type') || hashParams.get('type');
    const error = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
    
    // Check for password reset tokens
    
    // Show loading state while processing
    this.showNotification('Processing password reset link...', 'info');
    
    // Handle errors from Supabase
    if (error) {
      // Password reset callback error
      
      let userMessage = 'Password reset failed. Please try again.';
      if (errorDescription) {
        if (errorDescription.includes('expired')) {
          userMessage = 'Password reset link has expired. Please request a new one.';
        } else if (errorDescription.includes('invalid')) {
          userMessage = 'Invalid password reset link. Please request a new one.';
        } else {
          userMessage = `Password reset failed: ${errorDescription}`;
        }
      }
      
      this.showNotification(userMessage, 'error');
      
      // Clean up URL and redirect
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        window.location.href = '/';
      }, 4000);
      return;
    }
    
    if (type !== 'recovery' || !accessToken) {
      this.showNotification('Invalid password reset link. Please request a new one.', 'error');
      
      // Clean up URL and redirect
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        window.location.href = '/';
      }, 4000);
      return;
    }

    try {
      // Verify the token is valid before showing the form
      const isValid = await this.verifyResetToken(accessToken);
      if (!isValid) {
        throw new Error('Reset token is invalid or expired');
      }
      
      // Show success message and password reset form
      this.showNotification('Password reset link verified. Please enter your new password.', 'success');
      
      // Show password reset form after a brief delay
      setTimeout(() => {
        try {
          this.showPasswordResetForm(accessToken, refreshToken);
        } catch (error) {
          // Error showing password reset form
          this.showNotification('Error showing password reset form. Please try again.', 'error');
        }
      }, 1000);
      
    } catch (error) {
      // Password reset callback error
      
      let userMessage = 'Password reset link expired or invalid. Please request a new one.';
      if (error.message && error.message.includes('network')) {
        userMessage = 'Network error. Please check your connection and try again.';
      }
      
      this.showNotification(userMessage, 'error');
      
      // Clean up URL and redirect
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        window.location.href = '/';
      }, 4000);
    }
  }

  // Show password reset form (creates a modal or redirects to reset page)
  showPasswordResetForm(accessToken, refreshToken) {
    
    // Create a modal for password reset
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Set New Password</h3>
          <button class="modal-close" type="button">&times;</button>
        </div>
        <form id="newPasswordForm">
          <div class="input-group">
            <div style="position: relative;">
              <input type="password" id="newPassword" placeholder="New Password (minimum 6 characters)" required minlength="6" autocomplete="new-password">
              <button type="button" class="toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.875rem;">Show</button>
            </div>
          </div>
          <div class="input-group">
            <div style="position: relative;">
              <input type="password" id="confirmNewPassword" placeholder="Confirm New Password" required minlength="6" autocomplete="new-password">
              <button type="button" class="toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.875rem;">Show</button>
            </div>
          </div>
          <button type="submit" class="btn-primary" id="updatePasswordBtn">Update Password</button>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on first input
    setTimeout(() => {
      const firstInput = modal.querySelector('#newPassword');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
    
    // Handle password visibility toggles
    const toggleBtns = modal.querySelectorAll('.toggle-password');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? 'Hide' : 'Show';
      });
    });
    
    // Handle form submission
    const form = modal.querySelector('#newPasswordForm');
    const submitBtn = modal.querySelector('#updatePasswordBtn');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newPasswordInput = document.getElementById('newPassword');
      const confirmPasswordInput = document.getElementById('confirmNewPassword');
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      
      // Clear previous error states
      newPasswordInput.style.borderColor = '';
      confirmPasswordInput.style.borderColor = '';
      
      // Validation
      if (newPassword.length < 6) {
        this.showNotification('Password must be at least 6 characters long', 'error');
        newPasswordInput.style.borderColor = 'var(--error-color)';
        newPasswordInput.focus();
        return;
      }
      
      if (newPassword !== confirmPassword) {
        this.showNotification('Passwords do not match', 'error');
        confirmPasswordInput.style.borderColor = 'var(--error-color)';
        confirmPasswordInput.focus();
        return;
      }
      
      try {
        // Set loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Updating...';
        
        // Update password using the reset token
        await this.handlePasswordReset(newPassword, accessToken);
        
        // Success state
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'Success!';
        submitBtn.style.background = 'var(--success-color)';
        
        // Show success message
        this.showNotification('Password updated successfully! Redirecting to dashboard...', 'success');
        
        // Close modal and redirect after delay
        setTimeout(() => {
          if (document.body.contains(modal)) {
            document.body.removeChild(modal);
          }
          
          // Check if user is authenticated and redirect appropriately
          if (this.isAuthenticated()) {
            window.location.href = '/dashboard';
          } else {
            // If not authenticated, redirect to login with success message
            window.location.href = '/?message=password-reset-success';
          }
        }, 1000);
        
      } catch (error) {
        // Password update error
        
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'Update Password';
        
        // Show user-friendly error
        const userMessage = this.handlePasswordResetError(error);
        this.showNotification(userMessage, 'error');
        
        // Focus back to first input
        newPasswordInput.focus();
      }
    });
    
    // Handle modal close
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      // Don't redirect - just close the modal
      // User can navigate manually if needed
    });
    
    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
        // Don't redirect - just close the modal
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Clean up URL (remove both query params and hash fragment)
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Set up authentication state monitoring for web environment
  setupAuthStateMonitoring() {
    // Listen for storage changes (for multi-tab sync)
    window.addEventListener('storage', (e) => {
      if (e.key === 'supabase_session') {
        // Session changed in another tab
        this.handleSessionChange(e.newValue);
      }
    });

    // Listen for auth events from the Supabase client
    try {
      window.eventBus?.on('auth:changed', (data) => {
        this.updateAuthUI();
        
        // Handle logout in other tabs
        if (!data.user && this.isAuthenticated()) {
          this.handleSignOut();
        }
      });
    } catch (_) {
      // Event bus not available
    }

    // Periodic session validation (every 10 minutes to reduce frequency)
    setInterval(async () => {
      if (this.isAuthenticated() && this.supabaseClient) {
        try {
          const isValid = await this.supabaseClient.verifyToken();
          if (!isValid) {
            await this.handleSignOut();
          }
        } catch (error) {
          // Silent validation failure - don't log
        }
      }
    }, 10 * 60 * 1000); // 10 minutes (reduced frequency)
  }

  // Handle session changes from other tabs
  async handleSessionChange(newSessionData) {
    try {
      if (newSessionData) {
        const sessionData = JSON.parse(newSessionData);
        if (sessionData.access_token && sessionData.user) {
          // Session created/updated in another tab
          this.supabaseClient.accessToken = sessionData.access_token;
          this.supabaseClient.currentUser = sessionData.user;
          this.updateAuthUI();
        }
      } else {
        // Session cleared in another tab
        if (this.isAuthenticated()) {
          this.supabaseClient.accessToken = null;
          this.supabaseClient.currentUser = null;
          this.updateAuthUI();
          
          // Redirect to login if on protected page
          const currentPath = window.location.pathname;
          if (currentPath.includes('/dashboard') || currentPath.includes('/account')) {
            window.location.href = '/';
          }
        }
      }
    } catch (error) {
      // Error handling session change
    }
  }

  // Enhanced authentication status check for web environment
  async checkAuthenticationStatus() {
    if (!this.supabaseClient) {
      return false;
    }

    try {
      // Check if we have a stored session
      const session = await this.getSession();
      if (!session || !session.access_token) {
        return false;
      }

      // Verify the token is still valid
      const isValid = await this.supabaseClient.verifyToken();
      if (!isValid) {
        await this.clearSession();
        return false;
      }

      // Update client state
      this.supabaseClient.accessToken = session.access_token;
      this.supabaseClient.currentUser = session.user;
      
      return true;
    } catch (error) {
      // Auth status check failed
      await this.clearSession();
      return false;
    }
  }

  // Get subscription status (for premium features)
  async getSubscriptionStatus() {
    if (!this.supabaseClient || !this.isAuthenticated()) {
      return { active: false, tier: 'free' };
    }

    try {
      return await this.supabaseClient.getSubscriptionStatus();
    } catch (error) {
      // Error getting subscription status
      return { active: false, tier: 'free' };
    }
  }

  // Enhanced sign in with proper redirect handling
  async signInWithRedirect(email, password) {
    const { email: inputEmail, password: inputPassword } = this.getAuthInputs();
    const finalEmail = email || inputEmail;
    const finalPassword = password || inputPassword;
    
    if (!finalEmail || !finalPassword) {
      this.showNotification('Enter email and password', 'error');
      return;
    }

    try {
      this.setAuthBusy(true);
      
      await this.supabaseClient.signInWithEmail(finalEmail, finalPassword);
      const user = this.supabaseClient.getCurrentUser();
      
      this.showNotification('Signed in successfully', 'success');
      
      // Handle authentication success and redirect
      const redirectTo = await this.handleAuthenticationSuccess(user);
      
      if (redirectTo) {
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 1000);
      }
      
    } catch (error) {
      // Sign in error
      let errorMessage = `Sign in failed: ${error.message || error}`;
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address by clicking the link we sent to your inbox before signing in';
      }
      
      this.showNotification(errorMessage, 'error');
    } finally {
      this.setAuthBusy(false);
    }
  }

  // Enhanced sign up with proper redirect handling  
  async signUpWithRedirect(email, password) {
    try {
      this.setAuthBusy(true);
      
      await this.supabaseClient.signUpWithEmail(email, password);
      
      // Ensure session by signing in (same as extension logic)
      if (!this.supabaseClient.isAuthenticated()) {
        await this.supabaseClient.signInWithEmail(email, password);
      }
      
      const user = this.supabaseClient.getCurrentUser();
      
      this.showNotification('Account created successfully! Please check your email to verify your account.', 'success');
      
      // Handle authentication success and redirect
      const redirectTo = await this.handleAuthenticationSuccess(user);
      
      if (redirectTo) {
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 1000);
      }
      
    } catch (error) {
      // Sign up error
      let errorMessage = `Sign up failed: ${error.message || error}`;
      
      if (error.message.includes('already registered')) {
        errorMessage = 'An account with this email already exists';
      } else if (error.message.includes('Password')) {
        errorMessage = 'Password must be at least 6 characters long';
      } else if (error.message.includes('Email not confirmed') || error.message.includes('confirm')) {
        errorMessage = 'Please verify your email address by clicking the link we sent to your inbox';
      }
      
      this.showNotification(errorMessage, 'error');
    } finally {
      this.setAuthBusy(false);
    }
  }

  // Handle OAuth callback for web environment
  async handleOAuthCallback() {
    // Check if we're on a callback URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') && this.supabaseClient) {
      try {
        await this.supabaseClient.handleOAuthCallback();
        // Redirect to dashboard after successful OAuth
        window.location.href = '/dashboard';
      } catch (error) {
        // OAuth callback error
        window.app.showMessage('Authentication failed. Please try again.', 'error');
        // Redirect to login page
        window.location.href = '/';
      }
    }
  }

  // OAuth sign in methods for web environment
  async signInWithGoogle() {
    if (!this.supabaseClient) {
      window.app.showMessage('Authentication service not available.', 'error');
      return;
    }

    try {
      await this.supabaseClient.signInWithOAuth('google');
    } catch (error) {
      // Google sign in error
      window.app.showMessage('Google sign in failed. Please try again.', 'error');
    }
  }

  async signInWithGitHub() {
    if (!this.supabaseClient) {
      window.app.showMessage('Authentication service not available.', 'error');
      return;
    }

    try {
      await this.supabaseClient.signInWithOAuth('github');
    } catch (error) {
      // GitHub sign in error
      window.app.showMessage('GitHub sign in failed. Please try again.', 'error');
    }
  }

  // Test function for encryption integration (Task 2.1)
  async testEncryption() {
    if (!this.encryption) {
      // Encryption library not available
      return false;
    }

    try {
      // Testing encryption integration
      
      // Test basic encryption
      const password = 'test-password-123';
      const salt = this.encryption.generateSalt();
      const key = await this.encryption.generateKey(password, salt);
      
      const testNote = {
        title: 'Integration Test Note',
        content: 'This is a test note for web app integration 🚀',
        tags: ['test', 'integration'],
        url: 'https://example.com',
        domain: 'example.com'
      };
      
      // Encrypt note
      const encrypted = await this.encryption.encryptNoteForCloud(testNote, key);

      
      // Decrypt note
      const decrypted = await this.encryption.decryptNoteFromCloud(encrypted, key);

      
      // Verify integrity
      const isValid = decrypted.title === testNote.title && 
                     decrypted.content === testNote.content;
      
      if (isValid) {

        return true;
      } else {
        // Decrypted data does not match original
        return false;
      }
      
    } catch (error) {
      // Encryption integration test failed
      return false;
    }
  }
}

// Initialize auth module when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.auth = new Auth();
  
  // Auto-detect password reset on page load
  setTimeout(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isRecovery = hashParams.has('type') && hashParams.get('type') === 'recovery';
    const hasTokens = hashParams.has('access_token') && hashParams.has('refresh_token');
    
    if (isRecovery && hasTokens) {
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      // Show notification first
      window.auth.showNotification('Password reset link verified. Please enter your new password.', 'success');
      
      // Show modal after brief delay
      setTimeout(() => {
        window.auth.showPasswordResetForm(accessToken, refreshToken);
      }, 500);
    }
  }, 1000); // Wait 1 second for everything to load
});

// Export for use in other modules
window.Auth = Auth;