// URL Notes Extension - Popup Script

/**
 * Custom Confirmation Dialog (Promise-based)
 */
class CustomDialog {
  constructor() {
    this.overlay = document.getElementById('custom-dialog-overlay');
    this.messageElement = document.getElementById('dialog-message');
    this.confirmBtn = document.getElementById('dialog-confirm-btn');
    this.cancelBtn = document.getElementById('dialog-cancel-btn');
    this.resolve = null;

    this.confirmBtn.addEventListener('click', () => this.handleConfirm(true));
    this.cancelBtn.addEventListener('click', () => this.handleConfirm(false));
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.handleConfirm(false);
      }
    });

    // Flush draft immediately when popup is deactivating to capture last keystrokes
    const flushDraft = () => {
      try { this.saveEditorDraft(); } catch (_) {}
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushDraft();
    });
    window.addEventListener('blur', flushDraft);
    window.addEventListener('pagehide', flushDraft);
  }

  show(message) {
    return new Promise((resolve) => {
      this.messageElement.textContent = message;
      this.resolve = resolve;
      this.overlay.classList.add('show');
    });
  }

  hide() {
    this.overlay.classList.remove('show');
    this.resolve = null;
  }

  handleConfirm(confirmed) {
    if (this.resolve) {
      this.resolve(confirmed);
    }
    this.hide();
  }
}

class URLNotesApp {
  constructor() {
    this.filterMode = 'site'; // 'site', 'page', or 'all_notes'
    this.currentSite = null;
    this.notes = [];
    this.allNotes = []; // For the 'All Notes' view
    this.currentNote = null;
    this.searchQuery = '';
    this.isJotMode = false;
    this.premiumStatus = null;
    this.autosaveInterval = null;
    this.dialog = new CustomDialog();
    // Debounced draft saver for editorState caching
    this.saveDraftDebounced = this.debounce(() => this.saveEditorDraft(), 150);
    
    this.init();
  }

  // Derive accent color from favicon (with safe fallbacks)
  async applyAccentFromFavicon() {
    try {
      const domain = this.currentSite?.domain;
      const accent = await this.deriveAccentColor(this.currentSite?.favicon, domain);
      if (!domain) return;
      const cached = await this.getCachedAccent(domain);
      // If accent couldn't be derived, do nothing (keep cached or neutral background)
      if (!accent) return;
      if (!this.isSameAccent(cached, accent)) {
        this.setAccentVariables(accent);
        await this.setCachedAccent(domain, accent);
      }
    } catch (e) {
      console.warn('Accent derivation failed, leaving existing colors:', e);
      // No-op on failure to avoid any flash or unwanted fallback
    }
  }

  async deriveAccentColor(faviconUrl, domain) {
    // If no favicon, do not change colors
    if (!faviconUrl) {
      return null;
    }

    // Attempt to load image with CORS
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
    img.src = faviconUrl;
    await loadPromise;

    // Draw to canvas and sample pixels
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      // Simple average color with slight saturation bias
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 16) continue; // ignore transparent
        r += data[i]; g += data[i + 1]; b += data[i + 2];
        count++;
      }
      if (!count) throw new Error('Empty favicon pixels');
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      // Convert to HSL and normalize to tasteful accent
      const { h, s, l } = this.rgbToHsl(r, g, b);
      // Tune saturation/lightness for better legibility in UI
      const accent = {
        h,
        s: Math.max(0.35, Math.min(0.65, s * 0.9)),
        l: Math.max(0.44, Math.min(0.58, l * 0.95)),
      };
      return accent;
    } catch (err) {
      // Canvas tainted or other error — do not change colors
      return null;
    }
  }

  // Removed blue-biased hash fallback to prevent initial color flash

  setAccentVariables(hsl) {
    const root = document.documentElement;
    const primary = `hsl(${Math.round(hsl.h)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}%)`;
    const secondary = `hsl(${Math.round(hsl.h)} ${Math.round(Math.min(1, hsl.s * 0.9) * 100)}% ${Math.round(Math.max(0, hsl.l - 0.06) * 100)}%)`;
    root.style.setProperty('--accent-primary', primary);
    root.style.setProperty('--accent-secondary', secondary);
  }

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, l };
  }

  // Accent cache helpers
  async getCachedAccent(domain) {
    if (!domain) return null;
    const { accentCache } = await chrome.storage.local.get(['accentCache']);
    const cache = accentCache || {};
    const entry = cache[domain];
    if (!entry) return null;
    const { h, s, l } = entry;
    if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number') return null;
    return { h, s, l };
  }

  async setCachedAccent(domain, hsl) {
    if (!domain || !hsl) return;
    const { accentCache } = await chrome.storage.local.get(['accentCache']);
    const cache = accentCache || {};
    cache[domain] = { h: hsl.h, s: hsl.s, l: hsl.l, updatedAt: Date.now() };
    await chrome.storage.local.set({ accentCache: cache });
  }

  isSameAccent(a, b) {
    if (!a || !b) return false;
    const dh = Math.abs(a.h - b.h);
    const ds = Math.abs(a.s - b.s);
    const dl = Math.abs(a.l - b.l);
    return dh < 1 && ds < 0.01 && dl < 0.01;
  }

  // Get current tab information and update UI/context
  async loadCurrentSite() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        this.currentSite = {
          domain: url.hostname,
          url: tab.url,
          title: tab.title,
          favicon: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`
        };

        // Update site icon with real favicon
        const siteIcon = document.querySelector('.site-icon');
        if (siteIcon) {
          if (this.currentSite.favicon) {
            siteIcon.innerHTML = `<img src="${this.currentSite.favicon}" alt="Site favicon">`;
          } else {
            siteIcon.innerHTML = `
              <div class="site-fallback" aria-label="No favicon available">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M3 12h18"></path>
                  <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z"></path>
                </svg>
              </div>`;
          }
        }

        // Update UI text and tooltips
        const domainEl = document.getElementById('siteDomain');
        const urlEl = document.getElementById('siteUrl');
        if (domainEl) {
          domainEl.textContent = this.currentSite.domain;
          domainEl.title = this.currentSite.domain;
        }
        if (urlEl) {
          urlEl.textContent = this.currentSite.url;
          urlEl.title = this.currentSite.url;
        }

        // Apply cached accent immediately if available
        try {
          const cached = await this.getCachedAccent(this.currentSite.domain);
          if (cached) this.setAccentVariables(cached);
        } catch (_) { }
      }
    } catch (error) {
      console.error('Error loading current site:', error);
      this.currentSite = {
        domain: 'localhost',
        url: 'http://localhost',
        title: 'Local Development',
        favicon: null
      };
    }
  }

  async init() {
    this.premiumStatus = await getPremiumStatus();
    await this.loadCurrentSite();
    this.setupEventListeners();
    await this.setupThemeDetection();
    await this.applyAccentFromFavicon();
    await this.loadNotes();
    await this.loadFontSetting();
    // Initialize settings UI once (font controls, preview, etc.)
    this.initSettings();
    this.checkStorageQuota();
    this.updateCharCount();
    this.updateNotePreview();
    // Restore last UI state (filter + possibly open editor)
    try {
      const { lastFilterMode, editorState, lastAction } = await chrome.storage.local.get(['lastFilterMode', 'editorState', 'lastAction']);
      if (lastFilterMode === 'site' || lastFilterMode === 'page' || lastFilterMode === 'all_notes') {
        this.filterMode = lastFilterMode;
      }
      this.switchFilter(this.filterMode, { persist: false });
      // Priority 1: incoming context menu action
      if (lastAction && lastAction.domain) {
        // Try to locate the target note by id in loaded notes
        const target = this.allNotes.find(n => n.id === lastAction.noteId);
        if (target) {
          this.currentNote = { ...target };
          // Do NOT clear editorState; we want reopen to work if user closes popup
          this.openEditor(true);
          // Ensure open flag and draft are persisted immediately
          this.persistEditorOpen(true);
          this.saveEditorDraft();
          // Remove action so it doesn't re-trigger on next open
          chrome.storage.local.remove('lastAction');
          return;
        }
      }
      // Priority 2: previously open editor with cached draft
      if (editorState && editorState.open && editorState.noteDraft) {
        this.currentNote = { ...editorState.noteDraft };
        if (this.currentSite) {
          this.currentNote.domain = this.currentNote.domain || this.currentSite.domain;
          this.currentNote.url = this.currentSite.url;
          this.currentNote.pageTitle = this.currentSite.title;
        }
        this.openEditor(true);
      }
    } catch (_) {
      // Fallback to default filter
      this.switchFilter(this.filterMode, { persist: false });
    }
  }

  // Load all notes from storage into the master list
  async loadNotes() {
    try {
      const allData = await chrome.storage.local.get(null);
      let allNotes = [];
      for (const key in allData) {
        // Filter out settings or non-array data
        if (key !== 'themeMode' && Array.isArray(allData[key])) {
          allNotes = allNotes.concat(allData[key]);
        }
      }
      // Sort by most recently updated
      allNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      this.allNotes = allNotes;
    } catch (error) {
      console.error('Error loading notes:', error);
      this.allNotes = []; // Fallback to an empty list on error
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Filter between all notes and page-specific
    document.getElementById('showAllBtn').addEventListener('click', () => {
      this.switchFilter('site');
    });
    
    document.getElementById('showPageBtn').addEventListener('click', () => {
      this.switchFilter('page');
    });

    document.getElementById('showAllNotesBtn').addEventListener('click', () => {
      this.switchFilter('all_notes');
    });

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    
    // Debounce render function
    const debouncedRender = this.debounce(() => this.render(), 200);

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      debouncedRender();
      searchClear.style.display = this.searchQuery ? 'block' : 'none';
    });
    
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      this.render();
      searchClear.style.display = 'none';
    });

    // Add new note
    document.getElementById('addNoteBtn').addEventListener('click', () => {
      this.createNewNote();
    });
    

    // Editor controls
    document.getElementById('backBtn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Close editor immediately (no draft clearing) for instant UI response
      const notesContainer = document.querySelector('.notes-container');
      this.closeEditor({ clearDraft: false });
      // Animate notes list entrance
      if (notesContainer) {
        notesContainer.classList.add('panel-fade-in');
        setTimeout(() => notesContainer.classList.remove('panel-fade-in'), 220);
      }
      // Use same save path as Save button but non-blocking and without clearing draft/closing again
      this.saveCurrentNote({
        clearDraftAfterSave: false,
        closeEditorAfterSave: false,
        showToast: true,
        switchFilterAfterSave: true
      }).catch(() => {});
    });
    
    document.getElementById('saveNoteBtn').addEventListener('click', () => {
      this.saveCurrentNote();
    });
    
    document.getElementById('deleteNoteBtn').addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    // Editor inputs
    document.getElementById('noteTitleHeader').addEventListener('input', () => {
      this.updateNotePreview();
      this.saveDraftDebounced();
    });
    
    const contentInput = document.getElementById('noteContentInput');
    contentInput.addEventListener('input', () => {
      this.updateNotePreview();
      this.updateCharCount();
      this.saveDraftDebounced();
    });
    // Paste sanitization: allow only text, links, and line breaks
    contentInput.addEventListener('paste', (e) => this.handleEditorPaste(e));
    // Intercept link clicks inside the editor
    contentInput.addEventListener('click', (e) => this.handleEditorLinkClick(e));
    
    // Skip textarea-specific key handling; editor is now contenteditable
    
    document.getElementById('tagsInput').addEventListener('input', () => {
      this.updateNotePreview();
      this.saveDraftDebounced();
    });

    // Settings button simply opens the settings panel
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    document.getElementById('exportNotesBtn').addEventListener('click', () => {
      this.exportNotes();
    });

    document.getElementById('importNotesBtn').addEventListener('click', () => {
      document.getElementById('importNotesInput').click();
    });

    document.getElementById('importNotesInput').addEventListener('change', (e) => {
      this.importNotes(e);
    });

    document.getElementById('aiRewriteBtn').addEventListener('click', () => {
      this.aiRewrite();
    });

    // Font selector
    document.getElementById('fontSelector').addEventListener('change', (e) => {
      this.saveFontSetting(e.target.value);
    });

    // Refresh notes when storage changes (e.g., context menu adds a note)
    // Debounce to avoid thrashing on bulk updates/imports
    const debouncedRefresh = this.debounce(async () => {
      await this.loadNotes();
      this.render();
      // If the currently open editor's note changed in storage, refresh its fields live
      if (this.currentNote) {
        const updated = this.allNotes.find(n => n.id === this.currentNote.id);
        if (updated) {
          this.currentNote = { ...updated };
          const editorEl = document.getElementById('noteEditor');
          if (editorEl && editorEl.style.display !== 'none') {
            const titleHeader = document.getElementById('noteTitleHeader');
            const contentInput = document.getElementById('noteContentInput');
            const tagsInput = document.getElementById('tagsInput');

            // Only update fields if they are not focused and actually differ
            if (titleHeader) {
              const titleFocused = document.activeElement === titleHeader;
              const newTitle = this.currentNote.title || '';
              if (!titleFocused && titleHeader.value !== newTitle) {
                titleHeader.value = newTitle;
              }
            }

            if (contentInput) {
              const contentFocused = document.activeElement === contentInput;
              const newHtml = this.buildContentHtml(this.currentNote.content || '');
              if (!contentFocused && contentInput.innerHTML !== newHtml) {
                contentInput.innerHTML = newHtml;
              }
            }

            if (tagsInput) {
              const tagsFocused = document.activeElement === tagsInput;
              const newTags = (this.currentNote.tags || []).join(', ');
              if (!tagsFocused && tagsInput.value !== newTags) {
                tagsInput.value = newTags;
              }
            }

            this.updateNotePreview();
            this.updateCharCount();
          }
        }
      }
    }, 120);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      // Ignore editorState-only changes (draft autosave), which shouldn't trigger a UI refresh
      const changedKeys = Object.keys(changes || {});
      if (changedKeys.length > 0 && changedKeys.every(k => k === 'editorState')) {
        return;
      }
      // If the user is actively editing in the editor, avoid immediate refresh to prevent caret jumps.
      const active = document.activeElement;
      const isEditing = active && (active.id === 'noteTitleHeader' || active.id === 'noteContentInput' || active.id === 'tagsInput');
      if (isEditing) {
        clearTimeout(this._pendingStorageRefresh);
        this._pendingStorageRefresh = setTimeout(() => {
          debouncedRefresh();
        }, 400);
        return;
      }
      // Otherwise refresh normally
      debouncedRefresh();
    });

    // Persist editor/filter state when popup is about to close
    window.addEventListener('beforeunload', () => {
      try {
        if (this.currentNote) {
          this.saveEditorDraft();
          this.persistEditorOpen(true);
        } else {
          this.persistEditorOpen(false);
        }
      } catch (_) {}
    });
  }

  initSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const settingsBackBtn = document.getElementById('settingsBackBtn');
    const exportNotesBtn = document.getElementById('exportNotesBtn');
    const importNotesBtn = document.getElementById('importNotesBtn');
    const importNotesInput = document.getElementById('importNotesInput');
    const fontSelector = document.getElementById('fontSelector');
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const fontPreviewText = document.getElementById('fontPreviewText');

    const updateFontPreview = (fontName, sizePx) => {
      if (fontSizeValue) fontSizeValue.textContent = `${sizePx}px`;
      if (fontPreviewText) {
        const previewFontFamily = (fontName === 'Default' || fontName === 'System')
          ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
          : fontName;
        fontPreviewText.style.fontFamily = previewFontFamily;
        fontPreviewText.style.fontSize = `${sizePx}px`;
      }
    };

    // Close settings: apply chosen font to editor then hide panel
    // Keep this binding here so it's wired once
    settingsBackBtn.addEventListener('click', () => {
      const fontName = fontSelector.value;
      const size = fontSizeSlider.value;
      this.applyFont(fontName, size);
      this.closeSettings();
    });

    // Font controls
    fontSelector.addEventListener('change', (e) => {
      const fontName = e.target.value;
      const size = fontSizeSlider.value;
      // Do not apply to editor while settings is open; preview only
      updateFontPreview(fontName, size);
      chrome.storage.local.set({ editorFont: fontName });
    });

    fontSizeSlider.addEventListener('input', (e) => {
      let size = parseInt(e.target.value, 10);
      if (Number.isNaN(size)) size = 12;
      // Clamp to [8, 18]
      size = Math.max(8, Math.min(18, size));
      const fontName = fontSelector.value;
      // Keep the slider visually clamped
      fontSizeSlider.value = String(size);
      // Do not apply to editor while settings is open; preview only
      updateFontPreview(fontName, size);
      chrome.storage.local.set({ editorFontSize: String(size) });
    });

    // Load saved font settings
    chrome.storage.local.get(['editorFont', 'editorFontSize'], ({ editorFont, editorFontSize }) => {
      // Normalize legacy 'System' to 'Default'
      const normalizedFont = editorFont === 'System' ? 'Default' : (editorFont || 'Default');
      fontSelector.value = normalizedFont;
      if (editorFont === 'System') {
        chrome.storage.local.set({ editorFont: 'Default' });
      }
      // Determine size with default 12 and clamp within [8, 18]
      let sizeToUse = parseInt(editorFontSize || fontSizeSlider.value || '12', 10);
      if (Number.isNaN(sizeToUse)) sizeToUse = 12;
      sizeToUse = Math.max(8, Math.min(18, sizeToUse));
      fontSizeSlider.value = String(sizeToUse);
      this.applyFont(fontSelector.value, sizeToUse);
      updateFontPreview(fontSelector.value, sizeToUse);
    });
  }

  // Detect system theme and manage override (auto/light/dark)
  async setupThemeDetection() {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;

    // Load preference
    const { themeMode } = await chrome.storage.local.get(['themeMode']);
    
    
    
    this.themeMode = themeMode || 'auto'; // 'auto' | 'light' | 'dark'

    const updateAuto = () => {
      const isDark = mql.matches;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      this.updateThemeToggleTitle('auto');
    };

    const applyTheme = () => {
      if (this.themeMode === 'auto') {
        updateAuto();
      } else if (this.themeMode === 'light') {
        root.setAttribute('data-theme', 'light');
        this.updateThemeToggleTitle('light');
      } else if (this.themeMode === 'dark') {
        root.setAttribute('data-theme', 'dark');
        this.updateThemeToggleTitle('dark');
      }
    };

    // Listen to system changes only in auto mode
    const onChange = () => {
      if (this.themeMode === 'auto') updateAuto();
    };
    mql.addEventListener('change', onChange);

    // Wire toggle
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', async () => {
        this.themeMode = this.themeMode === 'auto' ? 'light' : this.themeMode === 'light' ? 'dark' : 'auto';
        await chrome.storage.local.set({ themeMode: this.themeMode });
        applyTheme();
      });
    }

    applyTheme();
  }

  updateThemeToggleTitle(mode) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    const map = { auto: 'Theme: Auto', light: 'Theme: Light', dark: 'Theme: Dark' };
    btn.title = map[mode] || 'Theme';
    btn.setAttribute('aria-label', btn.title);
  }

  // Switch between different note filters
  // options.persist: whether to store lastFilterMode (default: true)
  switchFilter(filter, options = { persist: true }) {
    this.filterMode = filter;
    
    // Update filter UI
    document.querySelectorAll('.filter-option').forEach(btn => {
      btn.classList.remove('active');
    });
    const buttonId = {
      'site': 'showAllBtn',
      'page': 'showPageBtn',
      'all_notes': 'showAllNotesBtn'
    }[filter];
    document.getElementById(buttonId).classList.add('active');

    // Set data-view on root for view-specific styling (compact site/page)
    document.documentElement.setAttribute('data-view', filter);

    // Update search placeholder for clarity per view
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      const placeholder =
        filter === 'all_notes' ? 'Search All Notes' :
        filter === 'site' ? 'Search This Site' :
        'Search This Page';
      searchInput.setAttribute('placeholder', placeholder);
    }

    this.render();
    // Persist last chosen filter unless suppressed
    if (!options || options.persist !== false) {
      chrome.storage.local.set({ lastFilterMode: this.filterMode });
    }
  }

  // Render the notes list based on the current filter and search query
  render() {
    const notesList = document.getElementById('notesList');
    let emptyState = document.getElementById('emptyState');
    notesList.innerHTML = ''; // Clear previous list

    let filteredNotes = [];

    // 1. Apply filter mode
    if (this.filterMode === 'site') {
      filteredNotes = this.allNotes.filter(note => note.domain === this.currentSite.domain);
    } else if (this.filterMode === 'page') {
      const currentKey = this.normalizePageKey(this.currentSite.url);
      filteredNotes = this.allNotes.filter(note => this.normalizePageKey(note.url) === currentKey);
    } else { // 'all_notes'
      filteredNotes = this.allNotes;
    }

    // 2. Apply search query with prioritization
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filteredNotes = filteredNotes.map(note => {
        let score = 0;
        if (note.domain && note.domain.toLowerCase().includes(query)) score += 4;
        if (note.title.toLowerCase().includes(query)) score += 3;
        if (note.tags.some(tag => tag.toLowerCase().includes(query))) score += 2;
        if (note.content.toLowerCase().includes(query)) score += 1;
        return { note, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.note);
    } else if (this.filterMode === 'all_notes' && !this.searchQuery) {
      // For 'all_notes' view, show all notes when there's no search query
      filteredNotes = this.allNotes;
    }

    // 3. Render notes or empty state
    if (filteredNotes.length === 0) {
      if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.id = 'emptyState';
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
          </div>
          <h4>No notes found</h4>
          <p>Try a different filter or create a new note.</p>
        `;
      }
      notesList.innerHTML = '';
      notesList.appendChild(emptyState);
      emptyState.style.display = 'flex';
    } else {
      if (emptyState) {
        emptyState.style.display = 'none';
      }
      notesList.innerHTML = '';
      
      if (this.filterMode === 'all_notes') {
        this.renderGroupedNotes(filteredNotes);
      } else {
        filteredNotes.forEach(note => {
          const noteElement = this.createNoteElement(note);
          notesList.appendChild(noteElement);
        });
      }
    }
  }

  // Group notes by domain, including aggregated tags
  groupNotesByDomain(notes) {
    const grouped = notes.reduce((acc, note) => {
      const domain = note.domain || 'No Domain';
      if (!acc[domain]) {
        acc[domain] = { notes: [], tagCounts: {} };
      }
      acc[domain].notes.push(note);
      if (note.tags && note.tags.length > 0) {
        note.tags.forEach(tag => {
          acc[domain].tagCounts[tag] = (acc[domain].tagCounts[tag] || 0) + 1;
        });
      }
      return acc;
    }, {});

    // Get top 5 tags for each domain
    for (const domain in grouped) {
      grouped[domain].tags = Object.entries(grouped[domain].tagCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([tag]) => tag);
    }
    
    return grouped;
  }

  // Render notes grouped by domain for 'All Notes' view
  renderGroupedNotes(notes) {
    const notesList = document.getElementById('notesList');
    const groupedData = this.groupNotesByDomain(notes);
    const sortedDomains = Object.keys(groupedData).sort();

    notesList.innerHTML = ''; // Clear previous list

    sortedDomains.forEach(domain => {
      const { notes: domainNotes, tags: domainTags } = groupedData[domain];

      const domainGroup = document.createElement('details');
      domainGroup.className = 'domain-group';
      // Expand top two results only when searching
      const domainIndex = sortedDomains.indexOf(domain);
      domainGroup.open = this.searchQuery && domainIndex < 2;
      
      const rightDomainTagsHtml = (domainTags && domainTags.length > 0) ? `
        <div class="domain-tags domain-tags-right">
          ${domainTags.map(tag => `<span class="note-tag">${tag}</span>`).join('')}
        </div>
      ` : '';

      domainGroup.innerHTML = `
        <summary class="domain-group-header">
          <div class="domain-header-info">
            <span>${domain} (${domainNotes.length})</span>
            <div class="domain-inline-actions">
              <button class="icon-btn sm glass open-domain-btn" data-domain="${domain}" title="Open ${domain}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 3h7v7"/>
                  <path d="M10 14 21 3"/>
                  <path d="M3 10v11h11"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="domain-actions">
            <button class="icon-btn delete-domain-btn" data-domain="${domain}" title="Delete all notes for this domain">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
          ${rightDomainTagsHtml}
        </summary>
        <div class="domain-notes-list"></div>
      `;
      
      const deleteDomainBtn = domainGroup.querySelector('.delete-domain-btn');
      const openDomainBtn = domainGroup.querySelector('.open-domain-btn');
      const actionsContainer = domainGroup.querySelector('.domain-actions');
      const domainNotesList = domainGroup.querySelector('.domain-notes-list');

      deleteDomainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.showInlineConfirm(actionsContainer, () => {
          this.deleteNotesByDomain(domain, true);
        });
      });

      if (openDomainBtn) {
        openDomainBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.openDomainHomepage(domain);
        });
      }

      // Append note elements as DOM nodes so their event listeners remain active
      domainNotes.forEach(n => {
        const el = this.createNoteElement(n);
        domainNotesList.appendChild(el);
      });

      notesList.appendChild(domainGroup);
    });
  }

  // Create a note element
  createNoteElement(note) {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'note-item';
    noteDiv.addEventListener('click', () => this.openNote(note));

    // Build preview HTML that makes markdown links clickable (first line only)
    const preview = this.buildPreviewHtml(note.content);
    const tagsHtml = (note.tags && note.tags.length > 0) ? 
      `<div class="note-tags">${note.tags.map(tag => `<span class=\"note-tag\">${tag}</span>`).join('')}</div>` : '';

    // Tags removed from note list items to keep cards compact across views
    const pageIndicator = (this.filterMode !== 'page' && note.url === this.currentSite.url) ? 
      '<span class="page-indicator" data-tooltip="Current page note">•</span>' : '';

    noteDiv.innerHTML = `
      <div class="note-item-header">
        <div class="note-header-left">
          <div class="note-title">${pageIndicator}${note.title || 'Untitled'}</div>
          ${this.filterMode !== 'page' ? `
            <div class="note-inline-actions">
              <button class="icon-btn sm glass note-open-btn" data-note-id="${note.id}" title="Open referenced page">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 3h7v7"/>
                  <path d="M10 14 21 3"/>
                  <path d="M21 14v7h-7"/>
                  <path d="M3 10v11h11"/>
                </svg>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="note-header-right">
          <button class="note-delete-btn" data-note-id="${note.id}" title="Delete note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="m19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
            </svg>
          </button>
          <div class="note-date">${this.formatDate(note.updatedAt)}</div>
        </div>
      </div>
      <div class="note-preview">${preview}</div>
      ${tagsHtml}
    `;
    
    // Add open button event listener (only present in non-page views)
    const openBtn = noteDiv.querySelector('.note-open-btn');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const displayText = note.title || note.pageTitle || '';
        this.openLinkAndHighlight(note.url, displayText);
      });
    }

    // Add delete button event listener (two-tap confirm on same icon)
    const deleteBtn = noteDiv.querySelector('.note-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent opening the note
      this.handleTwoTapDelete(deleteBtn, () => {
        this.deleteNoteFromList(note.id, true);
      });
    });

    return noteDiv;
  }

  // Lightweight two-tap delete: first tap arms, second within timeout confirms
  handleTwoTapDelete(btn, onConfirm) {
    try {
      const armed = btn.getAttribute('data-armed') === 'true';
      if (armed) {
        // Confirmed
        btn.removeAttribute('data-armed');
        btn.classList.remove('confirm');
        if (btn._confirmTimer) {
          clearTimeout(btn._confirmTimer);
          btn._confirmTimer = null;
        }
        onConfirm && onConfirm();
        return;
      }
      // Arm
      btn.setAttribute('data-armed', 'true');
      btn.classList.add('confirm');
      const prevTitle = btn.getAttribute('title') || '';
      btn.setAttribute('data-prev-title', prevTitle);
      btn.setAttribute('title', 'Click again to delete');
      // Auto-disarm after 1.6s
      btn._confirmTimer = setTimeout(() => {
        btn.removeAttribute('data-armed');
        btn.classList.remove('confirm');
        const pt = btn.getAttribute('data-prev-title');
        if (pt !== null) btn.setAttribute('title', pt);
      }, 1600);
    } catch (_) {
      // Fallback: direct confirm
      onConfirm && onConfirm();
    }
  }

  // Convert first line of note content to preview HTML with clickable links
  buildPreviewHtml(content) {
    try {
      const firstLine = (content || '').split('\n')[0];
      if (!firstLine) return '';
      // Escape HTML except simple markdown links we convert below
      const escapeHtml = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Extract optional leading bullet "- " then markdown link [text](url)
      const bulletMatch = firstLine.match(/^\s*-\s*(.*)$/);
      const line = bulletMatch ? bulletMatch[1] : firstLine;

      // Replace markdown links with plain text (no anchors in list preview)
      const mdLink = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
      let replaced = '';
      let lastIndex = 0;
      let match;
      while ((match = mdLink.exec(line)) !== null) {
        // Append escaped text before the match
        replaced += escapeHtml(line.slice(lastIndex, match.index));
        const text = escapeHtml(match[1]);
        // Only include the display text; do not render as a link in previews
        replaced += `${text}`;
        lastIndex = mdLink.lastIndex;
      }
      replaced += escapeHtml(line.slice(lastIndex));

      // Add a bullet visually if original started with "- "
      const bulletPrefix = bulletMatch ? '&#8226; ' : '';
      return `${bulletPrefix}${replaced}`;
    } catch (e) {
      return (content || '').substring(0, 100);
    }
  }

  // Render markdown/plain text to minimal HTML for the contenteditable editor
  buildContentHtml(content) {
    try {
      const escapeHtml = (s) => (s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const lines = (content || '').split(/\r?\n/);
      const mdLink = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
      const htmlLines = lines.map(line => {
        let out = '';
        let lastIndex = 0;
        let match;
        while ((match = mdLink.exec(line)) !== null) {
          out += escapeHtml(line.slice(lastIndex, match.index));
          const text = escapeHtml(match[1]);
          const href = match[2];
          out += `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
          lastIndex = mdLink.lastIndex;
        }
        out += escapeHtml(line.slice(lastIndex));
        return out;
      });
      return htmlLines.join('<br>');
    } catch (e) {
      return (content || '').replace(/\n/g, '<br>');
    }
  }

  // Convert limited HTML back to markdown-like plain text for storage
  htmlToMarkdown(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    // Remove disallowed tags by unwrapping while preserving line breaks.
    // For block elements, insert <br> boundaries to reflect visual line breaks.
    const allowed = new Set(['A', 'BR']);
    const blockTags = new Set(['DIV', 'P', 'PRE', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT, null);
    const toRemove = [];
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (!allowed.has(el.tagName)) {
        const isBlock = blockTags.has(el.tagName);
        if (isBlock) {
          // Insert a <br> before block (if not at start or already separated)
          if (el.previousSibling && el.previousSibling.nodeName !== 'BR') {
            el.parentNode.insertBefore(document.createElement('br'), el);
          }
        }
        // Unwrap: move children out in place
        let lastChild = null;
        while (el.firstChild) {
          lastChild = el.firstChild;
          el.parentNode.insertBefore(lastChild, el);
        }
        if (isBlock) {
          // Insert a <br> after block to mark end of this block
          if (lastChild && lastChild.nodeName !== 'BR') {
            el.parentNode.insertBefore(document.createElement('br'), el);
          }
        }
        toRemove.push(el);
      }
    }
    toRemove.forEach(n => n.remove());

    // Replace anchors with [text](href)
    tmp.querySelectorAll('a[href]').forEach(a => {
      const text = a.textContent || a.getAttribute('href');
      const href = a.getAttribute('href');
      const md = document.createTextNode(`[${text}](${href})`);
      a.replaceWith(md);
    });

    // Convert <br> to \n
    const htmlStr = tmp.innerHTML
      .replace(/<br\s*\/?>(?=\n)?/gi, '\n')
      .replace(/<br\s*\/?>(?!\n)/gi, '\n');

    // Strip remaining tags if any
    const text = htmlStr.replace(/<[^>]*>/g, '');
    // Decode entities by using textContent of a temp element
    const decode = document.createElement('textarea');
    decode.innerHTML = text;
    return decode.value;
  }

  // --- Caret/Selection utilities ---
  getSelectionOffsets(container) {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };
      const range = sel.getRangeAt(0);
      const computePos = (node, targetNode, targetOffset) => {
        let pos = 0;
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_ALL, null);
        let current = walker.currentNode;
        const advance = (n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            pos += n.nodeValue.length;
          } else if (n.nodeName === 'BR') {
            pos += 1; // treat <br> as one char (newline)
          }
        };
        // If container itself is text node, handle differently
        if (node.nodeType === Node.TEXT_NODE) {
          // Not typical for our container; fallback to length
          return Math.min(targetOffset, node.nodeValue.length);
        }
        while (current) {
          if (current === targetNode) {
            if (current.nodeType === Node.TEXT_NODE) {
              pos += Math.min(targetOffset, current.nodeValue.length);
            } else if (current.nodeName === 'BR') {
              pos += 1; // caret after BR counts as after newline
            }
            break;
          }
          // Dive into children first
          if (current.firstChild) {
            current = current.firstChild;
            continue;
          }
          // Process node
          advance(current);
          // Move to next sibling or ascend
          while (current && !current.nextSibling && current !== node) {
            current = current.parentNode;
          }
          if (!current || current === node) {
            break;
          }
          current = current.nextSibling;
        }
        return pos;
      };
      const start = computePos(container, range.startContainer, range.startOffset);
      const end = computePos(container, range.endContainer, range.endOffset);
      return { start, end };
    } catch (_) {
      return { start: 0, end: 0 };
    }
  }

  setSelectionOffsets(container, start, end) {
    try {
      let pos = 0;
      let startNode = null, startOffset = 0;
      let endNode = null, endOffset = 0;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_ALL, null);
      let current = walker.currentNode;

      const matchPoint = (needStart, needEnd, len) => {
        if (needStart && startNode === null && pos + len >= start) {
          startNode = current.nodeType === Node.TEXT_NODE ? current : container;
          startOffset = current.nodeType === Node.TEXT_NODE ? (start - pos) : 0;
        }
        if (needEnd && endNode === null && pos + len >= end) {
          endNode = current.nodeType === Node.TEXT_NODE ? current : container;
          endOffset = current.nodeType === Node.TEXT_NODE ? (end - pos) : 0;
        }
      };

      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          const len = current.nodeValue.length;
          matchPoint(true, true, len);
          pos += len;
        } else if (current.nodeName === 'BR') {
          const len = 1;
          // Place caret before/after BR by anchoring to container and zero offsets; browsers will place it around the BR
          matchPoint(true, true, len);
          pos += len;
        }

        // Traverse depth-first
        if (current.firstChild) {
          current = current.firstChild;
          continue;
        }
        while (current && !current.nextSibling && current !== container) {
          current = current.parentNode;
        }
        if (!current || current === container) break;
        current = current.nextSibling;
      }

      const range = document.createRange();
      range.setStart(startNode || container, startNode ? startOffset : 0);
      range.setEnd(endNode || container, endNode ? endOffset : 0);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }

  // Handle paste into contenteditable: sanitize to safe minimal HTML
  handleEditorPaste(e) {
    try {
      const clipboard = e.clipboardData || window.clipboardData;
      if (!clipboard) return; // let default behavior
      const text = clipboard.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      const html = this.sanitizePastedTextToHtml(text);
      this.insertHtmlAtCaret(html);
      this.updateCharCount();
    } catch (_) {
      // On error, allow default paste
    }
  }

  // Convert pasted plain text to safe HTML (linkify + line breaks)
  sanitizePastedTextToHtml(text) {
    const escapeHtml = (s) => (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&#34;')
      .replace(/'/g, '&#39;');

    // Split into lines and escape first
    const raw = (text || '').replace(/\r\n?/g, '\n');
    const lines = raw.split('\n').map(escapeHtml);
    // Linkify URLs and emails per line
    const urlRe = /\b(https?:\/\/[^\s<>"]+)\b/g;
    const emailRe = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
    const linked = lines.map(line => {
      let out = line.replace(urlRe, (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`);
      out = out.replace(emailRe, (m) => `<a href="mailto:${m}">${m}</a>`);
      return out;
    });
    return linked.join('<br>');
  }

  // Insert HTML at caret within contenteditable safely
  insertHtmlAtCaret(html) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      document.execCommand('insertHTML', false, html);
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const frag = range.createContextualFragment(html);
    const lastNode = frag.lastChild;
    range.insertNode(frag);
    // Move caret after inserted content
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // Build a normalized key for URL equality on the "This Page" filter and tab matching
  // - strips hash (including :~:text fragments)
  // - removes common tracking query params
  // - lowercases host and removes leading www.
  // - removes trailing slash from path (except root)
  // - sorts remaining query params for stable comparison
  normalizePageKey(u) {
    try {
      const x = new URL(u, this.currentSite ? this.currentSite.url : undefined);
      let host = (x.hostname || '').replace(/^www\./i, '').toLowerCase();
      let path = x.pathname || '/';
      if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
      const params = new URLSearchParams(x.search);
      const deny = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','mc_eid','yclid','igshid','si','si_source','si_id'];
      deny.forEach(k => params.delete(k));
      const entries = Array.from(params.entries()).sort(([a],[b]) => a.localeCompare(b));
      const query = entries.length ? ('?' + entries.map(([k,v]) => `${k}=${v}`).join('&')) : '';
      // Ignore hash entirely for page identity
      return `${host}${path}${query}`;
    } catch {
      return (u || '').toString();
    }
  }

  // Wait briefly until the content script in a tab has reported readiness via background session storage
  async awaitContentReady(tabId, { timeoutMs = 3000, intervalMs = 150 } = {}) {
    const key = `pageInfo_${tabId}`;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const data = await chrome.storage.session.get(key);
        if (data && data[key]) return true;
      } catch (_) { /* no-op */ }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  // Handle clicking links inside the editor contenteditable
  handleEditorLinkClick(e) {
    const target = e.target;
    if (target && target.tagName === 'A') {
      e.preventDefault();
      const href = target.getAttribute('href');
      const text = target.textContent || '';
      this.openLinkAndHighlight(href, text);
    }
  }

  async openLinkAndHighlight(href, text) {
    try {
      const baseUrl = (this.currentNote && this.currentNote.url) || (this.currentSite && this.currentSite.url) || undefined;
      let absoluteHref = href;
      try {
        // Resolve relative links against the current page URL when possible
        absoluteHref = baseUrl ? new URL(href, baseUrl).toString() : new URL(href).toString();
      } catch {}

      // Build a comparable key with normalization (local to this method)
      const makeKey = (u) => {
        try {
          const x = new URL(u);
          let host = x.hostname.replace(/^www\./i, '').toLowerCase();
          let path = x.pathname || '/';
          if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
          const params = new URLSearchParams(x.search);
          const deny = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','mc_eid','yclid','igshid','si','si_source','si_id'];
          deny.forEach(k => params.delete(k));
          const entries = Array.from(params.entries()).sort(([a],[b]) => a.localeCompare(b));
          const query = entries.length ? ('?' + entries.map(([k,v]) => `${k}=${v}`).join('&')) : '';
          return `${host}${path}${query}`;
        } catch {
          return u;
        }
      };
      const targetKey = makeKey(absoluteHref);

      const tabs = await chrome.tabs.query({ currentWindow: true });
      let targetTab = tabs.find(t => makeKey(t.url) === targetKey);

      // For new tabs, try to include a text fragment to encourage native highlight
      const addTextFragment = (u, txt) => {
        if (!txt) return u;
        try {
          const urlObj = new URL(u);
          const enc = encodeURIComponent(txt.trim()).slice(0, 500);
          const hash = urlObj.hash || '';
          // If hash already contains :~:text, keep it
          if (hash.includes(':~:text=')) return u;
          // Compose new hash preserving existing hash if present
          // If existing hash exists, append &; otherwise use #:~:text
          const baseHash = hash.replace(/^#/, '');
          const newHash = baseHash
            ? `${baseHash}&:~:text=${enc}`
            : `:~:text=${enc}`;
          urlObj.hash = `#${newHash}`;
          return urlObj.toString();
        } catch {
          return u;
        }
      };

      // Helper: send message with retries in case content script isn't ready yet
      const sendMessageWithRetry = (tabId, payload, attempts = [150, 300, 600, 1000, 1600]) => {
        const tryOnce = (i) => {
          setTimeout(() => {
            try {
              chrome.tabs.sendMessage(tabId, payload).catch(() => {
                if (i + 1 < attempts.length) tryOnce(i + 1);
              });
            } catch {
              if (i + 1 < attempts.length) tryOnce(i + 1);
            }
          }, attempts[i]);
        };
        tryOnce(0);
      };

      if (!targetTab) {
        const urlToOpen = addTextFragment(absoluteHref, text);
        targetTab = await chrome.tabs.create({ url: urlToOpen, active: true });
        // Retry highlight a few times as the tab loads
        sendMessageWithRetry(targetTab.id, { action: 'highlightText', href: urlToOpen, text });
      } else {
        // If already on the same page, do not reload the page. Just activate and request highlight.
        await chrome.tabs.update(targetTab.id, { active: true });
        sendMessageWithRetry(targetTab.id, { action: 'highlightText', href: absoluteHref, text }, [50, 120, 250, 500]);
      }
    } catch (err) {
      console.warn('openLinkAndHighlight failed', err);
      // Fallback: open normally
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }

  // Open a domain's homepage using existing tab reuse and highlight logic
  async openDomainHomepage(domain) {
    try {
      const url = `https://${domain}/`;
      await this.openLinkAndHighlight(url, '');
    } catch (e) {
      // Fallback open; openLinkAndHighlight already attempts a safe open
      window.open(`https://${domain}/`, '_blank', 'noopener,noreferrer');
    }
  }

  // Create a new note (hybrid - always save both domain and URL)
  createNewNote() {
    this.isJotMode = false;
    const newNote = {
      id: this.generateId(),
      title: '',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      domain: this.currentSite.domain,
      url: this.currentSite.url,
      pageTitle: this.currentSite.title
    };

    this.currentNote = newNote;
    this.openEditor();
  }
  

  // Open existing note
  openNote(note) {
    this.currentNote = { ...note };
    this.openEditor();
  }

  // Open the note editor
  openEditor(focusContent = false) {
    const editor = document.getElementById('noteEditor');
    const titleHeader = document.getElementById('noteTitleHeader');
    const contentInput = document.getElementById('noteContentInput');
    const tagsInput = document.getElementById('tagsInput');
    const dateSpan = document.getElementById('noteDate');
    const aiRewriteBtn = document.getElementById('aiRewriteBtn');

    // Populate editor with note data
    titleHeader.value = this.currentNote.title;
    // Render markdown/plain text to HTML for the contenteditable editor
    contentInput.innerHTML = this.buildContentHtml(this.currentNote.content);
    tagsInput.value = this.currentNote.tags.join(', ');
    // Do not show created date inside the editor UI to avoid mid-editor clutter
    if (dateSpan) {
      dateSpan.textContent = '';
      dateSpan.style.display = 'none';
    }

    // Show premium features
    if (this.premiumStatus.isPremium) {
      aiRewriteBtn.style.display = 'flex';
    } else {
      aiRewriteBtn.style.display = 'none';
    }

    // Show editor with animation
    editor.style.display = 'flex';
    editor.classList.add('slide-in', 'editor-fade-in');
    // Mark editor as open and persist current draft immediately
    this.persistEditorOpen(true);
    this.saveEditorDraft();
    
    // Focus appropriately and try to restore caret from cached draft (if present)
    setTimeout(() => {
      const focusContentNow = (focusContent || this.isJotMode);
      if (focusContentNow) {
        contentInput.focus();
      } else {
        titleHeader.focus();
      }
      // Attempt to restore caret from editorState
      try {
        chrome.storage.local.get(['editorState']).then(({ editorState }) => {
          if (!editorState || !editorState.noteDraft) return;
          const d = editorState.noteDraft;
          if (d.id === this.currentNote.id && typeof d.caretStart === 'number' && typeof d.caretEnd === 'number') {
            // Ensure content area is focused before restoring selection
            contentInput.focus();
            this.setSelectionOffsets(contentInput, d.caretStart, d.caretEnd);
          }
        }).catch(() => {});
      } catch (_) {}
    }, 120);
    
    this.updateCharCount();
  }

  // Close the note editor
  closeEditor(options = { clearDraft: false }) {
    const editor = document.getElementById('noteEditor');
    editor.classList.add('slide-out');
    
    setTimeout(() => {
      editor.style.display = 'none';
      editor.classList.remove('slide-in', 'slide-out', 'editor-fade-in');
      // If requested, clear cached draft; otherwise keep cached but mark not open
      if (options && options.clearDraft) {
        this.clearEditorState();
        // Only when explicitly clearing the draft do we drop currentNote reference
        this.currentNote = null;
      } else {
        // Cache latest draft immediately on close to avoid losing unsaved edits
        this.saveEditorDraft();
        this.persistEditorOpen(false);
      }
    }, 240);
  }

  

  // Save current note
  async saveCurrentNote(optionsOrAutosave = false) {
    const opts = typeof optionsOrAutosave === 'object' ? optionsOrAutosave : {
      clearDraftAfterSave: true,
      closeEditorAfterSave: true,
      showToast: !optionsOrAutosave, // if autosave boolean passed true, suppress toast
      switchFilterAfterSave: true
    };
    if (!this.currentNote) {
      this.showToast('No note open to save');
      return;
    }
    
    // Grab editor fields
    const titleHeader = document.getElementById('noteTitleHeader');
    const contentInput = document.getElementById('noteContentInput');
    const tagsInput = document.getElementById('tagsInput');

    // Update note data from editor
    this.currentNote.title = (titleHeader && titleHeader.value ? titleHeader.value : '').trim();
    // Convert editor HTML back to markdown/plain text for storage
    this.currentNote.content = this.htmlToMarkdown(contentInput ? contentInput.innerHTML : '');
    this.currentNote.tags = (tagsInput && tagsInput.value
      ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      : []);
    this.currentNote.updatedAt = new Date().toISOString();

    // Update URL and page title for current context
    this.currentNote.url = this.currentSite.url;
    this.currentNote.pageTitle = this.currentSite.title;
    
    // Don't save empty notes (title, content, and tags all empty)
    const isTitleEmpty = !this.currentNote.title;
    const isContentEmpty = (this.currentNote.content || '').trim() === '';
    const areTagsEmpty = (this.currentNote.tags || []).length === 0;
    if (isTitleEmpty && isContentEmpty && areTagsEmpty) {
      try { await this.clearEditorState(); } catch (_) {}
      try { await this.persistEditorOpen(false); } catch (_) {}
      this.closeEditor({ clearDraft: true });
      return;
    }

    // Get all notes for the current domain from storage
    const domain = this.currentNote.domain;
    const data = await chrome.storage.local.get(domain);
    const notesForDomain = data[domain] || [];

    // Find and update the note, or add it if new
    const noteIndex = notesForDomain.findIndex(n => n.id === this.currentNote.id);
    if (noteIndex > -1) {
      notesForDomain[noteIndex] = this.currentNote;
    } else {
      notesForDomain.push(this.currentNote);
    }

    // Save back to storage
    await chrome.storage.local.set({ [domain]: notesForDomain });

    // Update master list in memory
    const masterIndex = this.allNotes.findIndex(n => n.id === this.currentNote.id);
    if (masterIndex > -1) {
      this.allNotes[masterIndex] = this.currentNote;
    } else {
      this.allNotes.unshift(this.currentNote); // Add to front for visibility
    }

    // Sort master list again to be safe
    this.allNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (opts.showToast) this.showToast('Note saved!');
    // Clear draft and/or close according to options
    if (opts.closeEditorAfterSave) {
      this.closeEditor({ clearDraft: !!opts.clearDraftAfterSave });
    } else if (opts.clearDraftAfterSave) {
      await this.clearEditorState();
    } else {
      // Persist editor open false since we're leaving editor via back
      await this.persistEditorOpen(false);
    }

    if (opts.switchFilterAfterSave) {
      // After saving, switch to This Page filter
      this.switchFilter('page');
      // Re-render from memory (switchFilter already renders)
      this.checkStorageQuota();
    }
  }

  // Delete current note (from editor)
  async deleteCurrentNote() {
    if (!this.currentNote) {
      this.showToast('No note to delete');
      return;
    }

    // If it's a new, unsaved note, just close the editor
    const isNewNote = !this.allNotes.some(n => n.id === this.currentNote.id);
    if (isNewNote) {
      this.closeEditor();
      return;
    }

    const confirmed = await this.dialog.show(`Delete "${this.currentNote.title || 'Untitled'}"?`);
    if (!confirmed) {
      return;
    }

    // Remove from master list in memory
    const masterIndex = this.allNotes.findIndex(n => n.id === this.currentNote.id);
    if (masterIndex > -1) {
      this.allNotes.splice(masterIndex, 1);
    }

    // Remove from storage
    const domain = this.currentNote.domain;
    const data = await chrome.storage.local.get(domain);
    let notesForDomain = data[domain] || [];
    notesForDomain = notesForDomain.filter(n => n.id !== this.currentNote.id);
    await chrome.storage.local.set({ [domain]: notesForDomain });

    this.showToast('Note deleted');
    // Clear draft cache and close editor
    this.closeEditor({ clearDraft: true });
    await this.postDeleteRefresh();
  }
  
  // Delete note from list (with confirmation)
  async deleteNoteFromList(noteId, skipConfirm = false) {
    const note = this.allNotes.find(n => n.id === noteId);
    if (!note) return;

    // This function is now only called directly when confirmed, so no need for dialog.
    // The inline confirmation is handled by the click listener in `createNoteElement`.

    // Remove from master list
    this.allNotes = this.allNotes.filter(n => n.id !== noteId);

    // Remove from storage
    const domain = note.domain;
    const data = await chrome.storage.local.get(domain);
    let notesForDomain = data[domain] || [];
    notesForDomain = notesForDomain.filter(n => n.id !== noteId);
    await chrome.storage.local.set({ [domain]: notesForDomain });

    this.showToast('Note deleted');
    await this.postDeleteRefresh();
  }

  // Standardized inline confirmation UI
  showInlineConfirm(parent, onConfirm) {
    // Remove any other open confirmations
    const existingConfirm = document.querySelector('.inline-confirm');
    if (existingConfirm) {
      existingConfirm.remove();
    }

    const confirmUI = document.createElement('div');
    confirmUI.className = 'inline-confirm';
    confirmUI.innerHTML = `
      <span>Delete?</span>
      <button class="confirm-yes">Confirm</button>
      <button class="confirm-no">Cancel</button>
    `;

    parent.appendChild(confirmUI);

    confirmUI.querySelector('.confirm-yes').addEventListener('click', (e) => {
      e.stopPropagation();
      onConfirm();
      confirmUI.remove();
    });

    confirmUI.querySelector('.confirm-no').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmUI.remove();
    });
  }

  // Persist editor open flag (and keep existing noteDraft intact)
  async persistEditorOpen(isOpen) {
    try {
      const { editorState } = await chrome.storage.local.get(['editorState']);
      const state = editorState || {};
      state.open = !!isOpen;
      await chrome.storage.local.set({ editorState: state });
    } catch (_) {}
  }

  // Save the current editor draft (title/content/tags) into storage
  async saveEditorDraft() {
    try {
      if (!this.currentNote) return;
      const titleHeader = document.getElementById('noteTitleHeader');
      const contentInput = document.getElementById('noteContentInput');
      const tagsInput = document.getElementById('tagsInput');

      // Capture caret in content area
      let caretStart = 0, caretEnd = 0;
      try {
        if (contentInput) {
          const pos = this.getSelectionOffsets(contentInput);
          caretStart = pos.start;
          caretEnd = pos.end;
        }
      } catch (_) {}

      const draft = {
        id: this.currentNote.id,
        title: (titleHeader && titleHeader.value) || '',
        content: this.htmlToMarkdown(contentInput ? contentInput.innerHTML : ''),
        tags: (tagsInput && tagsInput.value
          ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
          : []),
        createdAt: this.currentNote.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        domain: this.currentNote.domain || (this.currentSite && this.currentSite.domain),
        url: (this.currentSite && this.currentSite.url) || this.currentNote.url,
        pageTitle: (this.currentSite && this.currentSite.title) || this.currentNote.pageTitle,
        caretStart,
        caretEnd
      };

      await chrome.storage.local.set({ editorState: { open: true, noteDraft: draft } });
    } catch (_) { }
  }

  // Clear editor state entirely
  async clearEditorState() {
    try {
      await chrome.storage.local.remove('editorState');
    } catch (_) { }
  }

  // Delete all notes for a specific domain
  async deleteNotesByDomain(domain, confirmed = false) {
    if (!confirmed) {
      const notesForDomainCount = this.allNotes.filter(note => note.domain === domain).length;
      const userConfirmed = await this.dialog.show(`Are you sure you want to delete all ${notesForDomainCount} notes for ${domain}? This cannot be undone.`);
      if (!userConfirmed) return;
    }

    // Remove from storage by removing the domain key
    await chrome.storage.local.remove(domain);

    // Remove from master list in memory
    this.allNotes = this.allNotes.filter(note => note.domain !== domain);

    await this.postDeleteRefresh();
    this.showToast(`Deleted all notes for ${domain}`);
  }

  // After any deletion, optionally clear the search if it would show an empty list, then render
  async postDeleteRefresh() {
    // Compute what would be visible with current filter + search
    let filtered = [];
    if (this.filterMode === 'site') {
      filtered = this.allNotes.filter(n => n.domain === (this.currentSite && this.currentSite.domain));
    } else if (this.filterMode === 'page') {
      const currentKey = this.currentSite ? this.normalizePageKey(this.currentSite.url) : '';
      filtered = this.allNotes.filter(n => this.normalizePageKey(n.url) === currentKey);
    } else {
      filtered = this.allNotes;
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.map(n => {
        let score = 0;
        if (n.domain && n.domain.toLowerCase().includes(q)) score += 4;
        if ((n.title || '').toLowerCase().includes(q)) score += 3;
        if ((n.tags || []).some(tag => (tag || '').toLowerCase().includes(q))) score += 2;
        if ((n.content || '').toLowerCase().includes(q)) score += 1;
        return { n, score };
      }).filter(it => it.score > 0).map(it => it.n);
    }

    if (this.searchQuery && filtered.length === 0) {
      // Clear query and input field
      this.searchQuery = '';
      const input = document.getElementById('searchInput') || document.querySelector('.search-input');
      if (input) input.value = '';
    }

    this.render();
  }

  // Update note preview while typing
  updateNotePreview() {
    // This could be used for real-time preview features
  }

  // Update character count
  updateCharCount() {
    const contentInput = document.getElementById('noteContentInput');
    const charCount = document.getElementById('noteChars');
    const count = (contentInput.innerText || '').length;
    if (charCount) charCount.textContent = `${count} characters`;
  }

  // Font settings management
  async saveFontSetting(fontName) {
    await chrome.storage.local.set({ editorFont: fontName });
    this.applyFont(fontName);
    this.showToast(`Font set to ${fontName}`);
  }

  async loadFontSetting() {
    const { editorFont } = await chrome.storage.local.get(['editorFont']);
    const fontToApply = editorFont || 'Default'; // Default to 'Default'
    document.getElementById('fontSelector').value = fontToApply;
    const sizeSlider = document.getElementById('fontSizeSlider');
    const initialSize = sizeSlider ? sizeSlider.value : undefined;
    this.applyFont(fontToApply, initialSize);
  }

  applyFont(font, size) {
    const editor = document.getElementById('noteContentInput');
    const noteTitleHeader = document.getElementById('noteTitleHeader');
    const tagsInput = document.getElementById('tagsInput');
    const sizeSlider = document.getElementById('fontSizeSlider');
    
    const fontFamily = font === 'Default' 
      ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      : font;

    [editor, noteTitleHeader, tagsInput].forEach(el => {
      if (el) {
        el.style.fontFamily = fontFamily;
        const sizeToUse = size || (sizeSlider ? sizeSlider.value : null);
        if (sizeToUse) {
          el.style.fontSize = `${sizeToUse}px`;
        }
      }
    });
  }

  // AI Rewrite (placeholder)
  aiRewrite() {
    this.showToast('AI Rewrite coming soon!');
  }

  updatePremiumUI() {
    const allNotesBtn = document.getElementById('showAllNotesBtn');
    if (!this.premiumStatus.isPremium) {
      allNotesBtn.classList.add('premium-feature');
      allNotesBtn.disabled = true;
      allNotesBtn.title = 'This is a premium feature.';
    }
  }

  // Open settings
  openSettings() {
    const settingsPanel = document.getElementById('settingsPanel');
    settingsPanel.style.display = 'flex';
    settingsPanel.classList.add('slide-in');
  }

  // Close settings
  closeSettings() {
    const settingsPanel = document.getElementById('settingsPanel');
    settingsPanel.classList.add('slide-out');
    setTimeout(() => {
      settingsPanel.style.display = 'none';
      settingsPanel.classList.remove('slide-in', 'slide-out');
    }, 300);
  }

  // Export all notes to a JSON file
  async exportNotes() {
    try {
      const allData = await chrome.storage.local.get(null);
      const notesData = {};
      for (const key in allData) {
        if (key !== 'themeMode' && key !== 'editorFont') { // Exclude settings
          notesData[key] = allData[key];
        }
      }

      const blob = new Blob([JSON.stringify(notesData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `url-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Notes exported successfully');
    } catch (error) {
      console.error('Error exporting notes:', error);
      this.showToast('Failed to export notes');
    }
  }

  // Import notes from a JSON file
  async importNotes(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        const currentData = await chrome.storage.local.get(null);
        let notesImportedCount = 0;

        // Merge data, imported notes will overwrite existing notes with the same ID
        for (const domain in importedData) {
          if (domain === 'themeMode' || !Array.isArray(importedData[domain])) continue;
          
          const existingNotes = currentData[domain] || [];
          const importedNotes = importedData[domain];
          const notesMap = new Map(existingNotes.map(note => [note.id, note]));
          
          importedNotes.forEach(note => {
            if (note && note.id) { // Basic validation
              notesMap.set(note.id, note);
              notesImportedCount++;
            }
          });

          currentData[domain] = Array.from(notesMap.values());
        }

        await chrome.storage.local.set(currentData);
        await this.loadNotes(); // Reload all notes into memory
        this.render();
        this.showToast(`${notesImportedCount} notes imported successfully`);

      } catch (error) {
        console.error('Error importing notes:', error);
        this.showToast('Failed to import notes. Invalid file format.');
      }
    };
    reader.readAsText(file);
  }

  // Helper to format dates
  formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  // Generate a unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // Show a toast notification
  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Check storage quota
  // Debounce utility
  debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  async checkStorageQuota() {
    const usage = await navigator.storage.estimate();
    const quota = usage.quota;
    const usageInMB = (usage.usage / (1024 * 1024)).toFixed(2);
    const quotaInMB = (quota / (1024 * 1024)).toFixed(2);
    const percentage = ((usage.usage / quota) * 100).toFixed(1);

    const storageBar = document.getElementById('storageUsageBar');
    const storageText = document.getElementById('storageUsageText');

    if (storageBar && storageText) {
      storageBar.style.width = `${percentage}%`;
      storageText.textContent = `${usageInMB} MB / ${quotaInMB} MB (${percentage}%)`;
      
      if (percentage > 90) {
        storageBar.style.backgroundColor = 'var(--color-danger)';
      } else if (percentage > 70) {
        storageBar.style.backgroundColor = 'var(--color-warning)';
      } else {
        storageBar.style.backgroundColor = 'var(--accent-primary)';
      }
    }
  }
}

// Mock premium status function (replace with actual logic)
async function getPremiumStatus() {
  return { isPremium: true };
}

document.addEventListener('DOMContentLoaded', () => {
  new URLNotesApp();
});
