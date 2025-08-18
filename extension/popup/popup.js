// URL Notes Extension - Popup Script
class URLNotesApp {
  constructor() {
    this.filterMode = 'all'; // 'all' or 'page'
    this.currentSite = null;
    this.notes = [];
    this.currentNote = null;
    this.searchQuery = '';
    this.isJotMode = false;
    
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
    await this.loadCurrentSite();
    this.setupEventListeners();
    await this.setupThemeDetection();
    await this.applyAccentFromFavicon();
    await this.loadNotes();
    this.render();
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
      this.switchFilter('all');
    });
    
    document.getElementById('showPageBtn').addEventListener('click', () => {
      this.switchFilter('page');
    });

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render();
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
      this.openSettings();
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

  // Switch between all notes and page-specific filter
  switchFilter(filter) {
    this.filterMode = filter;
    
    // Update filter UI
    document.querySelectorAll('.filter-option').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(filter === 'all' ? 'showAllBtn' : 'showPageBtn').classList.add('active');
    
    // Title stays constant per Option A: always "Notes"
    document.getElementById('notesTitle').textContent = 'Notes';
    
    // Re-render with filter
    this.render();
  }

  // Load notes from storage (hybrid - load all domain notes)
  async loadNotes() {
    try {
      const domainKey = this.currentSite.domain;
      const result = await chrome.storage.local.get([domainKey]);
      this.notes = result[domainKey] || [];
      this.render();
    } catch (error) {
      console.error('Error loading notes:', error);
      this.notes = [];
    }
  }

  // Save notes to storage (hybrid - always save to domain)
  async saveNotes() {
    try {
      const domainKey = this.currentSite.domain;
      await chrome.storage.local.set({ [domainKey]: this.notes });
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  }

  // Filter notes based on search query and page filter
  getFilteredNotes() {
    let filtered = this.notes;
    
    // Apply page filter
    if (this.filterMode === 'page') {
      filtered = filtered.filter(note => note.url === this.currentSite.url);
    }
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(note => 
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    return filtered;
  }

  // Render the notes list
  render() {
    const notesList = document.getElementById('notesList');
    let emptyState = document.getElementById('emptyState');
    const filteredNotes = this.getFilteredNotes();

    if (filteredNotes.length === 0) {
      // Create empty state if it was removed on previous renders
      if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.id = 'emptyState';
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
          </div>
          <h4>No notes yet</h4>
          <p>Create your first note for this site</p>
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
      
      filteredNotes.forEach(note => {
        const noteElement = this.createNoteElement(note);
        notesList.appendChild(noteElement);
      });
    }
  }

  // Create a note element
  createNoteElement(note) {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'note-item';
    noteDiv.addEventListener('click', () => this.openNote(note));

    const preview = note.content.length > 100 ? 
      note.content.substring(0, 100) + '...' : note.content;

    const tagsHtml = (note.tags && note.tags.length > 0) ? 
      `<div class="note-tags">
        ${note.tags.map(tag => `<span class="note-tag">${tag}</span>`).join('')}
      </div>` : '';
    
    const pageIndicator = (this.filterMode === 'all' && note.url === this.currentSite.url) ? 
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
      this.deleteNoteFromList(note.id);
    });

    return noteDiv;
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

    // Populate editor with note data
    titleHeader.value = this.currentNote.title;
    contentInput.value = this.currentNote.content;
    tagsInput.value = this.currentNote.tags.join(', ');
    dateSpan.textContent = `Created ${this.formatDate(this.currentNote.createdAt)}`;

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
  async saveCurrentNote() {
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

    // Add to notes array if it's a new note
    const existingIndex = this.notes.findIndex(note => note.id === this.currentNote.id);
    if (existingIndex >= 0) {
      this.notes[existingIndex] = this.currentNote;
    } else {
      this.notes.unshift(this.currentNote);
    }

    // Save to storage
    await this.saveNotes();
    
    // Update UI
    this.render();
    this.closeEditor();
    
    // Show save feedback
    this.showToast('Note saved');
  }

  // Delete current note (from editor)
  async deleteCurrentNote() {
    if (!this.currentNote) {
      this.showToast('No note to delete');
      return;
    }

    const noteIndex = this.notes.findIndex(note => note.id === this.currentNote.id);
    if (noteIndex >= 0) {
      this.notes.splice(noteIndex, 1);
      await this.saveNotes();
      this.showToast('Note deleted');
      this.closeEditor();
    }
  }
  
  // Delete note from list (with confirmation)
  async deleteNoteFromList(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;
    
    // Simple confirmation
    if (!confirm(`Delete "${note.title || 'Untitled'}"?`)) {
      return;
    }
    
    const noteIndex = this.notes.findIndex(n => n.id === noteId);
    if (noteIndex >= 0) {
      this.notes.splice(noteIndex, 1);
      await this.saveNotes();
      this.render();
      this.showToast('Note deleted');
    }
  }

  // Update note preview while typing
  updateNotePreview() {
    // This could be used for real-time preview features
  }

  // Update character count
  updateCharCount() {
    const contentInput = document.getElementById('noteContentInput');
    const charCount = document.getElementById('noteChars');
    const count = contentInput.value.length;
    charCount.textContent = `${count} characters`;
  }

  // Open settings (placeholder)
  openSettings() {
    // This will open settings panel in future versions
    this.showToast('Settings coming soon');
  }

  // Utility functions
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  showToast(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-overlay);
      color: var(--text-primary);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      z-index: 1000;
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px var(--shadow-dark);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2000);
  }
}

  // Initialize the app when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    // Expose globally for debugging/tests in popup console
    window.app = new URLNotesApp();
  });
