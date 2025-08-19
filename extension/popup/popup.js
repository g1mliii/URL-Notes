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
    
    this.init();
  }

  // Derive accent color from favicon (with safe fallbacks)
  async applyAccentFromFavicon() {
    try {
      const accent = await this.deriveAccentColor(this.currentSite?.favicon, this.currentSite?.domain);
      this.setAccentVariables(accent);
    } catch (e) {
      console.warn('Accent derivation failed, using fallback:', e);
      const fallback = this.hashDomainToAccent(this.currentSite?.domain || 'local');
      this.setAccentVariables(fallback);
    }
  }

  async deriveAccentColor(faviconUrl, domain) {
    // If no favicon, fallback to hash-based accent
    if (!faviconUrl) {
      return this.hashDomainToAccent(domain || 'local');
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
      const accent = {
        h,
        s: Math.max(0.45, Math.min(0.88, s * 1.1)),
        l: Math.max(0.35, Math.min(0.6, l)),
      };
      return accent;
    } catch (err) {
      // Canvas tainted or other error — fallback
      return this.hashDomainToAccent(domain || 'local');
    }
  }

  hashDomainToAccent(domain) {
    // Produce a stable hue from domain; bias near blue range
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
    }
    const baseHue = 210; // blue
    const spread = 80;   // +/- 40 degrees range
    const h = (baseHue - 40) + (hash % spread); // 170..250
    return { h, s: 0.75, l: 0.5 };
  }

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

  async init() {
    this.premiumStatus = await getPremiumStatus();
    await this.loadCurrentSite();
    this.setupEventListeners();
    await this.setupThemeDetection();
    await this.applyAccentFromFavicon();
    await this.loadNotes();
    await this.loadFontSetting();
    this.checkStorageQuota();
    this.render();
    this.updatePremiumUI();
    this.checkStorageQuota();
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

  // Get current tab information
  async loadCurrentSite() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const url = new URL(tab.url);
        this.currentSite = {
          domain: url.hostname,
          url: tab.url,
          title: tab.title,
          favicon: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`
        };
        
        // Update site icon with real favicon
        const siteIcon = document.querySelector('.site-icon');
        if (this.currentSite.favicon) {
          // Fill the icon container with the favicon (no bubble chrome)
          siteIcon.innerHTML = `<img src="${this.currentSite.favicon}" alt="Site favicon">`;
        } else {
          // Subtle fallback: neutral rounded square with a small globe icon
          siteIcon.innerHTML = `
            <div class="site-fallback" aria-label="No favicon available">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M3 12h18"></path>
                <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z"></path>
              </svg>
            </div>`;
        }
        
        // Update UI
        document.getElementById('siteDomain').textContent = this.currentSite.domain;
        document.getElementById('siteUrl').textContent = this.currentSite.url;
        // Provide tooltips for truncated values
        const siteDomainEl = document.getElementById('siteDomain');
        const siteUrlEl = document.getElementById('siteUrl');
        if (siteDomainEl) siteDomainEl.title = this.currentSite.domain;
        if (siteUrlEl) siteUrlEl.title = this.currentSite.url;
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
    document.getElementById('backBtn').addEventListener('click', () => {
      this.closeEditor();
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
    });
    
    const contentInput = document.getElementById('noteContentInput');
    contentInput.addEventListener('input', () => {
      this.updateNotePreview();
      this.updateCharCount();
    });
    
    // Handle Obsidian-like editor behavior
    contentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const value = e.target.value;
        e.target.value = value.substring(0, start) + '  ' + value.substring(end);
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      } else if (e.key === 'Enter') {
        const start = e.target.selectionStart;
        const value = e.target.value;
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.substring(lineStart, start);
        
        // Auto-indent: match the indentation of the current line
        const indent = currentLine.match(/^\s*/)[0];
        
        // Check for list items and auto-continue
        const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s/);
        if (listMatch) {
          e.preventDefault();
          const [, spaces, bullet] = listMatch;
          let newBullet = bullet;
          if (/\d+\./.test(bullet)) {
            const num = parseInt(bullet) + 1;
            newBullet = `${num}.`;
          }
          const insertion = `\n${spaces}${newBullet} `;
          e.target.value = value.substring(0, start) + insertion + value.substring(start);
          e.target.selectionStart = e.target.selectionEnd = start + insertion.length;
        } else if (indent) {
          e.preventDefault();
          const insertion = `\n${indent}`;
          e.target.value = value.substring(0, start) + insertion + value.substring(start);
          e.target.selectionStart = e.target.selectionEnd = start + insertion.length;
        }
      }
    });
    
    document.getElementById('tagsInput').addEventListener('input', () => {
      this.updateNotePreview();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.initSettings();
    });

    document.getElementById('settingsBackBtn').addEventListener('click', () => {
      this.closeSettings();
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

    settingsBtn.addEventListener('click', () => {
      settingsPanel.style.display = 'flex';
    });

    settingsBackBtn.addEventListener('click', () => {
      // On close, apply current settings to the editor
      const fontName = fontSelector.value;
      const size = fontSizeSlider.value;
      this.applyFont(fontName, size);
      settingsPanel.style.display = 'none';
    });

    // Font controls
    fontSelector.addEventListener('change', (e) => {
      const fontName = e.target.value;
      const size = fontSizeSlider.value;
      // Do not apply to editor while settings is open; preview only
      updateFontPreview(fontName, size);
      chrome.storage.sync.set({ editorFont: fontName });
    });

    fontSizeSlider.addEventListener('input', (e) => {
      const size = e.target.value;
      const fontName = fontSelector.value;
      // Do not apply to editor while settings is open; preview only
      updateFontPreview(fontName, size);
      chrome.storage.sync.set({ editorFontSize: size });
    });

    // Load saved font settings
    chrome.storage.sync.get(['editorFont', 'editorFontSize'], ({ editorFont, editorFontSize }) => {
      // Normalize legacy 'System' to 'Default'
      const normalizedFont = editorFont === 'System' ? 'Default' : (editorFont || 'Default');
      fontSelector.value = normalizedFont;
      if (editorFont === 'System') {
        chrome.storage.sync.set({ editorFont: 'Default' });
      }
      const sizeToUse = editorFontSize || fontSizeSlider.value || '14';
      fontSizeSlider.value = sizeToUse;
      this.applyFont(fontSelector.value, sizeToUse);
      updateFontPreview(fontSelector.value, sizeToUse);
    });

    // Export/Import functionality
    exportNotesBtn.addEventListener('click', () => this.exportNotes());
    importNotesBtn.addEventListener('click', () => importNotesInput.click());
    importNotesInput.addEventListener('change', (e) => this.importNotes(e));
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
  switchFilter(filter) {
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
      filteredNotes = this.allNotes.filter(note => note.url === this.currentSite.url);
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
      
      const tagsHtml = domainTags.length > 0 ? `
        <div class="domain-tags">
          ${domainTags.map(tag => `<span class="note-tag">${tag}</span>`).join('')}
        </div>
      ` : '';

      const domainGroup = document.createElement('details');
      domainGroup.className = 'domain-group';
      // Expand top two results only when searching
      const domainIndex = sortedDomains.indexOf(domain);
      domainGroup.open = this.searchQuery && domainIndex < 2;
      
      domainGroup.innerHTML = `
        <summary class="domain-group-header">
          <div class="domain-header-info">
            <span>${domain} (${domainNotes.length})</span>
            ${tagsHtml}
          </div>
          <div class="domain-actions">
            <button class="delete-domain-btn" data-domain="${domain}" title="Delete all notes for this domain">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </summary>
        <div class="domain-notes-list"></div>
      `;
      
      const deleteDomainBtn = domainGroup.querySelector('.delete-domain-btn');
      const actionsContainer = domainGroup.querySelector('.domain-actions');
      const domainNotesList = domainGroup.querySelector('.domain-notes-list');

      deleteDomainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.showInlineConfirm(actionsContainer, () => {
          this.deleteNotesByDomain(domain, true);
        });
      });

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
      `<div class="note-tags">
        ${note.tags.map(tag => `<span class="note-tag">${tag}</span>`).join('')}
      </div>` : '';
    
    const pageIndicator = (this.filterMode !== 'page' && note.url === this.currentSite.url) ? 
      '<span class="page-indicator" data-tooltip="Current page note">•</span>' : '';

    noteDiv.innerHTML = `
      <div class="note-item-header">
        <div class="note-title">${pageIndicator}${note.title || 'Untitled'}</div>
        <div class="note-date">${this.formatDate(note.updatedAt)}</div>
        <button class="note-delete-btn" data-note-id="${note.id}" title="Delete note">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="m19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
          </svg>
        </button>
      </div>
      <div class="note-preview">${preview}</div>
      ${tagsHtml}
    `;
    
    // Add delete button event listener
    const deleteBtn = noteDiv.querySelector('.note-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent opening the note
      this.showInlineConfirm(noteDiv, () => {
        this.deleteNoteFromList(note.id, true);
      });
    });

    return noteDiv;
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

      // Replace markdown links with anchors
      const mdLink = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
      let replaced = '';
      let lastIndex = 0;
      let match;
      while ((match = mdLink.exec(line)) !== null) {
        // Append escaped text before the match
        replaced += escapeHtml(line.slice(lastIndex, match.index));
        const text = escapeHtml(match[1]);
        const href = match[2];
        replaced += `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
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
    contentInput.value = this.currentNote.content;
    tagsInput.value = this.currentNote.tags.join(', ');
    dateSpan.textContent = `Created ${this.formatDate(this.currentNote.createdAt)}`;

    // Show premium features
    if (this.premiumStatus.isPremium) {
      aiRewriteBtn.style.display = 'flex';
    } else {
      aiRewriteBtn.style.display = 'none';
    }

    // Show editor with animation
    editor.style.display = 'flex';
    editor.classList.add('slide-in');
    
    // Focus appropriately
    setTimeout(() => {
      if (focusContent || this.isJotMode) {
        contentInput.focus();
      } else {
        titleHeader.focus();
      }
    }, 100);
    
    this.updateCharCount();
  }

  // Close the note editor
  closeEditor() {
    const editor = document.getElementById('noteEditor');
    editor.classList.add('slide-out');
    
    setTimeout(() => {
      editor.style.display = 'none';
      editor.classList.remove('slide-in', 'slide-out');
      this.currentNote = null;
    }, 300);
  }

  // Save current note
  async saveCurrentNote(isAutosave = false) {
    if (!this.currentNote) {
      this.showToast('No note open to save');
      return;
    }

    const titleHeader = document.getElementById('noteTitleHeader');
    const contentInput = document.getElementById('noteContentInput');
    const tagsInput = document.getElementById('tagsInput');

    // Update note data
    this.currentNote.title = titleHeader.value.trim();
    this.currentNote.content = contentInput.value.trim();
    this.currentNote.tags = tagsInput.value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    this.currentNote.updatedAt = new Date().toISOString();
      
    // Update URL and page title for current context
    this.currentNote.url = this.currentSite.url;
    this.currentNote.pageTitle = this.currentSite.title;

    // Don't save empty notes
    if (!this.currentNote.title && !this.currentNote.content) {
      this.closeEditor();
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

    this.showToast('Note saved!');
    this.closeEditor();

    // Re-render from memory
    this.render();
    this.checkStorageQuota();
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
    this.closeEditor();
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
      filtered = this.allNotes.filter(n => n.url === (this.currentSite && this.currentSite.url));
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

  updateCharCount() {
    const contentInput = document.getElementById('noteContentInput');
    const charCount = document.getElementById('noteChars');
    const count = contentInput.value.length;
    charCount.textContent = `${count} characters`;
  }

  // Update UI based on premium status
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
