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
    this.authForgotPwBtn = document.getElementById('authForgotPwBtn');
    this.authStatusText = document.getElementById('authStatusText');
    this.authGoogleBtn = document.getElementById('authGoogleBtn');
    this.oauthSection = document.getElementById('oauthSection');

    // Sync elements
    this.manualSyncBtn = document.getElementById('manualSyncBtn');

    // Premium status refresh button
    this.refreshPremiumStatusBtn = document.getElementById('refreshPremiumStatusBtn');



    // Website link button
    this.websiteLinkBtn = document.getElementById('websiteLinkBtn');

    // Export reminder elements
    this.exportReminderBtn = document.getElementById('exportReminderBtn');

    this.currentFont = 'Default';
    this.currentFontSize = 12;

    // Memory leak prevention: Track observers for cleanup
    this._resizeObserver = null;
    this._mutationObserver = null;
    this._eventListeners = [];

    // Initialize backup reminder system
    this.initBackupReminders();

    this.setupEventListeners();
  }

  // Helper function to safely set button HTML
  setButtonHTML(button, html) {
    if (window.safeDOM) {
      window.safeDOM.setInnerHTML(button, html, false);
    } else {
      button.innerHTML = html;
    }
  }

  async updateAuthUI() {
    try {
      const isAuthed = window.supabaseClient?.isAuthenticated?.() || false;
      const user = window.supabaseClient?.getCurrentUser?.();
      const actions = document.getElementById('authActions');
      const syncManagement = document.getElementById('syncManagement');
      const show = (el, on = true) => { if (el) el.style.display = on ? 'block' : 'none'; };

      if (isAuthed && user) {
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
        show(this.oauthSection, false);
        show(this.refreshPremiumStatusBtn, true);
        if (this.authEmailInput) this.authEmailInput.value = user.email || '';
        if (this.authPasswordInput) this.authPasswordInput.value = '';
        if (actions) {
          actions.style.gridTemplateColumns = '1fr';
        }

        if (syncManagement) {
          try {
            const status = await window.supabaseClient?.getSubscriptionStatus?.();
            const shouldShow = status?.active && status?.tier !== 'free';
            show(syncManagement, shouldShow);

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
        show(this.oauthSection, true);
        show(this.refreshPremiumStatusBtn, false);
        show(syncManagement, false);
        if (actions && this.authSignInBtn && this.authSignUpBtn) {
          this.authSignInBtn.style.display = 'inline-flex';
          this.authSignUpBtn.style.display = 'inline-flex';
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



  async handleSignIn() {
    const { email, password } = this.getAuthInputs();
    if (!email || !password) {
      return this.showNotification('Please enter your email and password', 'error');
    }
    try {
      this.setAuthBusy(true);
      await window.supabaseClient.signInWithEmail(email, password);
      await this.handleSuccessfulSignIn('Signed in successfully');
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
      this.showNotification('Successfully signed out', 'success');
      this.updateAuthUI();
    } catch (e) {
      this.showNotification(`Sign out failed: ${e.message || e}`, 'error');
    } finally {
      this.setAuthBusy(false);
    }
  }



  async handleGoogleSignIn() {
    try {
      this.setAuthBusy(true);
      await window.supabaseClient.signInWithOAuth('google');
      await this.handleSuccessfulSignIn('Signed in with Google');
    } catch (e) {
      console.error('Google OAuth error:', e);
      this.showNotification(`Google sign in failed: ${e.message || e}`, 'error');
    } finally {
      this.setAuthBusy(false);
    }
  }

  async handleSuccessfulSignIn(successMessage) {
    this.showNotification(successMessage, 'success');
    await this.updateAuthUI();

    if (successMessage.includes('Signed in successfully')) {
      setTimeout(() => {
        this.handleRefreshPremiumStatus();
      }, 1500);
    }
  }

  async handleManualSync() {
    if (!window.syncEngine) {
      this.showNotification('Sync engine not available', 'error');
      return;
    }

    try {
      this.manualSyncBtn.disabled = true;
      this.setButtonHTML(this.manualSyncBtn, `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Syncing...</span>
      `);

      await window.syncEngine.manualSync();

      this.setButtonHTML(this.manualSyncBtn, `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Sync Complete</span>
      `);

      setTimeout(() => {
        this.setButtonHTML(this.manualSyncBtn, `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            <path d="M12 3v12l3 3"/>
          </svg>
          <span>Sync Now</span>
        `);
        this.manualSyncBtn.disabled = false;
      }, 2000);

      // Update storage usage after sync
      this.updateStorageUsage();

    } catch (e) {
      this.showNotification(`Manual sync failed: ${e.message || e}`, 'error');
      this.manualSyncBtn.disabled = false;
      this.setButtonHTML(this.manualSyncBtn, `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Sync Now</span>
      `);
    }
  }

  async handleRefreshPremiumStatus() {
    if (!window.supabaseClient?.isAuthenticated()) {
      this.showNotification('Please sign in to refresh your status', 'info');
      return;
    }

    try {
      // Show loading state
      this.refreshPremiumStatusBtn.disabled = true;
      this.setButtonHTML(this.refreshPremiumStatusBtn, `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Refreshing...</span>
      `);

      // Use the shared refresh method
      const status = await window.supabaseClient.refreshPremiumStatusAndUI();

      // Update UI based on new status
      await this.updateAuthUI();

      // Show success message
      if (status?.active && status?.tier !== 'free') {
        this.showNotification(`Premium ${status.tier} active`, 'success');
      } else if (status?.tier === 'premium' && !status?.active) {
        this.showNotification('Premium inactive - check expiration', 'warning');
      } else {
        this.showNotification(`You're on the ${status?.tier || 'free'} plan`, 'info');
      }

      // Reset button
      this.setButtonHTML(this.refreshPremiumStatusBtn, `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Status Updated</span>
      `);

      // Reset to original text after 2 seconds
      setTimeout(() => {
        this.setButtonHTML(this.refreshPremiumStatusBtn, `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            <path d="M12 3v9l3 3"/>
          </svg>
          <span>Refresh Premium Status</span>
        `);
        this.refreshPremiumStatusBtn.disabled = false;
      }, 2000);

    } catch (e) {
      console.error('Premium status refresh failed:', e);
      this.showNotification(`Failed to refresh status: ${e.message || e}`, 'error');

      // Reset button on error
      this.setButtonHTML(this.refreshPremiumStatusBtn, `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <path d="M12 3v9l3 3"/>
        </svg>
        <span>Refresh Premium Status</span>
      `);
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
    const controls = [this.authEmailInput, this.authPasswordInput, this.authTogglePwBtn, this.authSignUpBtn, this.authSignInBtn, this.authForgotPwBtn, this.authSignOutBtn, this.authGoogleBtn];
    controls.forEach(el => { if (el) el.disabled = !!busy; });
    if (this.authStatusText) this.authStatusText.style.opacity = busy ? '0.6' : '0.8';
  }

  setupEventListeners() {
    this.settingsBtn?.addEventListener('click', () => this.openSettings());
    this.settingsBackBtn?.addEventListener('click', () => this.closeSettings());
    this.setupScrollIndicators();
    this.fontSelector?.addEventListener('change', (e) => this.handleFontChange(e.target.value));
    this.fontSizeSlider?.addEventListener('input', (e) => this.handleFontSizeChange(parseInt(e.target.value)));
    this.exportNotesBtn?.addEventListener('click', () => this.handleExportNotes());
    this.importNotesBtn?.addEventListener('click', () => this.importNotesInput?.click());
    this.importNotesInput?.addEventListener('change', (e) => this.handleImportNotes(e));
    this.manualSyncBtn?.addEventListener('click', () => this.handleManualSync());
    this.refreshPremiumStatusBtn?.addEventListener('click', () => this.handleRefreshPremiumStatus());
    this.changeShortcutBtn?.addEventListener('click', () => this.openShortcutEditor());
    this.authTogglePwBtn?.addEventListener('click', () => this.togglePasswordVisibility());
    this.authSignUpBtn?.addEventListener('click', () => this.openSignUp());
    this.authSignInBtn?.addEventListener('click', () => this.handleSignIn());
    this.authSignOutBtn?.addEventListener('click', () => this.handleSignOut());
    this.authGoogleBtn?.addEventListener('click', () => this.handleGoogleSignIn());
    this.authForgotPwBtn?.addEventListener('click', () => this.openForgotPassword());
    this.authEmailInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.handleSignIn(); }
    });
    this.authPasswordInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.handleSignIn(); }
    });
    this.openOnboardingBtn?.addEventListener('click', () => this.openOnboarding());
    const showTooltipsBtn = document.getElementById('showTooltipsBtn');
    if (showTooltipsBtn) {
      showTooltipsBtn.addEventListener('click', () => this.showOnboardingTooltips());
    }
    this.adDisclaimerBtn?.addEventListener('click', () => this.openAdDisclosure());
    this.websiteLinkBtn?.addEventListener('click', () => this.openWebsite());
    const adDisclaimerLink = document.getElementById('adDisclaimerLink');
    adDisclaimerLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openAdDisclosure();
    });

    try {
      window.eventBus?.on('auth:changed', () => this.updateAuthUI());
      window.eventBus?.on('tier:changed', () => this.updateAuthUI());
    } catch (_) { }
  }

  openSettings() {
    const notesList = document.querySelector('.notes-container');
    const noteEditor = document.getElementById('noteEditor');

    if (notesList) notesList.style.display = 'none';
    if (noteEditor) noteEditor.style.display = 'none';
    if (this.settingsPanel) {
      this.settingsPanel.style.display = 'block';
      const settingsContent = this.settingsPanel.querySelector('.settings-content');
      if (settingsContent) {
        settingsContent.scrollTop = 0;
      }
    }
    this.loadShortcutDisplay();
    this.updateAuthUI();
    setTimeout(() => this.setupScrollIndicators(), 50);
  }

  closeSettings() {
    const notesList = document.querySelector('.notes-container');
    const noteEditor = document.getElementById('noteEditor');

    if (this.settingsPanel) this.settingsPanel.style.display = 'none';
    if (notesList) notesList.style.removeProperty('display');
  }

  async loadFontSetting() {
    try {
      const { fontFamily, fontSize } = await chrome.storage.local.get(['fontFamily', 'fontSize']);

      this.currentFont = fontFamily || 'Default';
      this.currentFontSize = fontSize || 12;

      if (this.fontSelector) {
        this.fontSelector.value = this.currentFont;
      }
      if (this.fontSizeSlider) {
        this.fontSizeSlider.value = this.currentFontSize;
      }
      if (this.fontSizeValue) {
        this.fontSizeValue.textContent = `${this.currentFontSize}px`;
      }

      this.applyFontSettings();
    } catch (error) {
      console.error('Error loading font settings:', error);
    }
  }

  async handleFontChange(fontFamily) {
    this.currentFont = fontFamily;
    await chrome.storage.local.set({ fontFamily });
    this.applyFontSettings();
  }

  async handleFontSizeChange(fontSize) {
    this.currentFontSize = fontSize;
    if (this.fontSizeValue) {
      this.fontSizeValue.textContent = `${fontSize}px`;
    }
    await chrome.storage.local.set({ fontSize });
    this.applyFontSettings();
  }

  applyFontSettings() {
    const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
    const fontSize = `${this.currentFontSize}px`;

    const noteContentInput = document.getElementById('noteContentInput');
    if (noteContentInput) {
      noteContentInput.style.fontFamily = fontFamily;
      noteContentInput.style.fontSize = fontSize;
    }

    const noteContentPreview = document.getElementById('noteContentPreview');
    if (noteContentPreview) {
      noteContentPreview.style.fontFamily = fontFamily;
      noteContentPreview.style.fontSize = fontSize;
    }

    if (this.fontPreviewText) {
      this.fontPreviewText.style.fontFamily = fontFamily;
      this.fontPreviewText.style.fontSize = fontSize;
    }

    const notesList = document.getElementById('notesList');
    if (notesList) {
      const noteContents = notesList.querySelectorAll('.note-content');
      noteContents.forEach(content => {
        content.style.fontFamily = fontFamily;
        content.style.fontSize = fontSize;
      });
    }
  }

  initSettings() {
    if (this.fontPreviewText) {
      this.applyFontSettings();
    }

    this.updateFontPreview();
    this.loadShortcutDisplay();
    this.updateAuthUI();
    this.setupScrollIndicators();
  }

  setupScrollIndicators() {
    const settingsContent = document.querySelector('.settings-content');
    if (!settingsContent) return;

    const updateScrollIndicators = () => {
      const { scrollTop, scrollHeight, clientHeight } = settingsContent;

      const isScrollable = scrollHeight > clientHeight;
      settingsContent.setAttribute('data-scrollable', isScrollable.toString());

      if (scrollTop > 10) {
        settingsContent.classList.add('scrolled');
      } else {
        settingsContent.classList.remove('scrolled');
      }

      if (scrollTop + clientHeight < scrollHeight - 10) {
        settingsContent.classList.add('has-more');
      } else {
        settingsContent.classList.remove('has-more');
      }
    };

    settingsContent.addEventListener('scroll', updateScrollIndicators);
    this._eventListeners.push({ target: settingsContent, event: 'scroll', handler: updateScrollIndicators });

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    this._resizeObserver = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        updateScrollIndicators();
      });
    });
    this._resizeObserver.observe(settingsContent);

    setTimeout(updateScrollIndicators, 100);

    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
    }
    this._mutationObserver = new MutationObserver((mutations) => {
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
      this._mutationObserver.observe(settingsPanel, { attributes: true });
    }
  }

  updateFontPreview() {
    if (this.fontPreviewText) {
      const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
      this.fontPreviewText.style.fontFamily = fontFamily;
      this.fontPreviewText.style.fontSize = `${this.currentFontSize}px`;
    }
  }

  async loadShortcutDisplay() {
    try {
      if (!chrome.commands || !chrome.commands.getAll) return;
      const cmds = await chrome.commands.getAll();
      const action = cmds.find(c => c.name === '_execute_action');
      const create = cmds.find(c => c.name === 'create_new_note');
      const openShortcut = action && action.shortcut ? action.shortcut : 'Not set';
      const newShortcut = create && create.shortcut ? create.shortcut : 'Not set';

      if (this.shortcutValue) this.shortcutValue.textContent = openShortcut;
      const newNoteEl = document.getElementById('newNoteShortcutValue');
      if (newNoteEl) newNoteEl.textContent = newShortcut;

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

  openShortcutEditor() {
    try {
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(() => {
          try { window.open('chrome://extensions/shortcuts', '_blank', 'noopener,noreferrer'); } catch (_) { }
        });
      } else {
        window.open('chrome://extensions/shortcuts', '_blank', 'noopener,noreferrer');
      }
    } catch (_) { /* noop */ }
  }

  openOnboarding() {
    try {
      const url = chrome?.runtime?.getURL ? chrome.runtime.getURL('onboarding.html') : 'onboarding.html';
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url }).catch(() => {
          try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (_) { }
        });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {
      try { window.open('onboarding.html', '_blank', 'noopener,noreferrer'); } catch (__) { }
    }
  }

  openWebsite() {
    try {
      const websiteUrl = 'https://anchored.site';
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: websiteUrl }).catch(() => {
          try { window.open(websiteUrl, '_blank', 'noopener,noreferrer'); } catch (_) { }
        });
      } else {
        window.open(websiteUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {
      try { window.open('https://anchored.site', '_blank', 'noopener,noreferrer'); } catch (__) { }
    }
  }

  openSignUp() {
    try {
      const signupUrl = 'https://anchored.site/?signup=true';
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: signupUrl }).catch(() => {
          try { window.open(signupUrl, '_blank', 'noopener,noreferrer'); } catch (_) { }
        });
      } else {
        window.open(signupUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {
      try { window.open('https://anchored.site/?signup=true', '_blank', 'noopener,noreferrer'); } catch (__) { }
    }
  }

  openForgotPassword() {
    try {
      const forgotUrl = 'https://anchored.site/?forgot=true';
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: forgotUrl }).catch(() => {
          try { window.open(forgotUrl, '_blank', 'noopener,noreferrer'); } catch (_) { }
        });
      } else {
        window.open(forgotUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {
      try { window.open('https://anchored.site/?forgot=true', '_blank', 'noopener,noreferrer'); } catch (__) { }
    }
  }

  openAdDisclosure() {
    const dialog = document.getElementById('adDisclosureDialog');
    if (dialog) {
      dialog.style.display = 'block';

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

      dialog.onclick = (e) => {
        if (e.target === dialog) {
          closeDialog();
        }
      };
    }
  }

  showOnboardingTooltips() {
    try {
      if (window.urlNotesApp && window.urlNotesApp.onboardingTooltips) {
        window.urlNotesApp.onboardingTooltips.forceShowTooltips();
      }
    } catch (error) {
      console.warn('Failed to show onboarding tooltips:', error);
    }
  }

  showNotification(message, type = 'info') {
    try {
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(message, type);
      }
    } catch (error) {
    }
  }

  async handleExportNotes() {
    try {
      const exportData = await this.storageManager.exportNotes();

      const formatSelect = document.getElementById('exportFormatSelect');
      const selectedFormat = formatSelect ? formatSelect.value : 'json';

      this.showExportSelectionDialog(exportData, selectedFormat);
    } catch (error) {
      console.error('Error exporting notes:', error);
      this.showNotification('Failed to export notes', 'error');
    }
  }

  showExportSelectionDialog(exportData, selectedFormat) {
    const dialog = document.getElementById('exportSelectionDialog');
    const domainsList = document.getElementById('exportDomainsList');
    const selectAllCheckbox = document.getElementById('exportSelectAllCheckbox');

    if (!dialog || !domainsList) return;

    this.pendingExportData = exportData;
    this.pendingExportFormat = selectedFormat;
    this.exportSelection = {};

    domainsList.textContent = '';

    for (const domain in exportData) {
      if (domain === '_anchored') continue;

      const notes = exportData[domain];
      if (!Array.isArray(notes) || notes.length === 0) continue;

      this.exportSelection[domain] = {
        selected: true,
        notes: notes.map(note => ({ id: note.id, selected: true, title: note.title || 'Untitled' }))
      };

      const domainGroup = document.createElement('div');
      domainGroup.className = 'export-domain-group';

      const domainHeader = document.createElement('div');
      domainHeader.className = 'export-domain-header';

      const domainCheckbox = document.createElement('input');
      domainCheckbox.type = 'checkbox';
      domainCheckbox.className = 'export-domain-checkbox';
      domainCheckbox.checked = true;
      domainCheckbox.dataset.domain = domain;
      domainCheckbox.addEventListener('change', (e) => this.handleDomainCheckboxChange(e, domain));

      const domainInfo = document.createElement('div');
      domainInfo.className = 'export-domain-info';

      const domainName = document.createElement('div');
      domainName.className = 'export-domain-name';
      domainName.textContent = domain;

      const domainCount = document.createElement('div');
      domainCount.className = 'export-domain-count';
      domainCount.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;

      domainInfo.appendChild(domainName);
      domainInfo.appendChild(domainCount);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'export-domain-toggle';
      toggleBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const notesList = domainGroup.querySelector('.export-notes-list');
        notesList.classList.toggle('show');
        toggleBtn.classList.toggle('expanded');
      });

      domainHeader.appendChild(domainCheckbox);
      domainHeader.appendChild(domainInfo);
      domainHeader.appendChild(toggleBtn);

      const notesList = document.createElement('div');
      notesList.className = 'export-notes-list';

      notes.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'export-note-item';

        const noteCheckbox = document.createElement('input');
        noteCheckbox.type = 'checkbox';
        noteCheckbox.className = 'export-note-checkbox';
        noteCheckbox.checked = true;
        noteCheckbox.dataset.domain = domain;
        noteCheckbox.dataset.noteId = note.id;
        noteCheckbox.addEventListener('change', (e) => this.handleNoteCheckboxChange(e, domain, note.id));

        const noteTitle = document.createElement('div');
        noteTitle.className = 'export-note-title';
        noteTitle.textContent = note.title || 'Untitled Note';

        noteItem.appendChild(noteCheckbox);
        noteItem.appendChild(noteTitle);
        notesList.appendChild(noteItem);
      });

      domainGroup.appendChild(domainHeader);
      domainGroup.appendChild(notesList);
      domainsList.appendChild(domainGroup);
    }

    this.updateExportStats();

    selectAllCheckbox.checked = true;

    const closeBtn = document.getElementById('exportSelectionClose');
    const cancelBtn = document.getElementById('exportSelectionCancel');
    const confirmBtn = document.getElementById('exportSelectionConfirm');

    const newCloseBtn = closeBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newConfirmBtn = confirmBtn.cloneNode(true);

    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAllChange(e));
    newCloseBtn.addEventListener('click', () => this.closeExportSelectionDialog());
    newCancelBtn.addEventListener('click', () => this.closeExportSelectionDialog());
    newConfirmBtn.addEventListener('click', () => this.confirmExportSelection());

    dialog.classList.add('show');
  }

  handleDomainCheckboxChange(event, domain) {
    const checked = event.target.checked;
    this.exportSelection[domain].selected = checked;

    this.exportSelection[domain].notes.forEach(note => {
      note.selected = checked;
    });

    const noteCheckboxes = document.querySelectorAll(`input[data-domain="${domain}"][data-note-id]`);
    noteCheckboxes.forEach(cb => cb.checked = checked);

    this.updateExportStats();
  }

  handleNoteCheckboxChange(event, domain, noteId) {
    const checked = event.target.checked;
    const note = this.exportSelection[domain].notes.find(n => n.id === noteId);
    if (note) note.selected = checked;

    const allUnchecked = this.exportSelection[domain].notes.every(n => !n.selected);
    const allChecked = this.exportSelection[domain].notes.every(n => n.selected);

    const domainCheckbox = document.querySelector(`input[data-domain="${domain}"]:not([data-note-id])`);
    if (domainCheckbox) {
      domainCheckbox.checked = !allUnchecked;
      domainCheckbox.indeterminate = !allUnchecked && !allChecked;
    }

    this.exportSelection[domain].selected = !allUnchecked;
    this.updateExportStats();
  }

  handleSelectAllChange(event) {
    const checked = event.target.checked;

    for (const domain in this.exportSelection) {
      this.exportSelection[domain].selected = checked;
      this.exportSelection[domain].notes.forEach(note => {
        note.selected = checked;
      });
    }

    document.querySelectorAll('.export-domain-checkbox, .export-note-checkbox').forEach(cb => {
      cb.checked = checked;
    });

    this.updateExportStats();
  }

  updateExportStats() {
    let selectedDomains = 0;
    let selectedNotes = 0;

    for (const domain in this.exportSelection) {
      const hasSelectedNotes = this.exportSelection[domain].notes.some(n => n.selected);
      if (hasSelectedNotes) {
        selectedDomains++;
        selectedNotes += this.exportSelection[domain].notes.filter(n => n.selected).length;
      }
    }

    document.getElementById('exportSelectedDomains').textContent = selectedDomains;
    document.getElementById('exportSelectedNotes').textContent = selectedNotes;

    const confirmBtn = document.getElementById('exportSelectionConfirm');
    if (confirmBtn) {
      confirmBtn.disabled = selectedNotes === 0;
    }
  }

  closeExportSelectionDialog() {
    const dialog = document.getElementById('exportSelectionDialog');
    if (dialog) {
      dialog.classList.remove('show');
      this.pendingExportData = null;
      this.pendingExportFormat = null;
      this.exportSelection = {};
    }
  }

  async confirmExportSelection() {
    try {
      const filteredData = { _anchored: this.pendingExportData._anchored };

      for (const domain in this.exportSelection) {
        const selectedNotes = this.exportSelection[domain].notes
          .filter(n => n.selected)
          .map(n => n.id);

        if (selectedNotes.length > 0) {
          filteredData[domain] = this.pendingExportData[domain].filter(note =>
            selectedNotes.includes(note.id)
          );
        }
      }

      const exportFormats = new ExportFormats();
      const exportResult = exportFormats.exportToFormat(filteredData, this.pendingExportFormat);

      const blob = new Blob([exportResult.content], { type: exportResult.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportResult.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const selectedCount = Object.values(filteredData).reduce((sum, notes) =>
        sum + (Array.isArray(notes) ? notes.length : 0), 0
      );
      const formatInfo = exportFormats.getSupportedFormats()[this.pendingExportFormat];

      this.closeExportSelectionDialog();

      if (formatInfo) {
        this.showNotification(`Exported ${selectedCount} notes as ${formatInfo.name}`, 'success');
      } else {
        this.showNotification(`Exported ${selectedCount} notes`, 'success');
      }
    } catch (error) {
      console.error('Error exporting selected notes:', error);
      this.showNotification('Failed to export notes', 'error');
    }
  }

  async handleImportNotes(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      if (!file.name.toLowerCase().endsWith('.json')) {
        throw new Error('Please select a JSON file (.json)');
      }

      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('File is too large. Maximum size is 50MB.');
      }

      this.showNotification('Importing notes...', 'info');

      const text = await file.text();

      let importData;
      try {
        importData = JSON.parse(text);
      } catch (parseError) {
        throw new Error('Invalid JSON file. Please check the file format.');
      }

      const validation = this.validateImportData(importData);
      if (!validation.isValid) {
        throw new Error(`Invalid import format: ${validation.error}`);
      }

      const result = await this.storageManager.importNotes(importData);

      let success = false;
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errorMessage = '';

      if (typeof result === 'number') {
        success = result >= 0;
        imported = result;
      } else if (typeof result === 'object' && result !== null) {
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
      event.target.value = '';
    }
  }

  validateImportData(importData) {
    try {
      if (!importData || typeof importData !== 'object') {
        return { isValid: false, error: 'Import data must be a JSON object' };
      }

      if (Object.keys(importData).length === 0) {
        return { isValid: false, error: 'Import file is empty' };
      }

      if (!importData._anchored) {
        return {
          isValid: false,
          error: 'This file does not appear to be an Anchored notes export. Please ensure you are importing a file exported from Anchored.'
        };
      }

      const anchored = importData._anchored;
      if (!anchored.version || !anchored.format || anchored.format !== 'anchored-notes') {
        return {
          isValid: false,
          error: 'Invalid Anchored export format. Please ensure you are importing a valid Anchored notes file.'
        };
      }

      let totalNotes = 0;
      let validDomains = 0;

      for (const [domain, notes] of Object.entries(importData)) {
        if (domain === '_anchored' || domain === 'themeMode' || !Array.isArray(notes)) {
          continue;
        }

        if (!this.isValidDomain(domain)) {
          return { isValid: false, error: `Invalid domain format: ${domain}` };
        }

        validDomains++;

        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          const noteLocation = `${domain}[${i}]`;

          const noteValidation = this.validateNoteStructure(note, noteLocation);
          if (!noteValidation.isValid) {
            return noteValidation;
          }

          totalNotes++;
        }
      }

      if (validDomains === 0 || totalNotes === 0) {
        return { isValid: false, error: 'No valid notes found in import file' };
      }

      if (totalNotes > 10000) {
        return { isValid: false, error: `Too many notes (${totalNotes}). Maximum is 10,000 notes per import.` };
      }

      return {
        isValid: true,
        totalNotes,
        validDomains,
        version: anchored.version,
        source: anchored.source,
        exportedAt: anchored.exportedAt
      };
    } catch (error) {
      return { isValid: false, error: `Validation error: ${error.message}` };
    }
  }

  validateNoteStructure(note, location) {
    if (!note || typeof note !== 'object') {
      return { isValid: false, error: `Invalid note at ${location}: not an object` };
    }

    if (!note.id || typeof note.id !== 'string') {
      return { isValid: false, error: `Invalid note at ${location}: missing or invalid ID` };
    }

    if (!this.isValidUUID(note.id)) {
      return { isValid: false, error: `Invalid note at ${location}: ID must be a valid UUID format` };
    }

    if (!note.domain || typeof note.domain !== 'string') {
      return { isValid: false, error: `Invalid note at ${location}: missing or invalid domain` };
    }

    if (!this.isValidDomain(note.domain)) {
      return { isValid: false, error: `Invalid note at ${location}: invalid domain format` };
    }

    const stringFields = ['title', 'content', 'url', 'pageTitle'];
    for (const field of stringFields) {
      if (note[field] !== undefined && typeof note[field] !== 'string') {
        return { isValid: false, error: `Invalid note at ${location}: ${field} must be a string` };
      }
    }

    if (note.url && !this.isValidURL(note.url)) {
      return { isValid: false, error: `Invalid note at ${location}: invalid URL format` };
    }

    if (note.tags !== undefined) {
      if (!Array.isArray(note.tags)) {
        return { isValid: false, error: `Invalid note at ${location}: tags must be an array` };
      }

      for (let j = 0; j < note.tags.length; j++) {
        if (typeof note.tags[j] !== 'string') {
          return { isValid: false, error: `Invalid note at ${location}: tag[${j}] must be a string` };
        }

        if (note.tags[j].length === 0 || note.tags[j].length > 50) {
          return { isValid: false, error: `Invalid note at ${location}: tag[${j}] must be 1-50 characters` };
        }
      }

      const uniqueTags = new Set(note.tags);
      if (uniqueTags.size !== note.tags.length) {
        return { isValid: false, error: `Invalid note at ${location}: duplicate tags not allowed` };
      }
    }

    const timestampFields = ['createdAt', 'updatedAt'];
    for (const field of timestampFields) {
      if (note[field] !== undefined) {
        if (typeof note[field] !== 'string') {
          return { isValid: false, error: `Invalid note at ${location}: ${field} must be a string` };
        }

        if (!this.isValidTimestamp(note[field])) {
          return { isValid: false, error: `Invalid note at ${location}: ${field} must be a valid ISO timestamp` };
        }
      }
    }

    if (note.title && note.title.length > 500) {
      return { isValid: false, error: `Invalid note at ${location}: title too long (max 500 characters)` };
    }

    if (note.content && note.content.length > 100000) {
      return { isValid: false, error: `Invalid note at ${location}: content too long (max 100,000 characters)` };
    }

    return { isValid: true };
  }

  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  isValidURL(url) {
    if (!url || typeof url !== 'string') return false;

    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  isValidTimestamp(timestamp) {
    if (!timestamp || typeof timestamp !== 'string') return false;

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return false;

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
      return isoRegex.test(timestamp);
    } catch {
      return false;
    }
  }

  isValidImportFormat(importData) {
    const validation = this.validateImportData(importData);
    return validation.isValid;
  }

  showNotification(message, type = 'info') {
    if (window.Utils && typeof window.Utils.showToast === 'function') {
      window.Utils.showToast(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  getSettings() {
    return {
      fontFamily: this.currentFont,
      fontSize: this.currentFontSize
    };
  }

  applySettingsToElement(element) {
    if (!element) return;

    const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
    const fontSize = `${this.currentFontSize}px`;

    const noteContents = element.querySelectorAll('.note-content');
    noteContents.forEach(content => {
      content.style.fontFamily = fontFamily;
      content.style.fontSize = fontSize;
    });
  }

  async initBackupReminders() {
    try {
      await this.checkBackupReminder();

      chrome.alarms.create('backupReminder', {
        delayInMinutes: 60 * 24 * 30,
        periodInMinutes: 60 * 24 * 30
      });

      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'backupReminder') {
          this.showBackupReminder();
        }
      });
    } catch (error) {
      console.warn('Failed to initialize backup reminders:', error);
    }
  }

  async checkBackupReminder() {
    try {
      const premiumStatus = await getPremiumStatus();
      if (premiumStatus.isPremium) {
        return;
      }

      const notes = await this.storageManager.getAllNotes();
      const activeNotes = notes.filter(note => !note.is_deleted);

      if (activeNotes.length === 0) return;

      const { lastBackupDate } = await chrome.storage.local.get(['lastBackupDate']);
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      if (!lastBackupDate || lastBackupDate < thirtyDaysAgo) {
        const { installDate } = await chrome.storage.local.get(['installDate']);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        if (installDate && installDate < sevenDaysAgo) {
          this.showBackupReminder();
        }
      }
    } catch (error) {
      console.warn('Failed to check backup reminder:', error);
    }
  }

  async showBackupReminder() {
    try {
      const premiumStatus = await getPremiumStatus();
      if (premiumStatus.isPremium) {
        return;
      }

      const notes = await this.storageManager.getAllNotes();
      const activeNotes = notes.filter(note => !note.is_deleted);

      if (activeNotes.length === 0) return;

      chrome.notifications.create('backupReminder', {
        type: 'basic',
        iconUrl: '../assets/icons/icon128x128.png',
        title: 'Backup Your Notes (Free User)',
        message: `You have ${activeNotes.length} local notes. Export them to prevent data loss, or upgrade to Premium for automatic cloud sync!`,
        buttons: [
          { title: 'Open Extension Settings' },
          { title: 'Get Premium' }
        ]
      });

      chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
        if (notificationId === 'backupReminder') {
          if (buttonIndex === 0) {
            chrome.action.openPopup();
            chrome.storage.local.set({
              showSettingsOnOpen: true,
              highlightExport: true
            });
          } else {
            chrome.tabs.create({ url: 'https://anchored.site/?upgrade=true' });
          }
          chrome.notifications.clear(notificationId);
        }
      });

    } catch (error) {
      console.warn('Failed to show backup reminder:', error);
    }
  }

  async markBackupCompleted() {
    try {
      await chrome.storage.local.set({
        lastBackupDate: Date.now()
      });
    } catch (error) {
      console.warn('Failed to mark backup completed:', error);
    }
  }

  async exportNotesWithBackupTracking() {
    try {
      await this.exportNotes();
      await this.markBackupCompleted();

      if (window.showToast) {
        window.showToast('Notes exported and backup recorded!', 'success');
      }
    } catch (error) {
      console.error('Export with backup tracking failed:', error);
      if (window.showToast) {
        window.showToast('Export failed. Please try again.', 'error');
      }
    }
  }

  cleanup() {
    try {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }

      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
        this._mutationObserver = null;
      }

      if (this._eventListeners && Array.isArray(this._eventListeners)) {
        this._eventListeners.forEach(({ target, event, handler }) => {
          if (target && event && handler) {
            target.removeEventListener(event, handler);
          }
        });
        this._eventListeners = [];
      }
    } catch (error) {
      console.warn('SettingsManager cleanup error:', error);
    }
  }
}

// Export to global scope
window.SettingsManager = SettingsManager;
