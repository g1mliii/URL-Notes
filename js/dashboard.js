// Dashboard Module - Notes Display and Organization System
class Dashboard {
  constructor() {
    this.notes = [];
    this.filteredNotes = [];
    this.selectedNotes = new Set();
    this.currentFilter = {
      domain: '',
      dateRange: '',
      search: ''
    };
    this.isLoading = false;
    this.currentNote = null;
    this.richTextEditor = null; // Initialize rich text editor reference
    this.init();
  }

  async init() {
    // Listen for auth state changes instead of doing separate auth check
    window.eventBus.on('auth:stateChanged', (authData) => {
      if (authData.isAuthenticated && authData.currentUser) {
        // Auth state confirmed, proceed with initialization
        this.initializeAfterAuth();
      }
    });

    // Check if auth state is already available
    if (window.authState?.isAuthenticated || (window.app?.isAuthenticated && window.app?.currentUser)) {
      this.initializeAfterAuth();
    }
  }

  async initializeAfterAuth() {
    try {
      // Initialize storage first
      await this.initializeStorage();

      this.setupEventListeners();
      await this.loadNotes();

      // Use centralized subscription check instead of separate call
      this.listenForSubscriptionUpdates();

      // Initialize rich text editor if elements are available
      this.initializeRichTextEditor();
    } catch (error) {
      console.error('Dashboard initialization error:', error);
      this.showErrorState('Failed to initialize dashboard');
    }
  }

  initializeRichTextEditor() {
    // This will be called when the editor elements are available
    // The actual initialization happens in populateNoteEditForm
    if (window.RichTextEditor) {
      // Rich text editor class is available
      console.log('Rich text editor available');
    } else {
      console.warn('Rich text editor not available');
    }
  }

  async initializeStorage() {
    // Use Promise.all for parallel module waiting instead of sequential polling
    const modulePromises = [
      this.waitForModule('storage'),
      this.waitForModule('api'),
      this.waitForModule('noteEncryption')
    ];

    try {
      const [storage, api, encryption] = await Promise.all(modulePromises);

      // Modules are ready, skip redundant initialization since app.js already handled it
      if (!window.api.accessToken && window.api.init) {
        await window.api.init();
      }

      if (window.storage.init && !window.storage._initialized) {
        await window.storage.init();
        window.storage._initialized = true; // Prevent duplicate initialization
      }
    } catch (error) {
      // Module initialization failed - check if it's incognito mode
      const isIncognito = this.detectIncognitoMode();
      if (isIncognito) {
        // Handle incognito mode gracefully
        throw new Error('Incognito mode detected - some features may be limited');
      } else {
        throw new Error('Required modules not available');
      }
    }
  }

  // Detect incognito mode
  detectIncognitoMode() {
    try {
      // Test localStorage access
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return false;
    } catch (e) {
      return true;
    }
  }

  // Helper method to wait for a specific module with timeout
  async waitForModule(moduleName, timeout = 2000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkModule = () => {
        if (window[moduleName]) {
          resolve(window[moduleName]);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`${moduleName} module not available after ${timeout}ms`));
        } else {
          setTimeout(checkModule, 50);
        }
      };

      checkModule();
    });
  }

  setupEventListeners() {
    // Optimized search functionality with better debouncing
    this.setupOptimizedSearch();

    // Filter functionality
    const domainFilter = document.getElementById('domainFilter');
    if (domainFilter) {
      domainFilter.addEventListener('change', (e) => this.handleDomainFilter(e.target.value));
    }

    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => this.handleDateFilter(e.target.value));
    }

    // New note button
    const newNoteBtn = document.getElementById('newNoteBtn');
    if (newNoteBtn) {
      newNoteBtn.addEventListener('click', () => this.showNoteEditor());
    }

    // Refresh notes button
    const refreshNotesBtn = document.getElementById('refreshNotesBtn');
    if (refreshNotesBtn) {
      refreshNotesBtn.addEventListener('click', () => this.handleRefreshNotes());
    }

    // Cleanup button
    const cleanupBtn = document.getElementById('cleanupBtn');
    if (cleanupBtn) {
      cleanupBtn.addEventListener('click', () => this.handleManualCleanup());
    }

    // Export/Import buttons
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.showExportModal());
    }

    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.showImportModal());
    }

    // Import modal event listeners
    this.setupImportModalListeners();

    // Panel close handlers
    const closePanel = document.getElementById('closePanel');
    if (closePanel) {
      closePanel.addEventListener('click', () => this.closeNotePanel());
    }

    const closeExportModal = document.getElementById('closeExportModal');
    if (closeExportModal) {
      closeExportModal.addEventListener('click', () => window.app.hideModal('exportModal'));
    }

    const closeImportModal = document.getElementById('closeImportModal');
    if (closeImportModal) {
      closeImportModal.addEventListener('click', () => window.app.hideModal('importModal'));
    }

    // Panel action buttons
    const editNoteBtn = document.getElementById('editNoteBtn');
    if (editNoteBtn) {
      editNoteBtn.addEventListener('click', () => this.showNoteEditMode());
    }

    const deleteNotePanelBtn = document.getElementById('deleteNotePanelBtn');
    if (deleteNotePanelBtn) {
      deleteNotePanelBtn.addEventListener('click', () => this.handleNoteDelete());
    }

    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => this.cancelNoteEdit());
    }

    // Note form submission
    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
      noteForm.addEventListener('submit', (e) => this.handleNoteSave(e));
    }

    // Handle clicks on links in note content (both display and edit modes)
    document.addEventListener('click', (e) => {
      if (e.target.matches('.note-content-display a, #noteContentInput a')) {
        e.preventDefault();
        e.stopPropagation(); // Prevent contenteditable from handling the click
        const href = e.target.getAttribute('href');
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    });

    // Close panel on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const panel = document.getElementById('notePanel');
        if (panel && !panel.classList.contains('hidden')) {
          this.closeNotePanel();
        }
      }
    });

    // Auto-save functionality
    this.setupAutoSave();

    // Handle page unload to save drafts
    window.addEventListener('beforeunload', () => {
      this.handlePageUnload();
    });

    // Setup contenteditable link handling
    this.setupContentEditableLinkHandling();

    // Selection functionality
    this.setupSelectionListeners();
  }

  // Optimized search with better performance
  setupOptimizedSearch() {
    const searchInputs = ['mainSearchInput', 'searchInput'];
    let searchTimeout;

    // Single debounced handler for all search inputs
    const debouncedSearch = (value) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        // Use requestAnimationFrame for smooth UI updates
        requestAnimationFrame(() => {
          this.handleSearch(value);
        });
      }, 150); // Reduced debounce time for better responsiveness
    };

    searchInputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.addEventListener('input', (e) => {
          debouncedSearch(e.target.value);
        }, { passive: true });
      }
    });
  }

  setupContentEditableLinkHandling() {
    // Add specific handling for links in contenteditable areas
    const noteContentInput = document.getElementById('noteContentInput');
    if (noteContentInput) {
      // Remove any existing listeners to prevent duplicates
      if (noteContentInput._linkHandlersAdded) {
        return;
      }

      // Prevent default link behavior in contenteditable and handle manually
      const clickHandler = (e) => {
        if (e.target.tagName === 'A' && e.target.href) {
          e.preventDefault();
          e.stopPropagation();

          // Open link in new tab
          window.open(e.target.href, '_blank', 'noopener,noreferrer');

          // Prevent cursor positioning in contenteditable
          return false;
        }
      };

      const mousedownHandler = (e) => {
        if (e.target.tagName === 'A' && e.target.href) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };

      noteContentInput.addEventListener('click', clickHandler, true);
      noteContentInput.addEventListener('mousedown', mousedownHandler, true);

      // Mark that handlers have been added
      noteContentInput._linkHandlersAdded = true;
    }
  }

  setupContentEditableLinksForCurrentContent() {
    // This method ensures that any dynamically added links in the contenteditable area
    // are properly handled. Since we're using event delegation on the parent element,
    // this is mainly for ensuring the content is properly set up.
    const noteContentInput = document.getElementById('noteContentInput');
    if (noteContentInput) {
      // Make sure all links have proper attributes for external opening
      const links = noteContentInput.querySelectorAll('a[href]');
      links.forEach(link => {
        // Ensure links have proper target and rel attributes
        if (!link.hasAttribute('target')) {
          link.setAttribute('target', '_blank');
        }
        if (!link.hasAttribute('rel')) {
          link.setAttribute('rel', 'noopener noreferrer');
        }

        // Add a visual indicator that these are clickable links
        link.style.cursor = 'pointer';
        link.title = `Click to open: ${link.href}`;
      });
    }
  }

  setupSelectionListeners() {
    // Select all button
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => this.selectAllNotes());
    }

    // Deselect all button
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => this.deselectAllNotes());
    }

    // Bulk delete button
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', () => this.handleBulkDelete());
    }

    // Bulk export button
    const bulkExportBtn = document.getElementById('bulkExportBtn');
    if (bulkExportBtn) {
      bulkExportBtn.addEventListener('click', () => this.handleBulkExport());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + A to select all (when not in input field)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        this.selectAllNotes();
      }

      // Escape to deselect all
      if (e.key === 'Escape' && this.selectedNotes.size > 0) {
        this.deselectAllNotes();
      }

      // Delete key to delete selected notes
      if (e.key === 'Delete' && this.selectedNotes.size > 0 && !e.target.matches('input, textarea')) {
        e.preventDefault();
        this.handleBulkDelete();
      }
    });
  }

  setupAutoSave() {
    // Optimized auto-save with longer intervals to reduce API calls
    const autoSaveElements = [
      { id: 'noteTitle', event: 'blur' },
      { id: 'noteContent', event: 'input', throttle: 5000 }, // Increased from 2s to 5s
      { id: 'noteContent', event: 'blur' },
      { id: 'noteUrl', event: 'blur' }
    ];

    let autoSaveTimeout;
    let lastAutoSave = 0;
    let pendingChanges = false;

    const throttledAutoSave = () => {
      const now = Date.now();
      if (now - lastAutoSave > 3000) { // Minimum 3 seconds between auto-saves (increased from 1s)
        lastAutoSave = now;
        pendingChanges = false;

        // Use requestIdleCallback for non-critical auto-saves
        if (window.requestIdleCallback) {
          requestIdleCallback(() => this.handleAutoSave());
        } else {
          setTimeout(() => this.handleAutoSave(), 0);
        }
      } else {
        pendingChanges = true; // Mark that we have pending changes
      }
    };

    const debouncedAutoSave = () => {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(throttledAutoSave, 5000); // Increased from 2s to 5s
    };

    // Save pending changes before page unload
    window.addEventListener('beforeunload', () => {
      if (pendingChanges) {
        this.handleAutoSave(); // Force save pending changes
      }
    });

    autoSaveElements.forEach(({ id, event, throttle }) => {
      const element = document.getElementById(id);
      if (element) {
        if (event === 'input' && throttle) {
          element.addEventListener('input', debouncedAutoSave, { passive: true });
        } else {
          element.addEventListener(event, throttledAutoSave, { passive: true });
        }
      }
    });
  }

  async handleAutoSave() {
    // Only auto-save if modal is open and we have content
    const modal = document.getElementById('noteModal');
    if (!modal || modal.classList.contains('hidden')) {
      return;
    }

    const noteTitle = document.getElementById('noteTitle');
    const noteContent = document.getElementById('noteContent');
    const noteUrl = document.getElementById('noteUrl');

    const title = noteTitle?.value.trim() || '';
    const content = noteContent?.value.trim() || '';
    const url = noteUrl?.value.trim() || '';

    // Only auto-save if there's actual content
    if (!title && !content) {
      return;
    }

    try {
      const noteData = {
        title: title || 'Untitled Note',
        content: content,
        url: url || 'chrome://extensions',
        domain: url ? this.extractDomain(url) : 'general',
        tags: [],
        updated_at: new Date().toISOString()
      };

      if (this.currentNote) {
        // Update existing note
        noteData.id = this.currentNote.id;
        noteData.createdAt = this.currentNote.createdAt;

        // Update in local array
        const index = this.notes.findIndex(n => n.id === this.currentNote.id);
        if (index !== -1) {
          this.notes[index] = { ...this.notes[index], ...this.processNotes([noteData])[0] };
        }
      } else {
        // Create new note for auto-save
        noteData.id = this.generateId();
        noteData.createdAt = noteData.updatedAt;
        this.currentNote = noteData;

        // Add to local array
        this.notes.unshift(this.processNotes([noteData])[0]);

        // Update delete button visibility
        const deleteBtn = document.getElementById('deleteNoteBtn');
        if (deleteBtn) {
          deleteBtn.style.display = 'inline-flex';
        }
      }

      // Sync to cloud silently
      await this.syncNoteToCloud(noteData);

      // Show subtle auto-save indicator
      this.showAutoSaveIndicator();

      // Refresh display silently
      this.populateDomainFilter();
      this.applyFilters();

    } catch (error) {
      // Auto-save failed
      // Don't show error notification for auto-save failures
    }
  }

  showAutoSaveIndicator() {
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) {
      const originalText = modalTitle.textContent;
      modalTitle.textContent = 'Saved';
      modalTitle.style.color = 'var(--success-color)';

      setTimeout(() => {
        modalTitle.textContent = originalText;
        modalTitle.style.color = '';
      }, 1000);
    }
  }

  handlePageUnload() {
    // Attempt to save any unsaved changes before page unload
    const modal = document.getElementById('noteModal');
    if (modal && !modal.classList.contains('hidden')) {
      this.handleAutoSave();
    }
  }

  async loadNotes() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoadingState();

    try {
      // Validate session before making API calls (especially important on mobile)
      if (window.api && !window.api.isAuthenticated()) {
        throw new Error('Authentication required');
      }

      // For mobile, validate token freshness before API calls
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile && window.api) {
        try {
          // Quick token validation
          const isValid = await window.api.verifyToken();
          if (!isValid) {
            // Try to refresh token once
            await window.api.refreshSession();
          }
        } catch (e) {
          // Token validation/refresh failed, redirect to login
          window.location.href = '/?message=session-expired';
          return;
        }
      }

      // Fetch notes from API
      const fetchedNotes = await window.api.fetchNotes();

      // Process and organize notes
      this.notes = this.processNotes(fetchedNotes);
      this.populateDomainFilter();
      this.applyFilters();

      // Trigger cleanup of old deleted notes (async, don't wait)
      this.cleanupOldDeletedNotes();

    } catch (error) {
      // Handle specific JWT/auth errors
      if (error.message.includes('JWT') || error.message.includes('401') || error.message.includes('Authentication')) {
        // Redirect to login with error message
        window.location.href = '/?message=session-expired';
        return;
      }

      this.showErrorState(error.message);
    } finally {
      this.isLoading = false;
    }
  }

  // Handle refresh notes button click
  async handleRefreshNotes() {
    const refreshBtn = document.getElementById('refreshNotesBtn');
    const refreshIcon = refreshBtn?.querySelector('.refresh-icon');

    // Add spinning animation
    if (refreshIcon) {
      refreshIcon.style.animation = 'spin 1s linear infinite';
    }

    if (refreshBtn) {
      refreshBtn.disabled = true;
    }

    try {
      // Clear any cached data to force fresh fetch
      if (window.storage && window.storage.clearCache) {
        await window.storage.clearCache();
      }

      // Reload notes
      await this.loadNotes();

      // Show success feedback
      this.showNotification('Notes refreshed successfully', 'success');
    } catch (error) {
      this.showNotification('Failed to refresh notes', 'error');
    } finally {
      // Remove spinning animation and re-enable button
      if (refreshIcon) {
        refreshIcon.style.animation = '';
      }

      if (refreshBtn) {
        refreshBtn.disabled = false;
      }
    }
  }

  // Clean up old deleted notes (runs in background)
  async cleanupOldDeletedNotes() {
    try {
      if (window.api) {
        await window.api.cleanupOldDeletedNotes();
      }
    } catch (error) {
      // Don't show error to user - this is a background operation
    }
  }

  // Handle manual cleanup button click
  async handleManualCleanup() {
    const confirmed = confirm('This will permanently delete notes that were deleted more than 24 hours ago. This action cannot be undone. Continue?');
    if (!confirmed) return;

    // Show loading state on cleanup button
    const cleanupBtn = document.getElementById('cleanupBtn');
    const originalText = cleanupBtn.textContent;
    cleanupBtn.disabled = true;
    cleanupBtn.textContent = 'Cleaning...';

    try {
      const result = await window.api.cleanupOldDeletedNotes();

      if (result.cleaned > 0) {
        this.showNotification(`Successfully cleaned up ${result.cleaned} old deleted notes`, 'success');
      } else {
        this.showNotification('No old deleted notes found to clean up', 'info');
      }
    } catch (error) {
      this.showNotification('Failed to clean up deleted notes. Please try again.', 'error');
    } finally {
      // Restore button state
      cleanupBtn.disabled = false;
      cleanupBtn.textContent = originalText;
    }
  }

  processNotes(rawNotes) {
    return rawNotes.map(note => ({
      ...note,
      // Ensure we have required fields
      id: note.id || this.generateId(),
      title: note.title || 'Untitled Note',
      content: note.content || '',
      url: note.url || 'chrome://extensions',
      domain: note.domain || this.extractDomain(note.url || 'chrome://extensions'),
      tags: note.tags || [],
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
      // Add computed fields for display
      preview: this.generatePreview(note.content || ''),
      formattedDate: this.formatDate(note.updatedAt || note.createdAt)
    })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  generateId() {
    // Use crypto.randomUUID() for proper UUID format (same as extension)
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers (though this shouldn't be needed in modern browsers)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Sanitize color values to prevent XSS (same as rich text editor)
  sanitizeColor(color) {
    if (!color) return null;

    const trimmedColor = color.trim();

    // Allow hex colors (#fff, #ffffff)
    if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(trimmedColor)) {
      return trimmedColor;
    }

    // Allow rgb/rgba colors
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[0-9.]+\s*)?\)$/.test(trimmedColor)) {
      return trimmedColor;
    }

    // Allow hsl/hsla colors
    if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[0-9.]+\s*)?\)$/.test(trimmedColor)) {
      return trimmedColor;
    }

    // Allow CSS variables (for theme colors)
    if (/^var\(--[a-zA-Z0-9-]+\)$/.test(trimmedColor)) {
      return trimmedColor;
    }

    // Allow common named colors (basic set for safety)
    const safeNamedColors = [
      'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
      'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
      'maroon', 'olive', 'teal', 'silver', 'gold'
    ];

    if (safeNamedColors.includes(trimmedColor.toLowerCase())) {
      return trimmedColor;
    }

    return null; // Unsafe color
  }

  // Sanitize URLs to prevent XSS (same as rich text editor)
  sanitizeUrl(url) {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      // Only allow http and https protocols
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        return url;
      }
    } catch (e) {
      // Invalid URL
    }

    return null; // Unsafe URL
  }

  extractDomain(url) {
    if (!url) return 'general';
    if (url === 'chrome://extensions') return 'general';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return 'general';
    }
  }

  generatePreview(content, maxLength = 150) {
    if (!content) return 'No content';
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
    return plainText.length > maxLength
      ? plainText.substring(0, maxLength) + '...'
      : plainText;
  }

  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  populateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;

    // Get unique domains
    const domains = [...new Set(this.notes.map(note => note.domain))].sort();

    // Clear existing options safely
    domainFilter.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'All Domains';
    domainFilter.appendChild(defaultOption);

    // Add domain options
    domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      domainFilter.appendChild(option);
    });
  }

  handleSearch(query) {
    this.currentFilter.search = query.toLowerCase().trim();
    this.applyFilters();
  }

  handleDomainFilter(domain) {
    this.currentFilter.domain = domain;
    this.applyFilters();
  }

  handleDateFilter(dateRange) {
    this.currentFilter.dateRange = dateRange;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.notes];

    // Apply domain filter
    if (this.currentFilter.domain) {
      filtered = filtered.filter(note => note.domain === this.currentFilter.domain);
    }

    // Apply date range filter
    if (this.currentFilter.dateRange) {
      const now = new Date();
      let cutoffDate;

      switch (this.currentFilter.dateRange) {
        case 'today':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          cutoffDate = null;
      }

      if (cutoffDate) {
        filtered = filtered.filter(note => new Date(note.updatedAt) >= cutoffDate);
      }
    }

    // Apply search filter
    if (this.currentFilter.search) {
      const searchTerm = this.currentFilter.search;
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(searchTerm) ||
        note.content.toLowerCase().includes(searchTerm) ||
        note.domain.toLowerCase().includes(searchTerm) ||
        note.url.toLowerCase().includes(searchTerm) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      );
    }

    this.filteredNotes = filtered;
    this.renderNotes();
  }

  renderNotes() {
    const notesGrid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyState');

    if (!notesGrid || !emptyState) return;

    if (this.filteredNotes.length === 0) {
      this.showEmptyState();
      return;
    }

    // Hide empty state and show notes grid
    emptyState.classList.add('hidden');
    notesGrid.classList.remove('hidden');

    // Use DocumentFragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();

    // Create note cards with individual event listeners (more reliable)
    this.filteredNotes.forEach(note => {
      const noteCard = this.createNoteCard(note);
      fragment.appendChild(noteCard);
    });

    // Single DOM update
    notesGrid.innerHTML = '';
    notesGrid.appendChild(fragment);

    // Don't set up event delegation here - it causes issues
    // Individual event listeners are more reliable for now
  }



  createNoteCard(note) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.noteId = note.id;

    const isSelected = this.selectedNotes.has(note.id);
    if (isSelected) {
      card.classList.add('selected');
    }

    // Create card structure safely using DOM methods
    const selectionDiv = document.createElement('div');
    selectionDiv.className = 'note-card-selection';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'note-checkbox';
    checkbox.checked = isSelected;
    checkbox.setAttribute('data-note-id', note.id);
    selectionDiv.appendChild(checkbox);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'note-card-content';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'note-card-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'note-card-title';
    titleDiv.textContent = note.title;

    const dateDiv = document.createElement('div');
    dateDiv.className = 'note-card-date';
    dateDiv.textContent = note.formattedDate;

    headerDiv.appendChild(titleDiv);
    headerDiv.appendChild(dateDiv);

    const previewDiv = document.createElement('div');
    previewDiv.className = 'note-card-preview';
    previewDiv.textContent = note.preview;

    contentDiv.appendChild(headerDiv);
    contentDiv.appendChild(previewDiv);

    // Add URL if present
    if (note.url) {
      const urlDiv = document.createElement('div');
      urlDiv.className = 'note-card-url';
      urlDiv.textContent = this.truncateUrl(note.url);
      contentDiv.appendChild(urlDiv);
    }

    // Add tags if present
    if (note.tags && note.tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'note-card-tags';

      note.tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tag;
        tagsDiv.appendChild(tagSpan);
      });

      contentDiv.appendChild(tagsDiv);
    }

    card.appendChild(selectionDiv);
    card.appendChild(contentDiv);

    // Add checkbox event listener
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      this.toggleNoteSelection(note.id);
    });

    // Add click handler to open note editor (but not on checkbox)
    card.addEventListener('click', (e) => {
      if (!e.target.matches('.note-checkbox')) {
        this.showNoteEditor(note.id);
      }
    });

    return card;
  }

  // Optimized note card creation without individual event listeners
  createOptimizedNoteCard(note) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.noteId = note.id;

    const isSelected = this.selectedNotes.has(note.id);
    if (isSelected) {
      card.classList.add('selected');
    }

    // Create card structure safely using DOM methods (optimized version)
    const selectionDiv = document.createElement('div');
    selectionDiv.className = 'note-card-selection';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'note-checkbox';
    checkbox.checked = isSelected;
    checkbox.setAttribute('data-note-id', note.id);
    selectionDiv.appendChild(checkbox);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'note-card-content';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'note-card-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'note-card-title';
    titleDiv.textContent = note.title;

    const dateDiv = document.createElement('div');
    dateDiv.className = 'note-card-date';
    dateDiv.textContent = note.formattedDate;

    headerDiv.appendChild(titleDiv);
    headerDiv.appendChild(dateDiv);

    const previewDiv = document.createElement('div');
    previewDiv.className = 'note-card-preview';
    previewDiv.textContent = note.preview;

    contentDiv.appendChild(headerDiv);
    contentDiv.appendChild(previewDiv);

    // Add URL if present
    if (note.url) {
      const urlDiv = document.createElement('div');
      urlDiv.className = 'note-card-url';
      urlDiv.textContent = this.truncateUrl(note.url);
      contentDiv.appendChild(urlDiv);
    }

    // Add tags if present
    if (note.tags && note.tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'note-card-tags';

      note.tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tag;
        tagsDiv.appendChild(tagSpan);
      });

      contentDiv.appendChild(tagsDiv);
    }

    card.appendChild(selectionDiv);
    card.appendChild(contentDiv);

    return card;
  }

  // Event delegation for note grid (much more efficient)
  setupNoteGridEventDelegation(notesGrid) {
    // Remove any existing listeners to prevent duplicates
    const existingHandler = notesGrid._delegatedHandler;
    if (existingHandler) {
      notesGrid.removeEventListener('click', existingHandler);
      notesGrid.removeEventListener('change', existingHandler);
    }

    // Single delegated event handler
    const delegatedHandler = (e) => {
      const noteCard = e.target.closest('.note-card');
      if (!noteCard) return;

      const noteId = noteCard.dataset.noteId;
      if (!noteId) return;

      if (e.type === 'change' && e.target.matches('.note-checkbox')) {
        e.stopPropagation();
        this.toggleNoteSelection(noteId);
      } else if (e.type === 'click' && !e.target.matches('.note-checkbox')) {
        this.showNoteEditor(noteId);
      }
    };

    // Add listeners with passive option for better performance
    notesGrid.addEventListener('click', delegatedHandler, { passive: true });
    notesGrid.addEventListener('change', delegatedHandler, { passive: true });

    // Store reference for cleanup
    notesGrid._delegatedHandler = delegatedHandler;
  }

  truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Safe DOM manipulation methods using DOMSanitizer
  async safeSetInnerHTML(element, content, type = 'richText') {
    try {
      if (window.domSanitizer) {
        await window.domSanitizer.safeSetInnerHTML(element, content, type);
      } else {
        // Fallback to text content if sanitizer not available
        element.textContent = content || '';
      }
    } catch (error) {
      // Silent fallback for incognito mode or other restrictions
      if (element) {
        element.textContent = content || '';
      }
    }
  }

  safeSetTextContent(element, content) {
    if (element) {
      element.textContent = content || '';
    }
  }

  // Input validation and sanitization methods
  async validateAndSanitizeInput(input, type) {
    if (window.domSanitizer) {
      return await window.domSanitizer.validateInput(input, type);
    } else {
      // Fallback validation
      return this.basicInputValidation(input, type);
    }
  }

  async validateAndSanitizeTags(tagsString) {
    if (!tagsString) return [];

    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    const sanitizedTags = [];

    for (const tag of tags) {
      if (tag.length <= 100) { // Max tag length
        const sanitized = await this.validateAndSanitizeInput(tag, 'tag');
        if (sanitized) {
          sanitizedTags.push(sanitized);
        }
      }
    }

    return sanitizedTags.slice(0, 20); // Max 20 tags
  }

  basicInputValidation(input, type) {
    if (!input) return '';

    // Basic HTML escaping
    const div = document.createElement('div');
    div.textContent = input;
    let sanitized = div.innerHTML;

    // Length limits
    const maxLengths = {
      title: 500,
      content: 50000,
      tag: 100,
      url: 2000
    };

    const maxLength = maxLengths[type] || maxLengths.content;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }



  showLoadingState() {
    const notesGrid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyState');

    if (notesGrid && emptyState) {
      notesGrid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      // Create loading state safely
      emptyState.innerHTML = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading';

      const title = document.createElement('h3');
      title.textContent = 'Loading notes...';

      const message = document.createElement('p');
      message.textContent = 'Please wait while we fetch your notes.';

      loadingDiv.appendChild(title);
      loadingDiv.appendChild(message);
      emptyState.appendChild(loadingDiv);
    }
  }

  showEmptyState() {
    const notesGrid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyState');

    if (notesGrid && emptyState) {
      notesGrid.classList.add('hidden');
      emptyState.classList.remove('hidden');

      const hasFilters = this.currentFilter.search || this.currentFilter.domain || this.currentFilter.dateRange;

      // Clear existing content
      emptyState.innerHTML = '';

      const title = document.createElement('h3');
      title.textContent = 'No notes found';

      const message = document.createElement('p');

      if (hasFilters) {
        message.textContent = 'No notes match your current filters. Try adjusting your search or filters.';

        const clearButton = document.createElement('button');
        clearButton.className = 'btn-secondary';
        clearButton.textContent = 'Clear Filters';
        clearButton.addEventListener('click', () => this.clearFilters());

        emptyState.appendChild(title);
        emptyState.appendChild(message);
        emptyState.appendChild(clearButton);
      } else {
        message.textContent = 'Start taking notes with the browser extension or create your first note here.';

        const createButton = document.createElement('button');
        createButton.className = 'btn-primary';
        createButton.textContent = 'Create First Note';
        createButton.addEventListener('click', () => this.showNoteEditor());

        emptyState.appendChild(title);
        emptyState.appendChild(message);
        emptyState.appendChild(createButton);
      }
    }
  }

  showErrorState(message) {
    const notesGrid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyState');

    if (notesGrid && emptyState) {
      notesGrid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      // Create error state safely
      emptyState.innerHTML = '';

      const title = document.createElement('h3');
      title.textContent = 'Error loading notes';

      const errorMessage = document.createElement('p');
      errorMessage.textContent = message;

      const retryButton = document.createElement('button');
      retryButton.className = 'btn-primary';
      retryButton.textContent = 'Try Again';
      retryButton.addEventListener('click', () => this.loadNotes());

      emptyState.appendChild(title);
      emptyState.appendChild(errorMessage);
      emptyState.appendChild(retryButton);
    }
  }

  clearFilters() {
    this.currentFilter = {
      domain: '',
      dateRange: '',
      search: ''
    };

    // Reset form elements
    const searchInput = document.getElementById('searchInput');
    const mainSearchInput = document.getElementById('mainSearchInput');
    const domainFilter = document.getElementById('domainFilter');
    const dateFilter = document.getElementById('dateFilter');

    if (searchInput) searchInput.value = '';
    if (mainSearchInput) mainSearchInput.value = '';
    if (domainFilter) domainFilter.value = '';
    if (dateFilter) dateFilter.value = '';

    this.applyFilters();
  }

  showNoteEditor(noteId = null) {
    this.currentNote = noteId ? this.notes.find(n => n.id === noteId) : null;

    if (this.currentNote) {
      this.showNotePanel(this.currentNote);
    } else {
      this.createNewNote();
    }
  }

  showNotePanel(note) {
    this.currentNote = note;
    const panel = document.getElementById('notePanel');
    const noteView = document.getElementById('noteView');
    const noteEdit = document.getElementById('noteEdit');

    // Check if elements exist
    if (!panel || !noteView || !noteEdit) {
      // Note panel elements not found
      return;
    }

    // Show view mode by default
    noteView.classList.remove('hidden');
    noteEdit.classList.add('hidden');

    // Populate view mode
    this.populateNoteView(note);

    // Show panel
    panel.classList.remove('hidden');

    // Add body class to prevent scrolling
    document.body.style.overflow = 'hidden';
  }

  populateNoteView(note) {
    const titleEl = document.getElementById('noteViewTitle');
    const dateEl = document.getElementById('noteViewDate');
    const domainEl = document.getElementById('noteViewDomain');
    const contentEl = document.getElementById('noteContentDisplay');
    const urlEl = document.getElementById('noteUrlDisplay');
    const tagsEl = document.getElementById('noteTagsDisplay');

    // Populate basic info
    titleEl.textContent = note.title || 'Untitled Note';
    dateEl.textContent = this.formatDate(note.updatedAt || note.createdAt);
    domainEl.textContent = note.domain || 'Unknown';

    // Populate formatted content safely using DOMSanitizer
    this.safeSetInnerHTML(contentEl, this.buildContentHtml(note.content || ''), 'richText').catch(console.error);

    // Populate URL safely
    urlEl.innerHTML = '';
    if (note.url) {
      const urlLink = document.createElement('a');
      urlLink.href = note.url;
      urlLink.target = '_blank';
      urlLink.rel = 'noopener noreferrer';
      urlLink.className = 'note-url-link';

      // Create SVG icon
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');

      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('d', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71');

      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path2.setAttribute('d', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71');

      svg.appendChild(path1);
      svg.appendChild(path2);

      urlLink.appendChild(svg);
      urlLink.appendChild(document.createTextNode(' ' + this.truncateUrl(note.url, 40)));
      urlEl.appendChild(urlLink);
    }

    // Populate tags safely
    tagsEl.innerHTML = '';
    if (note.tags && note.tags.length > 0) {
      note.tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'note-tag';
        tagSpan.textContent = tag;
        tagsEl.appendChild(tagSpan);
      });
    }
  }

  // Convert extension's markdown-like format to HTML for display
  buildContentHtml(content) {
    try {
      const escapeHtml = (s) => (s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      let text = content || '';

      // Convert formatting markers to HTML (process in order to avoid conflicts)
      // Bold: **text** -> <b>text</b> (process first - outermost)
      text = text.replace(/\*\*([^*]*(?:\*(?!\*)[^*]*)*)\*\*/g, '<b>$1</b>');

      // Italics: *text* -> <i>text</i> (avoid conflict with bold)
      text = text.replace(/\*([^*]+)\*/g, '<i>$1</i>');

      // Underline: __text__ -> <u>text</u>
      text = text.replace(/__([^_]*(?:_(?!_)[^_]*)*?)__/g, '<u>$1</u>');

      // Strikethrough: ~~text~~ -> <s>text</s> (process last - innermost)
      text = text.replace(/~~([^~]*(?:~(?!~)[^~]*)*?)~~/g, '<s>$1</s>');

      // Color: {color:#ff0000}text{/color} -> <span style="color:#ff0000">text</span>
      // Sanitize color values to prevent XSS
      text = text.replace(/\{color:([^}]+)\}([^{]*)\{\/color\}/g, (match, color, content) => {
        const safeColor = this.sanitizeColor(color);
        if (safeColor) {
          return `<span style="color:${safeColor}">${content}</span>`;
        }
        return content; // If color is unsafe, just return the content without styling
      });

      // Citation: {citation}text{/citation} -> <span style="font-style: italic; color: var(--text-secondary)">text</span>
      text = text.replace(/\{citation\}([^{]*)\{\/citation\}/g, '<span style="font-style: italic; color: var(--text-secondary)">$1</span>');

      const lines = text.split(/\r?\n/);
      const mdLink = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
      const htmlLines = lines.map(line => {
        let out = '';
        let lastIndex = 0;
        let match;
        while ((match = mdLink.exec(line)) !== null) {
          // Don't escape the part that might contain our HTML tags
          const beforeLink = line.slice(lastIndex, match.index);
          out += this.escapeHtmlExceptTags(beforeLink);
          const linkText = escapeHtml(match[1]);
          const href = this.sanitizeUrl(match[2]); // Sanitize URL for XSS protection
          if (href) {
            out += `<a href="${href}" target="_blank" rel="noopener noreferrer" style="cursor: pointer;" title="Click to open: ${href}">${linkText}</a>`;
          } else {
            out += linkText; // If URL is unsafe, just show the text
          }
          lastIndex = mdLink.lastIndex;
        }
        const afterLink = line.slice(lastIndex);
        out += this.escapeHtmlExceptTags(afterLink);
        return out;
      });
      return htmlLines.join('<br>');
    } catch (e) {
      return (content || '').replace(/\n/g, '<br>');
    }
  }

  // Helper method to escape HTML but preserve our formatting tags
  escapeHtmlExceptTags(text) {
    // First escape all HTML
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Then unescape our allowed formatting tags
    escaped = escaped
      .replace(/&lt;(\/?(?:b|i|u|s|span[^&]*))&gt;/gi, '<$1>')
      .replace(/&lt;span style=&quot;([^&]*)&quot;&gt;/gi, '<span style="$1">');

    return escaped;
  }

  createNewNote() {
    const newNote = {
      id: this.generateId(),
      title: '',
      content: '',
      url: 'chrome://extensions',
      domain: 'general',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.currentNote = newNote;
    this.showNoteEditMode();
  }

  closeNotePanel() {
    const panel = document.getElementById('notePanel');
    if (panel) {
      panel.classList.add('hidden');
    }
    document.body.style.overflow = '';

    // Clean up rich text editor reference (it will be recreated when needed)
    this.richTextEditor = null;

    this.currentNote = null;
  }

  showNoteEditMode() {
    const panel = document.getElementById('notePanel');
    const noteView = document.getElementById('noteView');
    const noteEdit = document.getElementById('noteEdit');

    if (!panel || !noteView || !noteEdit) {
      // Note panel elements not found
      return;
    }

    // Show the panel first
    panel.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Switch to edit mode
    noteView.classList.add('hidden');
    noteEdit.classList.remove('hidden');

    // Populate edit form
    this.populateNoteEditForm();
  }

  populateNoteEditForm() {
    const titleInput = document.getElementById('noteTitle');
    const urlInput = document.getElementById('noteUrl');
    const contentInput = document.getElementById('noteContentInput');
    const tagsInput = document.getElementById('noteTags');
    const toolbar = document.getElementById('editorToolbar');

    // Initialize rich text editor if not already done
    if (!this.richTextEditor && contentInput && toolbar) {
      try {
        if (window.RichTextEditor) {
          this.richTextEditor = new window.RichTextEditor(contentInput, toolbar);
          console.log('Rich text editor initialized successfully');
        } else {
          console.warn('RichTextEditor class not available');
        }
      } catch (error) {
        console.error('Failed to initialize rich text editor:', error);
      }
    }

    if (this.currentNote) {
      titleInput.value = this.currentNote.title || '';
      urlInput.value = this.currentNote.url || '';

      // Use rich text editor to set content
      if (this.richTextEditor) {
        this.richTextEditor.setContent(this.currentNote.content || '');
      } else {
        // Fallback to safe HTML setting
        this.safeSetInnerHTML(contentInput, this.buildContentHtml(this.currentNote.content || ''), 'richText').catch(console.error);
      }

      tagsInput.value = (this.currentNote.tags || []).join(', ');
    } else {
      // Clear form for new note
      titleInput.value = '';
      urlInput.value = '';
      if (this.richTextEditor) {
        this.richTextEditor.setContent('');
      } else {
        contentInput.innerHTML = '';
      }
      tagsInput.value = '';
    }

    // Ensure link handling is set up for the contenteditable area
    this.setupContentEditableLinksForCurrentContent();

    // Focus on title field
    setTimeout(() => titleInput.focus(), 100);
  }

  cancelNoteEdit() {
    if (this.currentNote && this.currentNote.id) {
      // Existing note - go back to view mode
      const noteView = document.getElementById('noteView');
      const noteEdit = document.getElementById('noteEdit');

      if (noteView && noteEdit) {
        noteEdit.classList.add('hidden');
        noteView.classList.remove('hidden');
      }
    } else {
      // New note - close panel
      this.closeNotePanel();
    }
  }

  // Convert HTML back to extension's markdown-like format for storage
  async htmlToMarkdown(html) {
    const tmp = document.createElement('div');
    // Use DOMSanitizer to safely set HTML content
    await this.safeSetInnerHTML(tmp, html || '', 'richText');

    // Convert formatting tags to markdown-style markers
    // Bold tags
    tmp.querySelectorAll('b, strong').forEach(el => {
      const text = el.textContent;
      const md = document.createTextNode(`**${text}**`);
      el.replaceWith(md);
    });

    // Italics tags
    tmp.querySelectorAll('i, em').forEach(el => {
      const text = el.textContent;
      const md = document.createTextNode(`*${text}*`);
      el.replaceWith(md);
    });

    // Underline tags
    tmp.querySelectorAll('u').forEach(el => {
      const text = el.textContent;
      const md = document.createTextNode(`__${text}__`);
      el.replaceWith(md);
    });

    // Strikethrough tags  
    tmp.querySelectorAll('s, strike').forEach(el => {
      const text = el.textContent;
      const md = document.createTextNode(`~~${text}~~`);
      el.replaceWith(md);
    });

    // Citation spans (preserve with special formatting) - process BEFORE color spans
    tmp.querySelectorAll('span[style*="font-style: italic"][style*="color"]').forEach(el => {
      const text = el.textContent;
      // Check if this looks like a citation (italic + secondary color)
      const style = el.getAttribute('style');
      if (style.includes('font-style: italic') && style.includes('var(--text-secondary)')) {
        // Mark as citation with special syntax
        const md = document.createTextNode(`{citation}${text}{/citation}`);
        el.replaceWith(md);
      } else {
        // Just unwrap if not a citation
        el.replaceWith(document.createTextNode(text));
      }
    });

    // Color spans (process AFTER citation spans to avoid conflicts)
    tmp.querySelectorAll('span[style*="color"]').forEach(el => {
      const text = el.textContent;
      const style = el.getAttribute('style');
      const colorMatch = style.match(/color:\s*([^;]+)/);
      if (colorMatch) {
        const color = colorMatch[1].trim();
        const md = document.createTextNode(`{color:${color}}${text}{/color}`);
        el.replaceWith(md);
      } else {
        // If no color found, just unwrap
        el.replaceWith(document.createTextNode(text));
      }
    });

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

  async handleNoteSave(event) {
    event.preventDefault();

    const noteTitle = document.getElementById('noteTitle');
    const noteUrl = document.getElementById('noteUrl');
    const noteContentInput = document.getElementById('noteContentInput');
    const noteTags = document.getElementById('noteTags');

    // Validate and sanitize inputs
    const title = await this.validateAndSanitizeInput(noteTitle.value.trim(), 'title');
    const url = await this.validateAndSanitizeInput(noteUrl.value.trim(), 'url');

    // Get content from rich text editor if available, otherwise fallback to HTML conversion
    let content;
    if (this.richTextEditor) {
      content = this.richTextEditor.getContent();
    } else {
      content = await this.htmlToMarkdown(noteContentInput.innerHTML);
    }

    const tags = await this.validateAndSanitizeTags(noteTags.value);

    if (!title && !content) {
      this.showNotification('Please enter a title or content for the note.', 'error');
      return;
    }

    // Show saving indicator
    this.setSaveButtonState(true);

    try {
      const noteData = {
        title: title || 'Untitled Note',
        content: content,
        url: url || 'chrome://extensions',
        domain: url ? this.extractDomain(url) : 'general',
        tags: tags,
        updated_at: new Date().toISOString()
      };

      if (this.currentNote && this.currentNote.id) {
        // Update existing note
        noteData.id = this.currentNote.id;
        noteData.createdAt = this.currentNote.createdAt;

        // Update in local array
        const index = this.notes.findIndex(n => n.id === this.currentNote.id);
        if (index !== -1) {
          this.notes[index] = { ...this.notes[index], ...this.processNotes([noteData])[0] };
        }
      } else {
        // Create new note
        noteData.id = this.generateId();
        noteData.createdAt = noteData.updatedAt;

        // Add to local array at the beginning (most recent first)
        const processedNote = this.processNotes([noteData])[0];
        this.notes.unshift(processedNote);
        // New note added to local array
      }

      // Update current note
      this.currentNote = { ...this.currentNote, ...noteData };

      // Sync to cloud with encryption
      try {
        await this.syncNoteToCloud(noteData);
      } catch (syncError) {
        // Cloud sync failed, but note saved locally
        // Note is still saved locally, so we can continue
      }

      // Refresh display to show the new/updated note
      this.populateDomainFilter();
      this.applyFilters();

      // Force a UI refresh to ensure the new note appears
      this.renderNotes();

      // Switch back to view mode and update the panel with the saved note
      setTimeout(() => {
        this.populateNoteView(this.currentNote);
        const noteView = document.getElementById('noteView');
        const noteEdit = document.getElementById('noteEdit');
        noteEdit.classList.add('hidden');
        noteView.classList.remove('hidden');
      }, 100);

      this.showNotification('Note saved successfully!', 'success');

    } catch (error) {
      // Error saving note
      this.showNotification('Failed to save note. Please try again.', 'error');
    } finally {
      this.setSaveButtonState(false);
    }
  }

  async handleNoteDelete() {
    if (!this.currentNote) return;

    const confirmed = confirm(`Are you sure you want to delete "${this.currentNote.title}"? This action cannot be undone.`);
    if (!confirmed) return;

    // Show deleting indicator
    this.setDeleteButtonState(true);

    try {
      // Use the same deletion method as extension - sync with deletions array
      if (window.api) {
        // Prepare deletion payload in the same format as extension
        const deletionPayload = {
          operation: 'sync',
          notes: [], // No notes to sync, just deletions
          deletions: [{
            id: this.currentNote.id,
            deletedAt: new Date().toISOString()
          }],
          lastSyncTime: null,
          timestamp: Date.now(),
          _debug: 'deletion-v1-' + Date.now()
        };

        await window.api.syncNotes(deletionPayload);
      }

      // Remove from local array
      this.notes = this.notes.filter(n => n.id !== this.currentNote.id);

      // Refresh display
      this.populateDomainFilter();
      this.applyFilters();
      this.closeNotePanel();

      this.showNotification('Note deleted successfully!', 'success');

    } catch (error) {
      // Error deleting note
      this.showNotification('Failed to delete note. Please try again.', 'error');
    } finally {
      this.setDeleteButtonState(false);
    }
  }

  async syncNoteToCloud(noteData) {
    // No auth check needed - we're already authenticated on dashboard
    try {
      // Prepare sync payload in the exact same format as extension
      const syncPayload = {
        operation: 'sync', // FIXED: Use 'sync' not 'push' to match extension - v2
        notes: [{
          id: noteData.id,
          title: noteData.title,
          content: noteData.content,
          url: noteData.url || 'chrome://extensions',
          domain: noteData.domain || 'general',
          tags: noteData.tags || [],
          createdAt: noteData.createdAt,
          updatedAt: noteData.updatedAt
        }],
        deletions: [],
        lastSyncTime: null,
        timestamp: Date.now(),
        _debug: 'dashboard-v2-' + Date.now() // Cache buster
      };

      // Use the API's sync method which handles encryption
      await window.api.syncNotes(syncPayload);

    } catch (error) {
      // Cloud sync failed
      // Don't throw error - note is saved locally
      this.showNotification('Note saved locally. Cloud sync will retry later.', 'warning');
      throw error; // Re-throw so the caller knows sync failed
    }
  }

  setSaveButtonState(saving) {
    const saveBtn = document.querySelector('#noteForm button[type="submit"]');
    if (saveBtn) {
      if (saving) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        saveBtn.classList.add('loading');
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Note';
        saveBtn.classList.remove('loading');
      }
    }
  }

  setDeleteButtonState(deleting) {
    const deleteBtn = document.getElementById('deleteNotePanelBtn');
    if (deleteBtn) {
      if (deleting) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';
        deleteBtn.classList.add('loading');
      } else {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.remove('loading');
      }
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);

    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Import Modal Functionality
  setupImportModalListeners() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const importFileInput = document.getElementById('importFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    const startImportBtn = document.getElementById('startImportBtn');

    // File selection
    if (selectFileBtn) {
      selectFileBtn.addEventListener('click', () => importFileInput?.click());
    }

    if (fileUploadArea) {
      fileUploadArea.addEventListener('click', () => importFileInput?.click());
    }

    // File input change
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => this.handleFileSelection(e));
    }

    // Drag and drop
    if (fileUploadArea) {
      fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
      fileUploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      fileUploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
    }

    // Import actions
    if (cancelImportBtn) {
      cancelImportBtn.addEventListener('click', () => this.cancelImport());
    }

    if (startImportBtn) {
      startImportBtn.addEventListener('click', () => this.startImport());
    }
  }

  showImportModal() {
    // Reset modal state
    this.resetImportModal();

    // Show modal
    window.app.showModal('importModal');
  }

  resetImportModal() {
    // Reset file input
    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
      importFileInput.value = '';
    }

    // Hide sections
    const fileInfoSection = document.getElementById('fileInfoSection');
    const importPreviewSection = document.getElementById('importPreviewSection');
    const importProgress = document.getElementById('importProgress');

    if (fileInfoSection) fileInfoSection.classList.add('hidden');
    if (importPreviewSection) importPreviewSection.classList.add('hidden');
    if (importProgress) importProgress.classList.add('hidden');

    // Reset button state
    const startImportBtn = document.getElementById('startImportBtn');
    if (startImportBtn) {
      startImportBtn.disabled = true;
      startImportBtn.classList.remove('importing');
    }

    // Reset status text
    const importStatusText = document.getElementById('importStatusText');
    if (importStatusText) {
      importStatusText.textContent = 'Select a file to import';
    }

    // Reset drag state
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
      fileUploadArea.classList.remove('dragover');
    }

    // Clear stored import data
    this.importData = null;
    this.importFileInfo = null;
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
      fileUploadArea.classList.add('dragover');
    }
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
      fileUploadArea.classList.remove('dragover');
    }
  }

  handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
      fileUploadArea.classList.remove('dragover');
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processSelectedFile(files[0]);
    }
  }

  handleFileSelection(e) {
    const file = e.target.files[0];
    if (file) {
      this.processSelectedFile(file);
    }
  }

  async processSelectedFile(file) {
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

      // Update status
      const importStatusText = document.getElementById('importStatusText');
      if (importStatusText) {
        importStatusText.textContent = 'Reading file...';
      }

      // Read file content
      const text = await file.text();

      // Parse JSON
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

      // Store import data
      this.importData = importData;
      this.importFileInfo = {
        name: file.name,
        size: file.size,
        totalNotes: validation.totalNotes,
        validDomains: validation.validDomains
      };

      // Show file info and preview
      this.showFileInfo();
      this.showImportPreview();

      // Enable import button
      const startImportBtn = document.getElementById('startImportBtn');
      if (startImportBtn) {
        startImportBtn.disabled = false;
      }

      // Update status
      if (importStatusText) {
        importStatusText.textContent = `Ready to import ${validation.totalNotes} notes from ${validation.validDomains} domains`;
      }

    } catch (error) {
      this.showNotification(`Failed to process file: ${error.message}`, 'error');

      // Update status
      const importStatusText = document.getElementById('importStatusText');
      if (importStatusText) {
        importStatusText.textContent = 'Select a file to import';
      }
    }
  }

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

      // Check for Anchored export identifier
      if (!importData._anchored) {
        return { 
          isValid: false, 
          error: 'This file does not appear to be an Anchored notes export. Please ensure you are importing a file exported from Anchored.' 
        };
      }

      // Validate Anchored metadata
      const anchored = importData._anchored;
      if (!anchored.version || !anchored.format || anchored.format !== 'anchored-notes') {
        return { 
          isValid: false, 
          error: 'Invalid Anchored export format. Please ensure you are importing a valid Anchored notes file.' 
        };
      }

      let totalNotes = 0;
      let validDomains = 0;

      // Validate each domain (skip the _anchored metadata)
      for (const [domain, notes] of Object.entries(importData)) {
        // Skip metadata and non-note data
        if (domain === '_anchored' || domain === 'themeMode' || !Array.isArray(notes)) {
          continue;
        }

        // Validate domain format
        if (!this.isValidDomain(domain)) {
          return { isValid: false, error: `Invalid domain format: ${domain}` };
        }

        validDomains++;

        // Validate notes array
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          const noteLocation = `${domain}[${i}]`;

          // Validate note structure
          const noteValidation = this.validateNoteStructure(note, noteLocation);
          if (!noteValidation.isValid) {
            return noteValidation;
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

  // Enhanced note structure validation
  validateNoteStructure(note, location) {
    // Check if note is an object
    if (!note || typeof note !== 'object') {
      return { isValid: false, error: `Invalid note at ${location}: not an object` };
    }

    // Validate required ID field with UUID format
    if (!note.id || typeof note.id !== 'string') {
      return { isValid: false, error: `Invalid note at ${location}: missing or invalid ID` };
    }

    if (!this.isValidUUID(note.id)) {
      return { isValid: false, error: `Invalid note at ${location}: ID must be a valid UUID format` };
    }

    // Validate required domain field
    if (!note.domain || typeof note.domain !== 'string') {
      return { isValid: false, error: `Invalid note at ${location}: missing or invalid domain` };
    }

    if (!this.isValidDomain(note.domain)) {
      return { isValid: false, error: `Invalid note at ${location}: invalid domain format` };
    }

    // Validate string fields (all optional except id and domain)
    const stringFields = ['title', 'content', 'url', 'pageTitle'];
    for (const field of stringFields) {
      if (note[field] !== undefined && typeof note[field] !== 'string') {
        return { isValid: false, error: `Invalid note at ${location}: ${field} must be a string` };
      }
    }

    // Validate URL format if present
    if (note.url && !this.isValidURL(note.url)) {
      return { isValid: false, error: `Invalid note at ${location}: invalid URL format` };
    }

    // Validate tags array
    if (note.tags !== undefined) {
      if (!Array.isArray(note.tags)) {
        return { isValid: false, error: `Invalid note at ${location}: tags must be an array` };
      }

      // Validate each tag is a string
      for (let j = 0; j < note.tags.length; j++) {
        if (typeof note.tags[j] !== 'string') {
          return { isValid: false, error: `Invalid note at ${location}: tag[${j}] must be a string` };
        }

        // Validate tag length and format
        if (note.tags[j].length === 0 || note.tags[j].length > 50) {
          return { isValid: false, error: `Invalid note at ${location}: tag[${j}] must be 1-50 characters` };
        }
      }

      // Check for duplicate tags
      const uniqueTags = new Set(note.tags);
      if (uniqueTags.size !== note.tags.length) {
        return { isValid: false, error: `Invalid note at ${location}: duplicate tags not allowed` };
      }
    }

    // Validate timestamp fields
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

    // Validate content length limits (reasonable limits for import)
    if (note.title && note.title.length > 500) {
      return { isValid: false, error: `Invalid note at ${location}: title too long (max 500 characters)` };
    }

    if (note.content && note.content.length > 100000) {
      return { isValid: false, error: `Invalid note at ${location}: content too long (max 100,000 characters)` };
    }

    return { isValid: true };
  }

  // UUID validation (RFC 4122 format)
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Domain validation
  isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;

    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  // URL validation
  isValidURL(url) {
    if (!url || typeof url !== 'string') return false;

    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  // ISO timestamp validation
  isValidTimestamp(timestamp) {
    if (!timestamp || typeof timestamp !== 'string') return false;

    try {
      const date = new Date(timestamp);
      return date.toISOString() === timestamp;
    } catch {
      return false;
    }
  }

  showFileInfo() {
    const fileInfoSection = document.getElementById('fileInfoSection');
    const fileInfo = document.getElementById('fileInfo');

    if (!fileInfoSection || !fileInfo || !this.importFileInfo) return;

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Create file info safely
    fileInfo.innerHTML = '';

    const createInfoItem = (label, value) => {
      const item = document.createElement('div');
      item.className = 'file-info-item';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'file-info-label';
      labelSpan.textContent = label;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'file-info-value';
      valueSpan.textContent = value;

      item.appendChild(labelSpan);
      item.appendChild(valueSpan);
      return item;
    };

    fileInfo.appendChild(createInfoItem('File Name:', this.importFileInfo.name));
    fileInfo.appendChild(createInfoItem('File Size:', formatFileSize(this.importFileInfo.size)));
    fileInfo.appendChild(createInfoItem('Total Notes:', this.importFileInfo.totalNotes));
    fileInfo.appendChild(createInfoItem('Domains:', this.importFileInfo.validDomains));

    fileInfoSection.classList.remove('hidden');
  }

  showImportPreview() {
    const importPreviewSection = document.getElementById('importPreviewSection');
    const importPreview = document.getElementById('importPreview');

    if (!importPreviewSection || !importPreview || !this.importData) return;

    let previewHtml = '';

    // Show preview of domains and notes
    for (const [domain, notes] of Object.entries(this.importData)) {
      if (!Array.isArray(notes) || notes.length === 0) continue;

      previewHtml += `
        <div class="preview-domain">
          <div class="preview-domain-title">
            ${this.escapeHtml(domain)}
            <span class="preview-note-count">${notes.length} notes</span>
          </div>
          <div class="preview-notes">
      `;

      // Show first few notes as preview
      const previewNotes = notes.slice(0, 3);
      previewNotes.forEach(note => {
        const title = note.title || 'Untitled Note';
        const content = note.content || '';
        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;

        previewHtml += `
          <div class="preview-note">
            <div class="preview-note-title">${this.escapeHtml(title)}</div>
            ${preview ? `<div class="preview-note-content">${this.escapeHtml(preview)}</div>` : ''}
          </div>
        `;
      });

      if (notes.length > 3) {
        previewHtml += `
          <div class="preview-note">
            <div class="preview-note-content">... and ${notes.length - 3} more notes</div>
          </div>
        `;
      }

      previewHtml += `
          </div>
        </div>
      `;
    }

    importPreview.innerHTML = previewHtml;
    importPreviewSection.classList.remove('hidden');
  }

  cancelImport() {
    window.app.hideModal('importModal');
  }

  async startImport() {
    if (!this.importData) {
      this.showNotification('No file selected for import', 'error');
      return;
    }

    try {
      // Show progress
      this.showImportProgress();

      // Update button state
      const startImportBtn = document.getElementById('startImportBtn');
      if (startImportBtn) {
        startImportBtn.disabled = true;
        startImportBtn.classList.add('importing');
      }

      // Update progress
      this.updateImportProgress(10, 'Preparing import...');

      // No auth check needed - we're already authenticated on dashboard

      // Update progress
      this.updateImportProgress(20, 'Processing notes...');

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const totalNotes = this.importFileInfo.totalNotes;

      // Import notes domain by domain
      let processedNotes = 0;
      for (const [domain, notes] of Object.entries(this.importData)) {
        // Skip metadata and non-note data
        if (domain === '_anchored' || !Array.isArray(notes)) continue;

        for (const note of notes) {
          if (note && note.id) {
            try {
              // Prepare note data for import
              const noteData = {
                ...note,
                // Ensure required fields
                id: note.id,
                title: note.title || 'Untitled Note',
                content: note.content || '',
                url: note.url || 'chrome://extensions',
                domain: note.domain || domain,
                tags: Array.isArray(note.tags) ? note.tags : [],
                // Set timestamps
                createdAt: note.createdAt || new Date().toISOString(),
                updatedAt: note.updatedAt || new Date().toISOString(),
                // Ensure note is not marked as deleted
                is_deleted: false,
                deleted_at: null
              };

              // Check if note already exists
              const existingNote = this.notes.find(n => n.id === noteData.id);

              if (existingNote) {
                // Update existing note
                await window.storage.saveNote(noteData);
                updatedCount++;
              } else {
                // Import new note
                await window.storage.saveNote(noteData);
                importedCount++;
              }

              processedNotes++;

              // Update progress
              const progress = 20 + (processedNotes / totalNotes) * 70;
              this.updateImportProgress(progress, `Importing notes... ${processedNotes}/${totalNotes}`);

              // Small delay to prevent overwhelming the API
              if (processedNotes % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }

            } catch (error) {
              console.warn('Failed to import note:', note.id, error);
              skippedCount++;
            }
          }
        }
      }

      // Update progress
      this.updateImportProgress(95, 'Refreshing notes...');

      // Reload notes to show imported data
      await this.loadNotes();

      // Update progress
      this.updateImportProgress(100, 'Import complete!');

      // Show success message
      let message = `Successfully imported ${importedCount} notes!`;
      if (updatedCount > 0) {
        message += ` (${updatedCount} updated)`;
      }
      if (skippedCount > 0) {
        message += ` (${skippedCount} skipped)`;
      }

      this.showNotification(message, 'success');

      // Close modal after a short delay
      setTimeout(() => {
        window.app.hideModal('importModal');
      }, 2000);

    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification(`Import failed: ${error.message}`, 'error');

      // Reset button state
      const startImportBtn = document.getElementById('startImportBtn');
      if (startImportBtn) {
        startImportBtn.disabled = false;
        startImportBtn.classList.remove('importing');
      }
    }
  }

  showImportProgress() {
    const importProgress = document.getElementById('importProgress');
    if (importProgress) {
      importProgress.classList.remove('hidden');
    }
  }

  updateImportProgress(percentage, text) {
    const importProgressFill = document.getElementById('importProgressFill');
    const importProgressText = document.getElementById('importProgressText');

    if (importProgressFill) {
      importProgressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }

    if (importProgressText) {
      importProgressText.textContent = text;
    }
  }

  showExportModal(preSelectedNotes = null) {
    // If preSelectedNotes is provided (from bulk export), use those
    // Otherwise, start with empty selection
    if (preSelectedNotes) {
      this.selectedExportNotes = new Set(preSelectedNotes);
    } else {
      this.selectedExportNotes = new Set();
    }

    this.initializeExportModal();
    window.app.showModal('exportModal');
  }

  initializeExportModal() {
    // Initialize export modal with current notes
    // selectedExportNotes should already be set by showExportModal()
    this.populateExportNotesList();
    this.populateExportDomainFilter();
    this.setupExportEventListeners();
    this.updateExportSelectedCount();
    this.updateExportButtonState();
  }

  populateExportNotesList() {
    const exportNotesList = document.getElementById('exportNotesList');
    if (!exportNotesList) return;

    // Clear existing notes
    exportNotesList.innerHTML = '';

    if (this.filteredNotes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'export-empty-state';

      const message = document.createElement('p');
      message.textContent = 'No notes available for export.';

      emptyState.appendChild(message);
      exportNotesList.appendChild(emptyState);
      return;
    }

    // Create note items for selection
    const fragment = document.createDocumentFragment();

    this.filteredNotes.forEach(note => {
      const noteItem = this.createExportNoteItem(note);
      fragment.appendChild(noteItem);
    });

    exportNotesList.appendChild(fragment);
  }

  createExportNoteItem(note) {
    const item = document.createElement('div');
    item.className = 'export-note-item';
    item.dataset.noteId = note.id;

    const isSelected = this.selectedExportNotes.has(note.id);
    if (isSelected) {
      item.classList.add('selected');
    }

    // Create export note item safely
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'export-note-checkbox';
    checkbox.checked = isSelected;
    checkbox.setAttribute('data-note-id', note.id);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'export-note-content';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'export-note-title';
    titleDiv.textContent = note.title;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'export-note-meta';

    const domainSpan = document.createElement('span');
    domainSpan.className = 'export-note-domain';
    domainSpan.textContent = note.domain;

    const dateSpan = document.createElement('span');
    dateSpan.className = 'export-note-date';
    dateSpan.textContent = note.formattedDate;

    metaDiv.appendChild(domainSpan);
    metaDiv.appendChild(dateSpan);

    const previewDiv = document.createElement('div');
    previewDiv.className = 'export-note-preview';
    previewDiv.textContent = note.preview;

    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(metaDiv);
    contentDiv.appendChild(previewDiv);

    item.appendChild(checkbox);
    item.appendChild(contentDiv);

    // Add event listeners
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      this.toggleExportNoteSelection(note.id);
    });

    item.addEventListener('click', (e) => {
      if (!e.target.matches('.export-note-checkbox')) {
        this.toggleExportNoteSelection(note.id);
      }
    });

    return item;
  }

  populateExportDomainFilter() {
    const domainBulkSelect = document.getElementById('domainBulkSelect');
    if (!domainBulkSelect) return;

    // Get unique domains from current notes
    const domains = [...new Set(this.filteredNotes.map(note => note.domain))].sort();

    // Clear existing options safely
    domainBulkSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choose domain...';
    domainBulkSelect.appendChild(defaultOption);

    // Add domain options
    domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      domainBulkSelect.appendChild(option);
    });
  }

  setupExportEventListeners() {
    // Remove existing listeners to prevent duplicates
    this.removeExportEventListeners();

    // Select/Deselect all buttons
    const selectAllExportBtn = document.getElementById('selectAllExportBtn');
    const deselectAllExportBtn = document.getElementById('deselectAllExportBtn');

    if (selectAllExportBtn) {
      this.selectAllExportHandler = () => this.selectAllExportNotes();
      selectAllExportBtn.addEventListener('click', this.selectAllExportHandler);
    }

    if (deselectAllExportBtn) {
      this.deselectAllExportHandler = () => this.deselectAllExportNotes();
      deselectAllExportBtn.addEventListener('click', this.deselectAllExportHandler);
    }

    // Bulk selection checkboxes
    const selectByDomainCheckbox = document.getElementById('selectByDomainCheckbox');
    const selectByDateCheckbox = document.getElementById('selectByDateCheckbox');
    const domainBulkSelect = document.getElementById('domainBulkSelect');
    const dateBulkSelect = document.getElementById('dateBulkSelect');

    if (selectByDomainCheckbox && domainBulkSelect) {
      this.domainCheckboxHandler = (e) => {
        domainBulkSelect.disabled = !e.target.checked;
        if (!e.target.checked) {
          domainBulkSelect.value = '';
        }
      };
      selectByDomainCheckbox.addEventListener('change', this.domainCheckboxHandler);

      this.domainSelectHandler = (e) => {
        if (e.target.value && selectByDomainCheckbox.checked) {
          this.selectNotesByDomain(e.target.value);
        }
      };
      domainBulkSelect.addEventListener('change', this.domainSelectHandler);
    }

    if (selectByDateCheckbox && dateBulkSelect) {
      this.dateCheckboxHandler = (e) => {
        dateBulkSelect.disabled = !e.target.checked;
        if (!e.target.checked) {
          dateBulkSelect.value = '';
        }
      };
      selectByDateCheckbox.addEventListener('change', this.dateCheckboxHandler);

      this.dateSelectHandler = (e) => {
        if (e.target.value && selectByDateCheckbox.checked) {
          this.selectNotesByDateRange(e.target.value);
        }
      };
      dateBulkSelect.addEventListener('change', this.dateSelectHandler);
    }

    // Export buttons
    const cancelExportBtn = document.getElementById('cancelExportBtn');
    const startExportBtn = document.getElementById('startExportBtn');

    if (cancelExportBtn) {
      this.cancelExportHandler = () => this.cancelExport();
      cancelExportBtn.addEventListener('click', this.cancelExportHandler);
    }

    if (startExportBtn) {
      this.startExportHandler = () => this.startExport();
      startExportBtn.addEventListener('click', this.startExportHandler);
    }
  }

  removeExportEventListeners() {
    // Clean up existing event listeners
    const selectAllExportBtn = document.getElementById('selectAllExportBtn');
    const deselectAllExportBtn = document.getElementById('deselectAllExportBtn');
    const selectByDomainCheckbox = document.getElementById('selectByDomainCheckbox');
    const selectByDateCheckbox = document.getElementById('selectByDateCheckbox');
    const domainBulkSelect = document.getElementById('domainBulkSelect');
    const dateBulkSelect = document.getElementById('dateBulkSelect');
    const cancelExportBtn = document.getElementById('cancelExportBtn');
    const startExportBtn = document.getElementById('startExportBtn');

    if (selectAllExportBtn && this.selectAllExportHandler) {
      selectAllExportBtn.removeEventListener('click', this.selectAllExportHandler);
    }
    if (deselectAllExportBtn && this.deselectAllExportHandler) {
      deselectAllExportBtn.removeEventListener('click', this.deselectAllExportHandler);
    }
    if (selectByDomainCheckbox && this.domainCheckboxHandler) {
      selectByDomainCheckbox.removeEventListener('change', this.domainCheckboxHandler);
    }
    if (selectByDateCheckbox && this.dateCheckboxHandler) {
      selectByDateCheckbox.removeEventListener('change', this.dateCheckboxHandler);
    }
    if (domainBulkSelect && this.domainSelectHandler) {
      domainBulkSelect.removeEventListener('change', this.domainSelectHandler);
    }
    if (dateBulkSelect && this.dateSelectHandler) {
      dateBulkSelect.removeEventListener('change', this.dateSelectHandler);
    }
    if (cancelExportBtn && this.cancelExportHandler) {
      cancelExportBtn.removeEventListener('click', this.cancelExportHandler);
    }
    if (startExportBtn && this.startExportHandler) {
      startExportBtn.removeEventListener('click', this.startExportHandler);
    }
  }

  toggleExportNoteSelection(noteId) {
    if (this.selectedExportNotes.has(noteId)) {
      this.selectedExportNotes.delete(noteId);
    } else {
      this.selectedExportNotes.add(noteId);
    }

    // Update UI
    this.updateExportNoteItemUI(noteId);
    this.updateExportSelectedCount();
    this.updateExportButtonState();
  }

  updateExportNoteItemUI(noteId) {
    const noteItem = document.querySelector(`[data-note-id="${noteId}"]`);
    const checkbox = noteItem?.querySelector('.export-note-checkbox');

    if (noteItem && checkbox) {
      const isSelected = this.selectedExportNotes.has(noteId);
      checkbox.checked = isSelected;

      if (isSelected) {
        noteItem.classList.add('selected');
      } else {
        noteItem.classList.remove('selected');
      }
    }
  }

  selectAllExportNotes() {
    this.filteredNotes.forEach(note => {
      this.selectedExportNotes.add(note.id);
    });
    this.updateAllExportNoteItemsUI();
    this.updateExportSelectedCount();
    this.updateExportButtonState();
  }

  deselectAllExportNotes() {
    this.selectedExportNotes.clear();
    this.updateAllExportNoteItemsUI();
    this.updateExportSelectedCount();
    this.updateExportButtonState();
  }

  selectNotesByDomain(domain) {
    this.filteredNotes
      .filter(note => note.domain === domain)
      .forEach(note => {
        this.selectedExportNotes.add(note.id);
      });

    this.updateAllExportNoteItemsUI();
    this.updateExportSelectedCount();
    this.updateExportButtonState();
  }

  selectNotesByDateRange(dateRange) {
    const now = new Date();
    let cutoffDate;

    switch (dateRange) {
      case 'today':
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
        cutoffDate = null;
        break;
      default:
        return;
    }

    const notesToSelect = cutoffDate
      ? this.filteredNotes.filter(note => new Date(note.updatedAt) >= cutoffDate)
      : this.filteredNotes;

    notesToSelect.forEach(note => {
      this.selectedExportNotes.add(note.id);
    });

    this.updateAllExportNoteItemsUI();
    this.updateExportSelectedCount();
    this.updateExportButtonState();
  }

  updateAllExportNoteItemsUI() {
    const exportNotesList = document.getElementById('exportNotesList');
    if (!exportNotesList) return;

    const noteItems = exportNotesList.querySelectorAll('.export-note-item');
    noteItems.forEach(item => {
      const noteId = item.dataset.noteId;
      const checkbox = item.querySelector('.export-note-checkbox');

      if (checkbox) {
        const isSelected = this.selectedExportNotes.has(noteId);
        checkbox.checked = isSelected;

        if (isSelected) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      }
    });
  }

  updateExportSelectedCount() {
    const exportSelectedCount = document.getElementById('exportSelectedCount');
    if (exportSelectedCount) {
      const count = this.selectedExportNotes.size;
      exportSelectedCount.textContent = `${count} note${count !== 1 ? 's' : ''} selected`;
    }
  }

  updateExportButtonState() {
    const startExportBtn = document.getElementById('startExportBtn');
    if (startExportBtn) {
      startExportBtn.disabled = this.selectedExportNotes.size === 0;
    }
  }

  cancelExport() {
    // Reset export state
    this.selectedExportNotes = new Set();

    // Reset form elements
    const selectByDomainCheckbox = document.getElementById('selectByDomainCheckbox');
    const selectByDateCheckbox = document.getElementById('selectByDateCheckbox');
    const domainBulkSelect = document.getElementById('domainBulkSelect');
    const dateBulkSelect = document.getElementById('dateBulkSelect');

    if (selectByDomainCheckbox) selectByDomainCheckbox.checked = false;
    if (selectByDateCheckbox) selectByDateCheckbox.checked = false;
    if (domainBulkSelect) {
      domainBulkSelect.value = '';
      domainBulkSelect.disabled = true;
    }
    if (dateBulkSelect) {
      dateBulkSelect.value = '';
      dateBulkSelect.disabled = true;
    }

    // Hide progress
    this.hideExportProgress();

    // Close modal
    window.app.hideModal('exportModal');
  }

  async startExport() {
    if (this.selectedExportNotes.size === 0) {
      this.showNotification('Please select at least one note to export', 'warning');
      return;
    }

    const exportFormat = document.getElementById('exportFormat')?.value || 'json';

    try {
      // Show progress
      this.showExportProgress();
      this.updateExportProgress(10, 'Preparing notes for export...');

      // Get selected notes data
      const selectedNotes = this.filteredNotes.filter(note =>
        this.selectedExportNotes.has(note.id)
      );

      if (selectedNotes.length === 0) {
        throw new Error('No valid notes found for export');
      }

      this.updateExportProgress(30, 'Organizing notes by domain...');

      // Organize notes by domain (same format as extension)
      const notesByDomain = {};
      selectedNotes.forEach(note => {
        if (!notesByDomain[note.domain]) {
          notesByDomain[note.domain] = [];
        }
        // Clean the note data for export (remove any UI-specific fields)
        const cleanNote = {
          id: note.id,
          title: note.title,
          content: note.content,
          url: note.url,
          domain: note.domain,
          tags: note.tags || [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          pageTitle: note.pageTitle || ''
        };
        notesByDomain[note.domain].push(cleanNote);
      });

      // Add Anchored export identifier and metadata
      const notesData = {
        _anchored: {
          version: "1.0.0",
          exportedAt: new Date().toISOString(),
          source: "dashboard",
          format: "anchored-notes"
        },
        ...notesByDomain
      };

      this.updateExportProgress(60, 'Converting to export format...');

      // Use ExportFormats class to convert and download
      if (!window.ExportFormats) {
        throw new Error('Export functionality not available. Please refresh the page and try again.');
      }

      const exportFormats = new window.ExportFormats();

      this.updateExportProgress(80, 'Generating export file...');

      // Export and download with error handling
      const isSingleNote = selectedNotes.length === 1;
      await exportFormats.exportAndDownload(notesData, exportFormat, isSingleNote);

      this.updateExportProgress(100, 'Export completed successfully!');

      // Show success message
      const formatName = exportFormats.getSupportedFormats()[exportFormat]?.name || exportFormat.toUpperCase();
      this.showNotification(`Successfully exported ${selectedNotes.length} note${selectedNotes.length !== 1 ? 's' : ''} as ${formatName}`, 'success');

      // Close modal after a short delay
      setTimeout(() => {
        this.cancelExport();
      }, 1500);

    } catch (error) {
      console.error('Export failed:', error);
      this.hideExportProgress();
      this.showExportError(error.message);
    }
  }

  showExportError(errorMessage) {
    // Show error with retry option
    const errorHtml = `
      <div class="export-error">
        <h4>Export Failed</h4>
        <p>${this.escapeHtml(errorMessage)}</p>
        <div class="error-actions">
          <button type="button" id="retryExportBtn" class="btn-primary btn-small">Try Again</button>
          <button type="button" id="cancelExportErrorBtn" class="btn-secondary btn-small">Cancel</button>
        </div>
      </div>
    `;

    // Show error in progress area
    const exportProgress = document.getElementById('exportProgress');
    if (exportProgress) {
      exportProgress.innerHTML = errorHtml;
      exportProgress.classList.remove('hidden');

      // Add event listeners for error actions
      const retryBtn = exportProgress.querySelector('#retryExportBtn');
      const cancelBtn = exportProgress.querySelector('#cancelExportErrorBtn');

      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.hideExportProgress();
          this.startExport();
        });
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.hideExportProgress();
        });
      }
    } else {
      // Fallback to notification
      this.showNotification(`Export failed: ${errorMessage}`, 'error');
    }
  }

  showExportProgress() {
    const exportProgress = document.getElementById('exportProgress');
    const startExportBtn = document.getElementById('startExportBtn');
    const exportBtnText = startExportBtn?.querySelector('.export-btn-text');
    const exportBtnLoading = startExportBtn?.querySelector('.export-btn-loading');

    if (exportProgress) {
      exportProgress.classList.remove('hidden');
    }

    if (startExportBtn) {
      startExportBtn.disabled = true;
    }

    if (exportBtnText) {
      exportBtnText.classList.add('hidden');
    }

    if (exportBtnLoading) {
      exportBtnLoading.classList.remove('hidden');
    }
  }

  hideExportProgress() {
    const exportProgress = document.getElementById('exportProgress');
    const startExportBtn = document.getElementById('startExportBtn');
    const exportBtnText = startExportBtn?.querySelector('.export-btn-text');
    const exportBtnLoading = startExportBtn?.querySelector('.export-btn-loading');

    if (exportProgress) {
      exportProgress.classList.add('hidden');
      // Reset progress content to original structure
      exportProgress.innerHTML = `
        <div class="progress-bar">
          <div class="progress-fill" id="exportProgressFill"></div>
        </div>
        <div class="progress-text" id="exportProgressText">Preparing export...</div>
      `;
    }

    if (startExportBtn) {
      startExportBtn.disabled = this.selectedExportNotes.size === 0;
    }

    if (exportBtnText) {
      exportBtnText.classList.remove('hidden');
    }

    if (exportBtnLoading) {
      exportBtnLoading.classList.add('hidden');
    }
  }

  updateExportProgress(percentage, message) {
    const exportProgressFill = document.getElementById('exportProgressFill');
    const exportProgressText = document.getElementById('exportProgressText');

    if (exportProgressFill) {
      exportProgressFill.style.width = `${percentage}%`;
    }

    if (exportProgressText) {
      exportProgressText.textContent = message;
    }
  }



  // Selection Management Methods
  toggleNoteSelection(noteId) {
    if (this.selectedNotes.has(noteId)) {
      this.selectedNotes.delete(noteId);
    } else {
      this.selectedNotes.add(noteId);
    }
    this.updateSelectionUI();
  }

  selectAllNotes() {
    this.filteredNotes.forEach(note => {
      this.selectedNotes.add(note.id);
    });
    this.updateSelectionUI();
    this.renderNotes(); // Re-render to update checkboxes
  }

  deselectAllNotes() {
    this.selectedNotes.clear();
    this.updateSelectionUI();
    this.renderNotes(); // Re-render to update checkboxes
  }



  updateSelectionUI() {
    const selectionInfo = document.getElementById('selectionInfo');
    const selectionActions = document.getElementById('selectionActions');
    const selectedCount = document.getElementById('selectedCount');

    if (this.selectedNotes.size > 0) {
      selectionInfo.classList.remove('hidden');
      selectionActions.classList.remove('hidden');
      selectedCount.textContent = this.selectedNotes.size;
    } else {
      selectionInfo.classList.add('hidden');
      selectionActions.classList.add('hidden');
    }

    // Update select all button text
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
      const allSelected = this.filteredNotes.length > 0 &&
        this.filteredNotes.every(note => this.selectedNotes.has(note.id));
      selectAllBtn.textContent = allSelected ? 'Select All' : 'Select All';
    }
  }

  async handleBulkDelete() {
    if (this.selectedNotes.size === 0) return;

    const selectedCount = this.selectedNotes.size;
    const confirmed = confirm(`Are you sure you want to delete ${selectedCount} selected note${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`);

    if (!confirmed) return;

    const selectedIds = Array.from(this.selectedNotes);

    try {
      // Show loading state
      const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
      if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = true;
        bulkDeleteBtn.textContent = 'Deleting...';
        bulkDeleteBtn.classList.add('loading');
      }

      // Delete from cloud using the same method as single note delete
      if (window.api) {
        // Prepare deletion payload in the same format as single note delete
        const deletionPayload = {
          operation: 'sync',
          notes: [], // No notes to sync, just deletions
          deletions: selectedIds.map(noteId => ({
            id: noteId,
            deletedAt: new Date().toISOString()
          })),
          lastSyncTime: null,
          timestamp: Date.now(),
          _debug: 'bulk-deletion-v1-' + Date.now()
        };

        await window.api.syncNotes(deletionPayload);
      }

      // Remove from local array
      this.notes = this.notes.filter(note => !selectedIds.includes(note.id));

      // Clear selection
      this.selectedNotes.clear();

      // Refresh display
      this.populateDomainFilter();
      this.applyFilters();

      this.showNotification(`${selectedCount} note${selectedCount > 1 ? 's' : ''} deleted successfully!`, 'success');

    } catch (error) {
      // Error deleting notes
      this.showNotification('Failed to delete some notes. Please try again.', 'error');
    } finally {
      // Reset button state
      const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
      if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = false;
        bulkDeleteBtn.textContent = 'Delete Selected';
        bulkDeleteBtn.classList.remove('loading');
      }
    }
  }

  async handleBulkExport() {
    if (this.selectedNotes.size === 0) {
      this.showNotification('Please select at least one note to export', 'warning');
      return;
    }

    // Show the export modal with the currently selected notes pre-selected
    this.showExportModal(this.selectedNotes);
  }

  // Public method to refresh notes (can be called from other modules)
  async refresh() {
    await this.loadNotes();
  }

  // Listen for subscription updates instead of making separate API calls
  listenForSubscriptionUpdates() {
    window.eventBus.on('subscription:updated', (subscriptionData) => {
      // Update UI based on subscription changes
      this.handleUpgradeBanner(subscriptionData);
    });

    // Check if subscription data is already cached in app
    if (window.app?.subscriptionData) {
      this.handleUpgradeBanner(window.app.subscriptionData);
    } else if (window.subscriptionManager?.currentSubscription) {
      this.handleUpgradeBanner(window.subscriptionManager.currentSubscription);
    }
  }

  handleUpgradeBanner(subscriptionData) {
    if (!subscriptionData) {
      this.showUpgradeBanner();
      return;
    }

    const isPremium = subscriptionData.subscription_tier === 'premium';

    if (isPremium) {
      this.hideUpgradeBanner();
    } else {
      // Check if user has dismissed the banner recently
      const dismissed = localStorage.getItem('upgradeBannerDismissed');
      const dismissedTime = dismissed ? parseInt(dismissed) : 0;
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

      if (dismissedTime < oneDayAgo) {
        this.showUpgradeBanner();
      }
    }
  }

  showUpgradeBanner() {
    const banner = document.getElementById('upgradeBanner');
    if (banner) {
      banner.classList.remove('hidden');

      const upgradeBtn = document.getElementById('upgradeFromBannerBtn');
      const dismissBtn = document.getElementById('dismissBannerBtn');

      if (upgradeBtn && !upgradeBtn.hasAttribute('data-listener')) {
        upgradeBtn.setAttribute('data-listener', 'true');
        upgradeBtn.addEventListener('click', () => {
          if (window.subscriptionManager) {
            window.subscriptionManager.createCheckoutSession();
          } else {
            window.location.href = '/account';
          }
        });
      }

      if (dismissBtn && !dismissBtn.hasAttribute('data-listener')) {
        dismissBtn.setAttribute('data-listener', 'true');
        dismissBtn.addEventListener('click', () => {
          this.dismissUpgradeBanner();
        });
      }
    }
  }

  hideUpgradeBanner() {
    const banner = document.getElementById('upgradeBanner');
    if (banner) {
      banner.classList.add('hidden');
    }
  }

  dismissUpgradeBanner() {
    this.hideUpgradeBanner();
    // Remember dismissal for 24 hours
    localStorage.setItem('upgradeBannerDismissed', Date.now().toString());
  }
}

// Initialize dashboard module when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/dashboard')) {
    window.dashboard = new Dashboard();
  }
});

window.Dashboard = Dashboard;