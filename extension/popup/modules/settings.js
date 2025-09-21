// Settings Manager Module
// Handles settings panel, font settings, data import/export, and user preferences

class SettingsManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.settingsPanel = document.getElementById('settingsPanel');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.settingsBackBtn = document.getElementById('settingsBackBtn');
    this.openOnboardingBtn = document.getElementById('openOnboardingBtn');
    this.adDisclaimerBtn = document.getElementById('adDisclaimerBtn');
    this.fontSelector = document.getElementById('fontSelector');
    this.fontSizeSlider = document.getElementById('fontSizeSlider');
    this.fontSizeValue = document.getElementById('fontSizeValue');
    this.fontPreviewText = document.getElementById('fontPreviewText');
    this.exportNotesBtn = document.getElementById('exportNotesBtn');
    this.importNotesBtn = document.getElementById('importNotesBtn');
    this.importNotesInput = document.getElementById('importNotesInput');
    // Auth row container
    this.authRow = document.querySelector('.auth-row');
    // Shortcut elements
    this.shortcutValue = document.getElementById('shortcutValue');
    this.changeShortcutBtn = document.getElementById('changeShortcutBtn');

    // Auth elements
    this.authEmailInput = document.getElementById('authEmailInput');
    this.authPasswordInput = document.getElementById('authPasswordInput');
    this.authTogglePwBtn = document.getElementById('authTogglePwBtn');
    this.authSignUpBtn = document.getElementById('authSignUpBtn');
    this.authSignInBtn = document.getElementById('authSignInBtn');
    this.authSignOutBtn = document.getElementById('authSignOutBtn');
    this.authStatusText = document.getElementById('authStatusText');

    // Sync elements
    this.manualSyncBtn = document.getElementById('manualSyncBtn');

    // Premium status refresh button
    this.refreshPremiumStatusBtn = document.getElementById('refreshPremiumStatusBtn');

    // Website link button
    this.websiteLinkBtn = document.getElementById('websiteLinkBtn');

    this.currentFont = 'Default';
    this.currentFontSize = 12;

    this.setupEventListeners();
  }

  // ===== Auth UI and handlers =====
  async updateAuthUI() {
    try {
      const isAuthed = window.supabaseClient?.isAuthenticated?.() || false;
      const user = window.supabaseClient?.getCurrentUser?.();
      const actions = document.getElementById('authActions');
      const syncManagement = document.getElementById('syncManagement');
      // Helper to toggle element visibility
      const show = (el, on = true) => { if (el) el.style.display = on ? 'block' : 'none'; };

      if (isAuthed && user) {
        // Show compact logged-in state: only status + Sign Out
        if (this.authStatusText) {
          this.authStatusText.textContent = `Logged in as ${user.email || 'user'}`;
          this.authStatusText.style.display = '';
        }
        show(this.authSignOutBtn, true);
        show(this.authSignInBtn, false);
        show(this.authSignUpBtn, false);
        show(this.authForgotPwBtn, false);
        show(this.authEmailInput, false);
        show(this.authPasswordInput, false);
        show(this.authTogglePwBtn, false);
        show(this.authRow, false);
        show(this.refreshPremiumStatusBtn, true); // Show refresh button when logged in
        if (this.authEmailInput) this.authEmailInput.value = user.email || '';
        if (this.authPasswordInput) this.authPasswordInput.value = '';
        if (actions) {
          actions.style.gridTemplateColumns = '1fr';
        }

        // Show sync management for premium users
        // Looking for syncManagement element
        if (syncManagement) {
          try {
            const status = await window.supabaseClient?.getSubscriptionStatus?.();
            // Remove verbose logging
            const shouldShow = status?.active && status?.tier !== 'free';
            // Remove verbose logging
            show(syncManagement, shouldShow);
            // Sync management display updated

            // Update storage usage if sync is visible
            if (shouldShow) {
              this.updateStorageUsage();
            }
          } catch (e) {
            console.error('Error checking premium status:', e);
            show(syncManagement, false);
          }
        } else {
          console.error('Settings: syncManagement element not found!');
        }
      } else {
        // Show full account area; remove "Not signed in" copy
        if (this.authStatusText) {
          this.authStatusText.textContent = '';
          this.authStatusText.style.display = 'none';
        }
        show(this.authSignOutBtn, false);
        show(this.authEmailInput, true);
        show(this.authPasswordInput, true);
        show(this.authTogglePwBtn, true);
        show(this.authRow, true);
        show(this.authForgotPwBtn, true);
        show(this.refreshPremiumStatusBtn, false); // Hide refresh button when not logged in
        // Hide sync management for non-authenticated users
        show(syncManagement, false);
        // Swap buttons: Sign In on left, Sign Up on right
        if (actions && this.authSignInBtn && this.authSignUpBtn) {
          // Ensure correct visual order in CSS Grid by DOM reordering
          this.authSignInBtn.style.display = 'inline-flex';
          this.authSignUpBtn.style.display = 'inline-flex';
          // Put Sign In first, then Sign Up
          actions.prepend(this.authSignInBtn);
          actions.appendChild(this.authSignUpBtn);
        }
        if (actions) {
          actions.style.display = 'grid';
          actions.style.gridTemplateColumns = '1fr 1fr';
        }
      }
    } catch (e) {
      console.warn('updateAuthUI failed:', e);
    }
  }

  togglePasswordVisibility() {
    if (!this.authPasswordInput || !this.authTogglePwBtn) return;
    const isPwd = this.authPasswordInput.type === 'password';
    this.authPasswordInput.type = isPwd ? 'text' : 'password';
    this.authTogglePwBtn.textContent = isPwd ? 'Hide' : 'Show';
  }

  getAuthInputs() {
    const email = (this.authEmailInput?.value || '').trim();
    const password = this.authPasswordInput?.value || '';
    return { email, password };
  }

  async handleSignUp() {
    const { email, password } = this.getAuthInputs();
    if (!email || !password) {
      return this.showNotification('Enter email and password', 'error');
    }
    try {
      this.setAuthBusy(true);
      await window.supabaseClient.signUpWithEmail(email, password);
      // With confirm disabled, ensure session by signing in
      if (!window.supabaseClient.isAuthenticated()) {
        await window.supabaseClient.signInWithEmail(email, password);
      }
      this.showNotification('Signed up successfully', 'success');
      this.updateAuthUI();
    } catch (e) {
      this.showNotification(`Sign up failed: ${e.message || e}`, 'error');
    } finally {
      this.setAuthBusy(false);
    }
  }

  async handleSignIn() {
    const { email, password } = this.getAuthInputs();
    if (!email || !password) {
      return this.showNotification('Enter email and password', 'error');
    }
    try {
      this.setAuthBusy(true);
      await window.supabaseClient.signInWithEmail(email, password);
      this.showNotification('Signed in', 'success');
      this.updateAuthUI();
    } catch (e) {
      this.showNotification(`Sign in failed: ${e.message || e}`, 'error');
    } finally {
      this.setAuthBusy(false);
    }
  }

  async handleSignOut() {
    try {
      this.setAuthBusy(true);
      await window.supabaseClient.signOut();
      this.showNotification('Signed out', 'success');
      this.updateAuthUI();
    } catch (e) {
      this.showNotification(`Sign out failed: ${e.message || e}`, 'error');
    } finally {
      this.setAuthBusy(false);
    }
  }

  async handleForgotPassword() {
    const email = this.authEmailInput?.value || '';
    if (!email) {
      this.showNotification('Please enter your email address', 'error');
      return;
    }

    try {
      this.setAuthBusy(true);
      await window.supabaseClient.resetPassword(email);
      this.showNotification('Password reset email sent. Check your inbox.', 'success');
    } catch (e) {
      this.showNotification(`Password reset failed: ${e.message || e}`, 'error');
    } finally {
      this.setAuthBusy(false);
    }
  }

  async handleManualSync() {
    if (!window.syncEngine) {
      this.showNotification('Sync engine not available', 'error');
      return;
    }

    try {
      this.manualSyncBtn.disabled = true;
      this.manualSyncBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Syncing...</span>
      `;

      await window.syncEngine.manualSync();

      this.manualSyncBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Sync Complete</span>
      `;

      setTimeout(() => {
        this.manualSyncBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            <path d="M12 3v12l3 3"/>
          </svg>
          <span>Sync Now</span>
        `;
        this.manualSyncBtn.disabled = false;
      }, 2000);

      // Update storage usage after sync
      this.updateStorageUsage();

    } catch (e) {
      this.showNotification(`Manual sync failed: ${e.message || e}`, 'error');
      this.manualSyncBtn.disabled = false;
      this.manualSyncBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Sync Now</span>
      `;
    }
  }

  async handleRefreshPremiumStatus() {
    if (!window.supabaseClient?.isAuthenticated()) {
      this.showNotification('Please sign in first', 'error');
      return;
    }

    try {
      // Show loading state
      this.refreshPremiumStatusBtn.disabled = true;
      this.refreshPremiumStatusBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Refreshing...</span>
      `;

      // Clear any cached subscription status
      if (window.supabaseClient.clearSubscriptionCache) {
        window.supabaseClient.clearSubscriptionCache();
      }

      // Force refresh subscription status from server
      const status = await window.supabaseClient.getSubscriptionStatus(true); // Force refresh
      
      // Update userTier in local storage for other parts of the extension
      try {
        const userTier = status.active ? status.tier : 'free';
        await chrome.storage.local.set({ userTier });
      } catch (_) { }
      
      // Emit tier change event to update all parts of the extension
      try { 
        window.eventBus?.emit('tier:changed', { 
          tier: status.tier, 
          active: status.active, 
          expiresAt: status.expiresAt 
        }); 
      } catch (_) { }
      
      // Emit auth:changed event similar to sign-in to refresh all components
      try {
        window.eventBus?.emit('auth:changed', { 
          user: window.supabaseClient.getCurrentUser(),
          statusRefresh: true // Flag to indicate this is a status refresh
        });
      } catch (_) { }
      
      // Notify background script about tier change
      try {
        chrome.runtime.sendMessage({ 
          action: 'tier-changed', 
          tier: status.tier, 
          active: status.active,
          expiresAt: status.expiresAt
        }).catch(() => {});
      } catch (_) { }
      
      // Notify background script about auth change (similar to sign-in)
      try {
        chrome.runtime.sendMessage({ 
          action: 'auth-changed', 
          user: window.supabaseClient.getCurrentUser(),
          statusRefresh: true // Flag to indicate this is a status refresh
        }).catch(() => {});
      } catch (_) { }
      
      // Update ad manager based on new status
      try {
        if (window.adManager) {
          if (status.active && status.tier !== 'free') {
            window.adManager.hideAdContainer?.();
          } else {
            window.adManager.refreshAd?.();
          }
        }
      } catch (_) { }
      
      // Update UI based on new status
      await this.updateAuthUI();

      // Show success message
      if (status?.active && status?.tier !== 'free') {
        this.showNotification(`Premium status confirmed! (${status.tier})`, 'success');
      } else if (status?.tier === 'premium' && !status?.active) {
        this.showNotification('Premium tier found but inactive - check expiration', 'warning');
      } else {
        this.showNotification(`Status refreshed - ${status?.tier || 'free'} tier active`, 'info');
      }

      // Reset button
      this.refreshPremiumStatusBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Status Updated</span>
      `;

      // Reset to original text after 2 seconds
      setTimeout(() => {
        this.refreshPremiumStatusBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            <path d="M12 3v9l3 3"/>
          </svg>
          <span>Refresh Premium Status</span>
        `;
        this.refreshPremiumStatusBtn.disabled = false;
      }, 2000);

    } catch (e) {
      console.error('Premium status refresh failed:', e);
      this.showNotification(`Failed to refresh status: ${e.message || e}`, 'error');
      
      // Reset button on error
      this.refreshPremiumStatusBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Refresh Premium Status</span>
      `;
      this.refreshPremiumStatusBtn.disabled = false;
    }
  }

  async updateStorageUsage() {
    try {
      if (!window.supabaseClient?.isAuthenticated()) return;

      const usage = await window.supabaseClient.getStorageUsage();
      const progressEl = document.getElementById('storageProgress');
      const textEl = document.getElementById('storageText');

      if (progressEl && textEl) {
        const percentage = (usage.used / usage.limit) * 100;
        progressEl.style.width = `${Math.min(percentage, 100)}%`;

        const usedMB = (usage.used / (1024 * 1024)).toFixed(1);
        const limitMB = (usage.limit / (1024 * 1024)).toFixed(1);
        textEl.textContent = `${usedMB} MB / ${limitMB} MB`;

        // Change color based on usage
        if (percentage > 80) {
          progressEl.style.background = 'var(--error-color, #ef4444)';
        } else if (percentage > 60) {
          progressEl.style.background = 'var(--warning-color, #f59e0b)';
        } else {
          progressEl.style.background = 'var(--accent-color)';
        }
      }
    } catch (error) {
      console.warn('Failed to update storage usage:', error);
    }
  }

  setAuthBusy(busy) {
    const controls = [this.authEmailInput, this.authPasswordInput, this.authTogglePwBtn, this.authSignUpBtn, this.authSignInBtn, this.authForgotPwBtn, this.authSignOutBtn];
    controls.forEach(el => { if (el) el.disabled = !!busy; });
    if (this.authStatusText) this.authStatusText.style.opacity = busy ? '0.6' : '0.8';
  }

  setupEventListeners() {
    // Settings panel toggle
    this.settingsBtn?.addEventListener('click', () => this.openSettings());
    this.settingsBackBtn?.addEventListener('click', () => this.closeSettings());

    // Setup scroll indicators for settings content
    this.setupScrollIndicators();

    // Font settings
    this.fontSelector?.addEventListener('change', (e) => this.handleFontChange(e.target.value));
    this.fontSizeSlider?.addEventListener('input', (e) => this.handleFontSizeChange(parseInt(e.target.value)));

    // Data management
    this.exportNotesBtn?.addEventListener('click', () => this.handleExportNotes());
    this.importNotesBtn?.addEventListener('click', () => this.importNotesInput?.click());
    this.importNotesInput?.addEventListener('change', (e) => this.handleImportNotes(e));

    // Sync management
    this.manualSyncBtn?.addEventListener('click', () => this.handleManualSync());

    // Premium status refresh
    this.refreshPremiumStatusBtn?.addEventListener('click', () => this.handleRefreshPremiumStatus());

    // Shortcut settings
    this.changeShortcutBtn?.addEventListener('click', () => this.openShortcutEditor());

    // Auth handlers
    this.authTogglePwBtn?.addEventListener('click', () => this.togglePasswordVisibility());
    this.authSignUpBtn?.addEventListener('click', () => this.handleSignUp());
    this.authSignInBtn?.addEventListener('click', () => this.handleSignIn());
    this.authSignOutBtn?.addEventListener('click', () => this.handleSignOut());
    // Forgot password handler
    this.authForgotPwBtn?.addEventListener('click', () => this.handleForgotPassword());
    // Press Enter to sign in from either field
    this.authEmailInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.handleSignIn(); }
    });
    this.authPasswordInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.handleSignIn(); }
    });

    // Open onboarding
    this.openOnboardingBtn?.addEventListener('click', () => this.openOnboarding());

    // Add manual trigger for onboarding tooltips (for testing/re-showing)
    const showTooltipsBtn = document.getElementById('showTooltipsBtn');
    if (showTooltipsBtn) {
      showTooltipsBtn.addEventListener('click', () => this.showOnboardingTooltips());
    }

    // Open advertising disclosure
    this.adDisclaimerBtn?.addEventListener('click', () => this.openAdDisclosure());

    // Website link button
    this.websiteLinkBtn?.addEventListener('click', () => this.openWebsite());

    // Ad disclaimer link in ad container
    const adDisclaimerLink = document.getElementById('adDisclaimerLink');
    adDisclaimerLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openAdDisclosure();
    });



    // React to global auth and tier changes
    try {
      window.eventBus?.on('auth:changed', () => this.updateAuthUI());
      window.eventBus?.on('tier:changed', () => this.updateAuthUI());
    } catch (_) { }
  }

  // Open settings panel
  openSettings() {
    const notesList = document.querySelector('.notes-container');
    const noteEditor = document.getElementById('noteEditor');

    if (notesList) notesList.style.display = 'none';
    if (noteEditor) noteEditor.style.display = 'none';
    if (this.settingsPanel) {
      this.settingsPanel.style.display = 'block';
      // Reset scroll position to top when opening
      const settingsContent = this.settingsPanel.querySelector('.settings-content');
      if (settingsContent) {
        settingsContent.scrollTop = 0;
      }
    }
    // Refresh shortcut display when opening settings
    this.loadShortcutDisplay();
    // Refresh auth UI
    this.updateAuthUI();
    // Setup scroll indicators after panel is visible
    setTimeout(() => this.setupScrollIndicators(), 50);
  }



  // Close settings panel
  closeSettings() {
    const notesList = document.querySelector('.notes-container');
    const noteEditor = document.getElementById('noteEditor');

    if (this.settingsPanel) this.settingsPanel.style.display = 'none';
    // Restore notes container to its stylesheet-defined display (flex),
    // instead of forcing 'block' which changes layout/background.
    if (notesList) notesList.style.removeProperty('display');



    // Don't automatically show editor - let the main app handle state
  }

  // Load font settings from storage
  async loadFontSetting() {
    try {
      const { fontFamily, fontSize } = await chrome.storage.local.get(['fontFamily', 'fontSize']);

      this.currentFont = fontFamily || 'Default';
      this.currentFontSize = fontSize || 12;

      // Update UI controls
      if (this.fontSelector) {
        this.fontSelector.value = this.currentFont;
      }
      if (this.fontSizeSlider) {
        this.fontSizeSlider.value = this.currentFontSize;
      }
      if (this.fontSizeValue) {
        this.fontSizeValue.textContent = `${this.currentFontSize}px`;
      }

      // Apply font settings
      this.applyFontSettings();
    } catch (error) {
      console.error('Error loading font settings:', error);
    }
  }

  // Handle font family change
  async handleFontChange(fontFamily) {
    this.currentFont = fontFamily;
    await chrome.storage.local.set({ fontFamily });
    this.applyFontSettings();
  }

  // Handle font size change
  async handleFontSizeChange(fontSize) {
    this.currentFontSize = fontSize;
    if (this.fontSizeValue) {
      this.fontSizeValue.textContent = `${fontSize}px`;
    }
    await chrome.storage.local.set({ fontSize });
    this.applyFontSettings();
  }

  // Apply font settings to the UI
  applyFontSettings() {
    const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
    const fontSize = `${this.currentFontSize}px`;

    // Apply to editor content
    const noteContentInput = document.getElementById('noteContentInput');
    if (noteContentInput) {
      noteContentInput.style.fontFamily = fontFamily;
      noteContentInput.style.fontSize = fontSize;
    }

    // Apply to preview
    const noteContentPreview = document.getElementById('noteContentPreview');
    if (noteContentPreview) {
      noteContentPreview.style.fontFamily = fontFamily;
      noteContentPreview.style.fontSize = fontSize;
    }

    // Apply to font preview
    if (this.fontPreviewText) {
      this.fontPreviewText.style.fontFamily = fontFamily;
      this.fontPreviewText.style.fontSize = fontSize;
    }

    // Apply to notes list content
    const notesList = document.getElementById('notesList');
    if (notesList) {
      const noteContents = notesList.querySelectorAll('.note-content');
      noteContents.forEach(content => {
        content.style.fontFamily = fontFamily;
        content.style.fontSize = fontSize;
      });
    }
  }

  // Initialize settings UI
  initSettings() {
    // Ensure font preview is properly styled
    if (this.fontPreviewText) {
      this.applyFontSettings();
    }

    // Set up any other initial settings UI state
    this.updateFontPreview();
    // Initialize shortcut display
    this.loadShortcutDisplay();
    // Initialize auth UI
    this.updateAuthUI();
    // Setup scroll indicators
    this.setupScrollIndicators();
  }

  // Setup scroll indicators for better UX
  setupScrollIndicators() {
    const settingsContent = document.querySelector('.settings-content');
    if (!settingsContent) return;

    const updateScrollIndicators = () => {
      const { scrollTop, scrollHeight, clientHeight } = settingsContent;
      
      // Check if content is scrollable
      const isScrollable = scrollHeight > clientHeight;
      settingsContent.setAttribute('data-scrollable', isScrollable.toString());
      
      // Add 'scrolled' class if user has scrolled down
      if (scrollTop > 10) {
        settingsContent.classList.add('scrolled');
      } else {
        settingsContent.classList.remove('scrolled');
      }
      
      // Add 'has-more' class if there's more content below
      if (scrollTop + clientHeight < scrollHeight - 10) {
        settingsContent.classList.add('has-more');
      } else {
        settingsContent.classList.remove('has-more');
      }
    };

    // Update indicators on scroll
    settingsContent.addEventListener('scroll', updateScrollIndicators);
    
    // Update indicators on resize or content change
    const resizeObserver = new ResizeObserver(updateScrollIndicators);
    resizeObserver.observe(settingsContent);
    
    // Initial update
    setTimeout(updateScrollIndicators, 100);
    
    // Also update when settings panel becomes visible
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const panel = mutation.target;
          if (panel.style.display === 'block') {
            setTimeout(updateScrollIndicators, 50);
          }
        }
      });
    });
    
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
      observer.observe(settingsPanel, { attributes: true });
    }
  }

  // Update font preview display
  updateFontPreview() {
    if (this.fontPreviewText) {
      const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
      this.fontPreviewText.style.fontFamily = fontFamily;
      this.fontPreviewText.style.fontSize = `${this.currentFontSize}px`;
    }
  }

  // Load and display current keyboard shortcut for _execute_action
  async loadShortcutDisplay() {
    try {
      if (!chrome.commands || !chrome.commands.getAll) return;
      const cmds = await chrome.commands.getAll();
      const action = cmds.find(c => c.name === '_execute_action');
      const create = cmds.find(c => c.name === 'create_new_note');
      const openShortcut = action && action.shortcut ? action.shortcut : 'Not set';
      const newShortcut = create && create.shortcut ? create.shortcut : 'Not set';

      // Settings panel values
      if (this.shortcutValue) this.shortcutValue.textContent = openShortcut;
      const newNoteEl = document.getElementById('newNoteShortcutValue');
      if (newNoteEl) newNoteEl.textContent = newShortcut;

      // Header hints
      const headerOpen = document.getElementById('shortcutOpenValue');
      if (headerOpen) headerOpen.textContent = openShortcut;
      const headerNew = document.getElementById('shortcutNewValue');
      if (headerNew) headerNew.textContent = newShortcut;
    } catch (e) {
      console.warn('Failed to load commands:', e);
      if (this.shortcutValue) this.shortcutValue.textContent = 'Not available';
      const newNoteEl = document.getElementById('newNoteShortcutValue');
      if (newNoteEl) newNoteEl.textContent = '';
      const headerOpen = document.getElementById('shortcutOpenValue');
      if (headerOpen) headerOpen.textContent = '';
      const headerNew = document.getElementById('shortcutNewValue');
      if (headerNew) headerNew.textContent = '';
    }
  }

  // Open Chrome's extension shortcuts page for user to change shortcut
  openShortcutEditor() {
    try {
      // Try chrome.tabs first
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(() => {
          // Fallback to window.open
          try { window.open('chrome://extensions/shortcuts', '_blank'); } catch (_) { }
        });
      } else {
        // Fallback
        window.open('chrome://extensions/shortcuts', '_blank');
      }
    } catch (_) { /* noop */ }
  }

  // Open onboarding in new tab (same as new install flow)
  openOnboarding() {
    // Always open in new tab to match new user onboarding experience
    try {
      const url = chrome?.runtime?.getURL ? chrome.runtime.getURL('onboarding.html') : 'onboarding.html';
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url }).catch(() => {
          try { window.open(url, '_blank'); } catch (_) { }
        });
      } else {
        window.open(url, '_blank');
      }
    } catch (_) {
      try { window.open('onboarding.html', '_blank'); } catch (__) { }
    }
  }

  // Open Anchored website in new tab
  openWebsite() {
    try {
      const websiteUrl = 'https://anchored.site';
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: websiteUrl }).catch(() => {
          try { window.open(websiteUrl, '_blank'); } catch (_) { }
        });
      } else {
        window.open(websiteUrl, '_blank');
      }
    } catch (_) {
      try { window.open('https://anchored.site', '_blank'); } catch (__) { }
    }
  }

  // Open advertising disclosure dialog
  openAdDisclosure() {
    const dialog = document.getElementById('adDisclosureDialog');
    if (dialog) {
      dialog.style.display = 'block';

      // Setup close button handlers
      const closeBtn = document.getElementById('adDisclosureCloseBtn');
      const okBtn = document.getElementById('adDisclosureOkBtn');

      const closeDialog = () => {
        dialog.style.display = 'none';
      };

      if (closeBtn) {
        closeBtn.onclick = closeDialog;
      }

      if (okBtn) {
        okBtn.onclick = closeDialog;
      }

      // Close on outside click
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          closeDialog();
        }
      };
    }
  }

  // Show onboarding tooltips manually
  showOnboardingTooltips() {
    try {
      if (window.urlNotesApp && window.urlNotesApp.onboardingTooltips) {
        // Force show main tooltips
        window.urlNotesApp.onboardingTooltips.forceShowTooltips();
      }
    } catch (error) {
      console.warn('Failed to show onboarding tooltips:', error);
    }
  }

  // Show notification helper
  showNotification(message, type = 'info') {
    try {
      // Use the Utils.showToast system
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(message, type);
      } else {
        // Fallback to console
        console.log(`${type.toUpperCase()}: ${message}`);
      }
    } catch (error) {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }





  // Handle export notes
  async handleExportNotes() {
    try {
      const exportData = await this.storageManager.exportNotes();

      // Get selected format
      const formatSelect = document.getElementById('exportFormatSelect');
      const selectedFormat = formatSelect ? formatSelect.value : 'json';

      // Use ExportFormats class to convert data
      const exportFormats = new ExportFormats();
      const exportResult = exportFormats.exportToFormat(exportData, selectedFormat);

      // Create and download file
      const blob = new Blob([exportResult.content], { type: exportResult.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportResult.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show success message with format info
      const formatInfo = exportFormats.getSupportedFormats()[selectedFormat];
      this.showNotification(`Notes exported as ${formatInfo.name} successfully!`, 'success');
    } catch (error) {
      console.error('Error exporting notes:', error);
      this.showNotification('Failed to export notes', 'error');
    }
  }

  // Handle import notes
  async handleImportNotes(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.json')) {
        throw new Error('Please select a JSON file (.json)');
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new Error('File is too large. Maximum size is 50MB.');
      }

      // Show loading state
      this.showNotification('Importing notes...', 'info');

      const text = await file.text();

      // Validate JSON format
      let importData;
      try {
        importData = JSON.parse(text);
      } catch (parseError) {
        throw new Error('Invalid JSON file. Please check the file format.');
      }

      // Validate import data structure
      const validation = this.validateImportData(importData);
      if (!validation.isValid) {
        throw new Error(`Invalid import format: ${validation.error}`);
      }

      const result = await this.storageManager.importNotes(importData);

      // Handle different return formats from different storage managers
      let success = false;
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errorMessage = '';

      if (typeof result === 'number') {
        // IndexedDB storage manager returns just a count
        success = result >= 0;
        imported = result;
      } else if (typeof result === 'object' && result !== null) {
        // Chrome storage manager returns an object
        success = result.success;
        imported = result.imported || 0;
        updated = result.updated || 0;
        skipped = result.skipped || 0;
        errorMessage = result.error || '';
      } else {
        success = false;
        errorMessage = 'Unknown import result format';
      }

      if (success) {
        let message = `Successfully imported ${imported} notes!`;
        if (updated > 0) {
          message += ` (${updated} updated)`;
        }
        if (skipped > 0) {
          message += ` (${skipped} skipped)`;
        }

        this.showNotification(message, 'success');

        // Trigger notes reload in main app
        if (window.urlNotesApp) {
          if (typeof window.urlNotesApp.loadNotes === 'function') {
            await window.urlNotesApp.loadNotes();
          }
          if (typeof window.urlNotesApp.render === 'function') {
            window.urlNotesApp.render();
          }
        }
      } else {
        throw new Error(errorMessage || 'Import failed');
      }
    } catch (error) {
      console.error('Error importing notes:', error);
      this.showNotification('Failed to import notes: ' + error.message, 'error');
    } finally {
      // Clear the file input
      event.target.value = '';
    }
  }

  // Comprehensive validation of import data
  validateImportData(importData) {
    try {
      // Check if data is an object
      if (!importData || typeof importData !== 'object') {
        return { isValid: false, error: 'Import data must be a JSON object' };
      }

      // Check if it's empty
      if (Object.keys(importData).length === 0) {
        return { isValid: false, error: 'Import file is empty' };
      }

      let totalNotes = 0;
      let validDomains = 0;

      // Validate each domain
      for (const [domain, notes] of Object.entries(importData)) {
        // Skip non-note data (like themeMode)
        if (domain === 'themeMode' || !Array.isArray(notes)) {
          continue;
        }

        validDomains++;

        // Validate notes array
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];

          // Check required fields
          if (!note || typeof note !== 'object') {
            return { isValid: false, error: `Invalid note at ${domain}[${i}]: not an object` };
          }

          if (!note.id || typeof note.id !== 'string') {
            return { isValid: false, error: `Invalid note at ${domain}[${i}]: missing or invalid ID` };
          }

          if (!note.domain || typeof note.domain !== 'string') {
            return { isValid: false, error: `Invalid note at ${domain}[${i}]: missing or invalid domain` };
          }

          // Validate optional fields if present
          if (note.title && typeof note.title !== 'string') {
            return { isValid: false, error: `Invalid note at ${domain}[${i}]: title must be a string` };
          }

          if (note.content && typeof note.content !== 'string') {
            return { isValid: false, error: `Invalid note at ${domain}[${i}]: content must be a string` };
          }

          if (note.tags && !Array.isArray(note.tags)) {
            return { isValid: false, error: `Invalid note at ${domain}[${i}]: tags must be an array` };
          }

          totalNotes++;
        }
      }

      // Check if we found any valid notes
      if (validDomains === 0 || totalNotes === 0) {
        return { isValid: false, error: 'No valid notes found in import file' };
      }

      // Check reasonable limits
      if (totalNotes > 10000) {
        return { isValid: false, error: `Too many notes (${totalNotes}). Maximum is 10,000 notes per import.` };
      }

      return { isValid: true, totalNotes, validDomains };
    } catch (error) {
      return { isValid: false, error: `Validation error: ${error.message}` };
    }
  }

  // Legacy method for backward compatibility
  isValidImportFormat(importData) {
    const validation = this.validateImportData(importData);
    return validation.isValid;
  }

  // Show notification message - Updated to match sync notification theme
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

    // Apply glass morphism styling to match sync notifications
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      box-shadow: var(--glass-inset), var(--glass-shadow);
             backdrop-filter: blur(var(--backdrop-blur));
       -webkit-backdrop-filter: blur(var(--backdrop-blur));
      transform: translateX(100%);
      transition: transform 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    // Apply type-specific styling
    if (type === 'success') {
      notification.style.background = 'color-mix(in oklab, var(--accent-primary) 20%, var(--glass-bg) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, var(--accent-primary) 40%, var(--glass-border) 60%)';
    } else if (type === 'error') {
      notification.style.background = 'color-mix(in oklab, #ff3b30 20%, var(--glass-bg) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, #ff3b30 40%, var(--glass-border) 60%)';
    } else if (type === 'info') {
      notification.style.background = 'color-mix(in oklab, #007aff 20%, var(--glass-bg) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, #007aff 40%, var(--glass-border) 60%)';
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

  // Get current settings
  getSettings() {
    return {
      fontFamily: this.currentFont,
      fontSize: this.currentFontSize
    };
  }

  // Apply settings to new elements (called when notes are rendered)
  applySettingsToElement(element) {
    if (!element) return;

    const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
    const fontSize = `${this.currentFontSize}px`;

    // Apply to note content within the element
    const noteContents = element.querySelectorAll('.note-content');
    noteContents.forEach(content => {
      content.style.fontFamily = fontFamily;
      content.style.fontSize = fontSize;
    });
  }
}

// Export to global scope
window.SettingsManager = SettingsManager;
