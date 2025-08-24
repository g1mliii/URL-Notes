// URL Notes Extension - Popup Script

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
    this.themeManager = new ThemeManager();
    // Use IndexedDB storage instead of Chrome storage for sync compatibility
    this.storageManager = window.notesStorage || new StorageManager();
    
    // Ensure EditorManager is available before creating instance
    if (typeof EditorManager === 'undefined') {
      console.error('EditorManager not available, delaying initialization');
      setTimeout(() => this.constructor(), 100);
      return;
    }
    
    this.editorManager = new EditorManager(this.storageManager);
    this.settingsManager = new SettingsManager(this.storageManager);
    // Notes list/render manager (modularized)
    this.notesManager = new NotesManager(this);
    // Debounced draft saver for editorState caching
    this.saveDraftDebounced = Utils.debounce(() => this.saveEditorDraft(), 150);
    // Enable compact layout to ensure everything fits without scroll/clipping
    try { document.documentElement.setAttribute('data-compact', '1'); } catch {}
    
    this.init();
  }

  // Determine if a note belongs to the current page
  isCurrentPageNote(note) {
    try {
      if (!note || !note.url || !this.currentSite || !this.currentSite.url) return false;
      const noteKey = this.normalizePageKey(note.url);
      const currentKey = this.normalizePageKey(this.currentSite.url);
      return noteKey === currentKey;
    } catch (_) {
      return false;
    }
  }


  // Get current tab information and update UI/context
  async loadCurrentSite() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.startsWith('http')) {
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
          const displayDomain = (this.currentSite.domain || '').replace(/^www\./, '');
          domainEl.textContent = displayDomain;
          domainEl.title = displayDomain;
        }
        if (urlEl) {
          urlEl.textContent = this.currentSite.url;
          urlEl.title = this.currentSite.url;
        }

        // Apply cached accent immediately if available
        try {
          const cached = await this.themeManager.getCachedAccent(this.currentSite.domain);
          if (cached) this.themeManager.setAccentVariables(cached);
        } catch (_) { }
      } else {
        // No valid tab or URL (e.g., extension popup opened from management page)
        // Note: Removed verbose logging for cleaner console
        this.currentSite = null;
        
        // Update UI to show no site context
        const siteIcon = document.querySelector('.site-icon');
        if (siteIcon) {
          siteIcon.innerHTML = `
            <div class="site-fallback" aria-label="No site context">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M3 12h18"></path>
                <path d="M12 3a9 9 0 0 1 0 18 9 9 0 0 1 0-18z"></path>
              </svg>
            </div>`;
        }
        
        const domainEl = document.getElementById('siteDomain');
        const urlEl = document.getElementById('siteUrl');
        if (domainEl) {
          domainEl.textContent = 'No site context';
          domainEl.title = 'Extension opened outside of web page';
        }
        if (urlEl) {
          urlEl.textContent = 'No active tab';
          urlEl.title = 'Extension opened outside of web page';
        }
      }
    } catch (error) {
      console.error('Error loading current site:', error);
      this.currentSite = null;
      
      // Update UI to show error state
      const domainEl = document.getElementById('siteDomain');
      const urlEl = document.getElementById('siteUrl');
      if (domainEl) {
        domainEl.textContent = 'Error loading site';
        domainEl.title = 'Failed to load current site information';
      }
      if (urlEl) {
        urlEl.textContent = 'Error';
        urlEl.title = 'Failed to load current site information';
      }
    }
  }

  // Handle real-time note updates from context menu
  async handleRealTimeNoteUpdate(message) {
    try {
      const { note, type } = message;
      
      if (type === 'new_note') {
        // New note created - refresh the notes list and open it
        await this.refreshNotesFromStorage();
        this.currentNote = note;
        await this.openEditor(true);
        this.persistEditorOpen(true);
        this.saveEditorDraft();
      } else if (type === 'append_selection') {
        // Note was appended to - update if it's currently open
        if (this.currentNote && this.currentNote.id === note.id) {
          // Update current note with new content
          this.currentNote = { ...note };
          
          // Refresh editor content if it's open
          const editor = document.getElementById('noteEditor');
          if (editor && editor.style.display !== 'none') {
            const titleHeader = document.getElementById('noteTitleHeader');
            const contentInput = document.getElementById('noteContentInput');
            const tagsInput = document.getElementById('tagsInput');
            
            if (titleHeader) titleHeader.value = this.currentNote.title || '';
            if (contentInput) contentInput.innerHTML = this.buildContentHtml(this.currentNote.content || '');
            if (tagsInput) tagsInput.value = (this.currentNote.tags || []).join(', ');
          }
          
          // Show a subtle notification
          Utils.showToast(`Note updated with new content`, 'success');
        }
        
        // Refresh notes list to show updated content
        await this.refreshNotesFromStorage();
      }
    } catch (error) {
      console.error('Error handling real-time note update:', error);
    }
  }

  // Refresh notes from storage and update UI
  async refreshNotesFromStorage() {
    try {
      this.allNotes = await this.loadNotes();
      this.render();
    } catch (error) {
      console.error('Error refreshing notes from storage:', error);
    }
  }

  async init() {
    // Wait for IndexedDB storage to be ready
    if (window.notesStorage && typeof window.notesStorage.init === 'function') {
      try {
        await window.notesStorage.init();
        // Note: Removed verbose logging for cleaner console
      } catch (error) {
        console.warn('Failed to initialize IndexedDB storage, falling back to Chrome storage:', error);
        this.storageManager = new StorageManager();
      }
    }
    
    this.premiumStatus = await getPremiumStatus();
    // Apply premium-dependent UI immediately
    try { await this.updatePremiumUI(); } catch (_) {}
    
    // RESTORE CACHED VALUES IMMEDIATELY to prevent visual shifts
    await this.restoreCachedUIState();
    
    await this.loadCurrentSite();
    this.setupEventListeners();
    await this.themeManager.setupThemeDetection();
    if (this.currentSite) {
      await this.themeManager.applyAccentFromFavicon(this.currentSite);
    }
    // Initialize Supabase session from storage so auth UI persists across popup reopen
    try {
      if (window.supabaseClient && typeof window.supabaseClient.init === 'function') {
        await window.supabaseClient.init();
        // Refresh premium status after Supabase client is initialized
        this.premiumStatus = await getPremiumStatus();
        await this.updatePremiumUI();
      }
    } catch (e) {
      console.warn('Supabase init failed:', e);
    }
    
    // Initialize sync engine if available
    try {
      if (window.syncEngine && typeof window.syncEngine.init === 'function') {
        await window.syncEngine.init();
      }
    } catch (e) {
      console.warn('Sync engine init failed:', e);
    }
    // Listen for global auth/tier changes
    try {
      window.eventBus?.on('auth:changed', (payload) => this.handleAuthChanged(payload));
      window.eventBus?.on('tier:changed', (status) => this.handleTierChanged(status));
    } catch (_) {}
    
    // Listen for sync events
    try {
      window.eventBus?.on('notes:synced', (payload) => this.handleNotesSynced(payload));
      window.eventBus?.on('sync:error', (payload) => this.handleSyncError(payload));
      window.eventBus?.on('sync:success', (payload) => this.handleSyncSuccess(payload));
    } catch (_) {}
    
    // Listen for context menu messages from background script
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'context_menu_note_saved') {
          this.handleContextMenuNote(message.note);
        } else if (message.action === 'context_menu_draft_updated') {
          this.handleContextMenuDraftUpdate(message.note);
        }
      });
    } catch (_) {}
    
    // Setup conflict banner event listeners
    this.setupConflictBannerListeners();
    
    // Load notes first, before any rendering
    this.allNotes = await this.loadNotes();
    
    await this.settingsManager.loadFontSetting();
    // Initialize settings UI once (font controls, preview, etc.)
    this.settingsManager.initSettings();
    Utils.checkStorageQuota();
    this.maybeShowQuotaWarning();
    // Note: These methods don't exist in editorManager, they're in the popup class
    // this.updateCharCount();
    // this.updateNotePreview();
    
    // Restore last UI state (filter + possibly open editor)
    try {
      const { lastFilterMode, editorState, lastAction, lastSearchQuery } = await chrome.storage.local.get(['lastFilterMode', 'editorState', 'lastAction', 'lastSearchQuery']);
      if (lastFilterMode === 'site' || lastFilterMode === 'page' || lastFilterMode === 'all_notes') {
        this.filterMode = lastFilterMode;
      }
      
      // Mark popup as open for context menu detection
      if (editorState) {
        editorState.open = true;
        // Preserve wasEditorOpen flag - don't clear it
        // This allows unsaved drafts to be restored when popup reopens
        // The flag will only be cleared when notes are explicitly saved/deleted
        await chrome.storage.local.set({ editorState });
        console.log('Popup: Updated existing editorState, preserved wasEditorOpen flag');
      } else {
        const newEditorState = { open: true, wasEditorOpen: false };
        await chrome.storage.local.set({ editorState: newEditorState });
        console.log('Popup: Created new editorState:', newEditorState);
      }
      
      // Set filter without rendering first
      this.switchFilter(this.filterMode, { persist: false, render: false });
      
      // Restore search query if present
      if (typeof lastSearchQuery === 'string' && lastSearchQuery.length > 0) {
        this.searchQuery = lastSearchQuery;
        const searchInputEl = document.getElementById('searchInput');
        const searchClearEl = document.getElementById('searchClear');
        if (searchInputEl) searchInputEl.value = lastSearchQuery;
        if (searchClearEl) searchClearEl.style.display = 'block';
      }
      
      // Now render after everything is set up
      this.render();
      // Priority 0: explicit keyboard command to create a new note
      if (lastAction && lastAction.type === 'new_note') {
        if (this.currentSite) {
          // Create new note and open editor
          this.createNewNote();
          chrome.storage.local.remove('lastAction');
          return;
        } else {
          console.warn('Cannot create new note: No valid site context');
          chrome.storage.local.remove('lastAction');
        }
      }
      
      // Priority 0.5: context menu created note - open it in editor
      if (lastAction && lastAction.type === 'new_from_selection') {
        // Find the note that was created by context menu
        let createdNote = this.allNotes.find(n => n.id === lastAction.noteId);
        
        // If not found in IndexedDB, check chrome.storage.local (context menu storage)
        if (!createdNote) {
          try {
            const allData = await chrome.storage.local.get(null);
            for (const [key, value] of Object.entries(allData)) {
              if (key.startsWith('note_') && value && value.id === lastAction.noteId) {
                createdNote = value;
                console.log('Found context menu note in chrome.storage.local:', createdNote);
                break;
              }
            }
          } catch (error) {
            console.error('Failed to check chrome.storage.local for context menu note:', error);
          }
        }
        
        if (createdNote) {
          // Move note from chrome.storage.local to IndexedDB if needed
          if (createdNote.domain && createdNote.content) {
            try {
              await window.notesStorage.saveNote(createdNote);
              console.log('Moved context menu note to IndexedDB:', createdNote.id);
              
              // Remove from chrome.storage.local
              const key = `note_${createdNote.id}`;
              await chrome.storage.local.remove(key);
              
              // Reload notes to include the new one
              this.allNotes = await this.loadNotes();
            } catch (error) {
              console.error('Failed to move context menu note to IndexedDB:', error);
            }
          }
          
          // Open the created note in editor
          this.currentNote = { ...createdNote };
          await this.openEditor(true);
          chrome.storage.local.remove('lastAction');
          return;
        }
      }
      // Priority 1: incoming context menu action
      if (lastAction && lastAction.domain) {
        // Check if this is a draft note update
        if (lastAction.isDraft) {
          // For draft notes, just update the current note content
          if (this.currentNote && this.currentNote.id === lastAction.noteId) {
            // Update the current note with the new content
            const target = this.allNotes.find(n => n.id === lastAction.noteId);
            if (target) {
              this.currentNote = { ...target };
              // Update the editor content
              const contentInput = document.getElementById('noteContentInput');
              if (contentInput) {
                contentInput.innerHTML = this.buildContentHtml(this.currentNote.content || '');
              }
              // Update the draft in storage
              await this.saveEditorDraft();
              Utils.showToast('Text appended to current note', 'success');
            }
          } else {
            // If no current note, check if we need to open the editor
            const target = this.allNotes.find(n => n.id === lastAction.noteId);
            if (target) {
              this.currentNote = { ...target };
              await this.openEditor(true);
              Utils.showToast('Text appended to note', 'success');
            }
          }
          // Remove action so it doesn't re-trigger
          chrome.storage.local.remove('lastAction');
          return;
        }
        
        // Regular note action - try to locate the target note by id in loaded notes
        const target = this.allNotes.find(n => n.id === lastAction.noteId);
        if (target) {
          this.currentNote = { ...target };
          // Do NOT clear editorState; we want reopen to work if user closes popup
          await this.openEditor(true);
          // Ensure open flag and draft are persisted immediately
          this.persistEditorOpen(true);
          this.saveEditorDraft();
          // Remove action so it doesn't re-trigger on next open
          chrome.storage.local.remove('lastAction');
          return;
        }
      }
      // Priority 2: previously open editor with cached draft
      // Only auto-open if there's a draft and the editor was actually open when popup closed
      // AND the draft was created/updated very recently (within last 5 minutes)
      if (editorState && editorState.noteDraft && editorState.wasEditorOpen) {
        // Check if the draft is recent enough to auto-open
        const now = Date.now();
        const draftTime = editorState.noteDraft.updatedAt ? new Date(editorState.noteDraft.updatedAt).getTime() : 0;
        const timeDiff = now - draftTime;
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        if (timeDiff < fiveMinutes) {
          console.log('Popup: Restoring recently active draft (within 5 minutes)');
        this.currentNote = { ...editorState.noteDraft };
        if (this.currentSite) {
          this.currentNote.domain = this.currentNote.domain || this.currentSite.domain;
          this.currentNote.url = this.currentSite.url;
          this.currentNote.pageTitle = this.currentSite.title;
        }
        await this.openEditor(true);
        } else {
          console.log('Popup: Draft found but too old to auto-open, clearing stale draft');
          // Draft is too old, clear it
          await chrome.storage.local.remove('editorState');
        }
      } else if (editorState && editorState.noteDraft) {
        console.log('Popup: Draft found but wasEditorOpen flag not set, not auto-opening');
        // Don't auto-open, just clear the draft since it's not meant to be restored
        await chrome.storage.local.remove('editorState');
      }
    } catch (_) {
      // Fallback to default filter
      this.switchFilter(this.filterMode, { persist: false, render: false });
      // Render after fallback setup
      this.render();
    }

    // Ad bar UI only (no backend init)
  }

  // NEW: Restore cached UI state immediately to prevent visual shifts
  async restoreCachedUIState() {
    try {
      // 1. Restore filter mode and search query immediately
      const { lastFilterMode, lastSearchQuery } = await chrome.storage.local.get(['lastFilterMode', 'lastSearchQuery']);
      if (lastFilterMode === 'site' || lastFilterMode === 'page' || lastFilterMode === 'all_notes') {
        this.filterMode = lastFilterMode;
      }
      if (typeof lastSearchQuery === 'string' && lastSearchQuery.length > 0) {
        this.searchQuery = lastSearchQuery;
      }

      // 2. Set search placeholder immediately based on filter mode
      const searchInput = document.querySelector('.search-input');
      if (searchInput) {
        const placeholder =
          this.filterMode === 'all_notes' ? 'Search All Notes' :
          this.filterMode === 'site' ? 'Search This Site' :
          'Search This Page';
        searchInput.setAttribute('placeholder', placeholder);
      }

      // 3. Restore search input value immediately if exists
      if (this.searchQuery && searchInput) {
        searchInput.value = this.searchQuery;
        const searchClearEl = document.getElementById('searchClear');
        if (searchClearEl) searchClearEl.style.display = 'block';
      }

      // 4. Restore extension shortcuts immediately
      await this.restoreShortcutsImmediately();

      // 5. Set filter buttons active state immediately
      this.updateFilterButtonStates();

    } catch (error) {
      console.warn('Failed to restore cached UI state:', error);
    }
  }

  // NEW: Restore shortcuts immediately to prevent visual shift
  async restoreShortcutsImmediately() {
    try {
      // Try to get shortcuts from storage first (faster)
      const { cachedShortcuts } = await chrome.storage.local.get(['cachedShortcuts']);
      if (cachedShortcuts && cachedShortcuts.open && cachedShortcuts.new) {
        const openEl = document.getElementById('shortcutOpenValue');
        const newEl = document.getElementById('shortcutNewValue');
        
        if (openEl) openEl.textContent = cachedShortcuts.open;
        if (newEl) newEl.textContent = cachedShortcuts.new;
      }

      // Then get fresh shortcuts from chrome.commands
      const actions = await chrome.commands.getAll();
      const openAction = actions.find(a => a.name === '_execute_action');
      const createAction = actions.find(a => a.name === '_execute_browser_action');

      // Update shortcut display elements
      const openShortcut = openAction && openAction.shortcut ? openAction.shortcut : 'Not set';
      const newShortcut = createAction && createAction.shortcut ? createAction.shortcut : 'Not set';

      const openEl = document.getElementById('shortcutOpenValue');
      const newEl = document.getElementById('shortcutNewValue');
      
      if (openEl) openEl.textContent = openShortcut;
      if (newEl) newEl.textContent = newShortcut;

      // Cache the shortcuts for next time
      await chrome.storage.local.set({ 
        cachedShortcuts: { open: openShortcut, new: newShortcut } 
      });

    } catch (error) {
      console.warn('Failed to restore shortcuts immediately:', error);
      // Only set fallback if no cached values were loaded
      const { cachedShortcuts } = await chrome.storage.local.get(['cachedShortcuts']);
      if (!cachedShortcuts || !cachedShortcuts.open || !cachedShortcuts.new) {
        const openEl = document.getElementById('shortcutOpenValue');
        const newEl = document.getElementById('shortcutNewValue');
        
        if (openEl) openEl.textContent = 'Not set';
        if (newEl) newEl.textContent = 'Not set';
      }
    }
  }

  // NEW: Update filter button states immediately
  updateFilterButtonStates() {
    try {
      // Remove active class from all filter buttons
      document.querySelectorAll('.filter-option').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Add active class to current filter button
      const buttonId = {
        'site': 'showAllBtn',
        'page': 'showPageBtn',
        'all_notes': 'showAllNotesBtn'
      }[this.filterMode];
      
      if (buttonId) {
        const activeButton = document.getElementById(buttonId);
        if (activeButton) activeButton.classList.add('active');
      }

      // Set data-view on root for view-specific styling
      document.documentElement.setAttribute('data-view', this.filterMode);
      
    } catch (error) {
      console.warn('Failed to update filter button states:', error);
    }
  }

  // Handle auth change: refresh premium from storage (set by api.js) and update UI
  async handleAuthChanged(payload) {
    try {
      // Refresh premium status from both storage and Supabase client
      this.premiumStatus = await getPremiumStatus();
      await this.updatePremiumUI();
      // Also refresh notes to show version history buttons if premium
      if (this.premiumStatus?.isPremium) {
        this.render();
      }
    } catch (_) {}
  }

  // Handle tier change from api.js with status payload { active, tier }
  async handleTierChanged(status) {
    try {
      const isPremium = !!(status && status.active && (status.tier || 'premium') !== 'free');
      this.premiumStatus = { isPremium };
      await this.updatePremiumUI();
    } catch (_) {}
  }

  // Handle notes synced event
  handleNotesSynced(payload) {
    try {
      if (payload.source === 'cloud') {
        // Refresh notes list when cloud notes are pulled
        this.loadNotes();
      }
      // Show sync status in UI
      this.updateSyncStatus(payload);
    } catch (_) {}
  }

  // Handle sync error
  handleSyncError(payload) {
    try {
      Utils.showToast(payload.message, 'error');
    } catch (_) {}
  }

  // Handle sync success
  handleSyncSuccess(payload) {
    try {
      Utils.showToast(payload.message, 'success');
    } catch (_) {}
  }
  
  // Handle context menu notes from background script
  async handleContextMenuNote(note) {
    try {
      // Save the note using the proper storage system
      await window.notesStorage.saveNote(note);
      
      // Refresh the notes list
      this.allNotes = await this.loadNotes();
      this.render();
      
      // Show success message
      Utils.showToast('Note saved from context menu', 'success');
    } catch (error) {
      console.error('Failed to handle context menu note:', error);
      Utils.showToast('Failed to save note from context menu', 'error');
    }
  }
  
  // Handle context menu draft updates from background script
  async handleContextMenuDraftUpdate(note) {
    try {
      // Update the current note if it's the same one
      if (this.currentNote && this.currentNote.id === note.id) {
        this.currentNote = { ...note };
        
        // Update the editor content to show the appended text
        const contentInput = document.getElementById('noteContentInput');
        if (contentInput) {
          contentInput.innerHTML = this.buildContentHtml(note.content || '');
        }
        
        // Update the draft in storage with the new content
        await this.saveEditorDraft();
        
        // Show success message
        Utils.showToast('Text appended to current note', 'success');
      } else {
        // If no current note, the draft was updated in storage by the background script
        // When the editor opens later, it will restore the updated draft content
        Utils.showToast('Text appended to note', 'success');
      }
    } catch (error) {
      console.error('Failed to handle context menu draft update:', error);
      Utils.showToast('Failed to update draft note', 'error');
    }
  }

  // Update sync status in UI
  updateSyncStatus(payload) {
    try {
      const syncStatusEl = document.getElementById('syncStatus');
      if (syncStatusEl) {
        const timestamp = new Date(payload.timestamp).toLocaleTimeString();
        syncStatusEl.textContent = `Last sync: ${timestamp}`;
        syncStatusEl.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
          syncStatusEl.style.display = 'none';
        }, 5000);
      }
    } catch (_) {}
  }

  // Setup conflict banner event listeners
  setupConflictBannerListeners() {
    const keepMineBtn = document.getElementById('keepMineBtn');
    const useServerBtn = document.getElementById('useServerBtn');
    
    if (keepMineBtn) {
      keepMineBtn.addEventListener('click', () => this.handleConflictResolution('local'));
    }
    
    if (useServerBtn) {
      useServerBtn.addEventListener('click', () => this.handleConflictResolution('server'));
    }
  }

  // Handle conflict resolution
  handleConflictResolution(choice) {
    try {
      // Hide the conflict banner
      const banner = document.getElementById('conflictBanner');
      if (banner) {
        banner.style.display = 'none';
      }
      
      // Emit event for sync engine to handle
      window.eventBus?.emit('conflict:resolved', { choice });
      
      Utils.showToast(`Using ${choice === 'local' ? 'local' : 'server'} version`, 'success');
    } catch (_) {}
  }

  // Show conflict banner
  showConflictBanner(message = 'Sync conflict detected') {
    try {
      const banner = document.getElementById('conflictBanner');
      const messageEl = document.getElementById('conflictMessage');
      
      if (banner && messageEl) {
        messageEl.textContent = message;
        banner.style.display = 'block';
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
          banner.style.display = 'none';
        }, 30000);
      }
    } catch (_) {}
  }

  // Refresh premium flag from chrome.storage.local 'userTier'
  async refreshPremiumFromStorage() {
    try {
      const { userTier } = await chrome.storage.local.get(['userTier']);
      const isPremium = !!(userTier && userTier !== 'free');
      this.premiumStatus = { isPremium };
      await this.updatePremiumUI();
    } catch (_) {}
  }

  // Load all notes from storage into the master list
  async loadNotes() {
    try {
      // Use IndexedDB storage if available, fallback to Chrome storage
      if (this.storageManager === window.notesStorage && typeof this.storageManager.getAllNotesForDisplay === 'function') {
        // Use IndexedDB storage - get notes for display (excludes deleted notes)
        this.allNotes = await this.storageManager.getAllNotesForDisplay();
      } else {
        // Fallback to Chrome storage
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
      }
      
      // Ensure allNotes is always an array
      if (!Array.isArray(this.allNotes)) {
        this.allNotes = [];
      }
      
      return this.allNotes;
    } catch (error) {
      console.error('Error loading notes:', error);
      this.allNotes = []; // Fallback to an empty list on error
      return this.allNotes;
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Listen for real-time note updates from context menu
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'note_updated') {
        this.handleRealTimeNoteUpdate(message);
      }
    });
    // Filter between all notes and page-specific (deduplicated bindings)
    const on = (id, evt, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evt, handler);
    };
    [
      ['showAllBtn', 'site'],
      ['showPageBtn', 'page'],
      ['showAllNotesBtn', 'all_notes']
    ].forEach(([id, mode]) => on(id, 'click', () => this.switchFilter(mode)));

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    
    // Debounce render function
    const debouncedRender = Utils.debounce(() => this.render(), 200);

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      debouncedRender();
      searchClear.style.display = this.searchQuery ? 'block' : 'none';
      try { chrome.storage.local.set({ lastSearchQuery: this.searchQuery }); } catch (_) {}
    });
    
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      this.render();
      searchClear.style.display = 'none';
    });

    // Add new note
    document.getElementById('addNoteBtn').addEventListener('click', () => {
      // Use the main createNewNote method which has better error handling
      this.createNewNote();
    });
    

    // Editor controls
    // Shared save handler to avoid duplication across Back and Save buttons
    const saveStandard = () => this.saveCurrentNote({
      clearDraftAfterSave: false,
      closeEditorAfterSave: false,
      showToast: true,
      switchFilterAfterSave: true
    }).catch(() => {});
    document.getElementById('backBtn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Close editor immediately (no draft clearing) for instant UI response
      const notesContainer = document.querySelector('.notes-container');
      this.editorManager.closeEditor({ clearDraft: false });
      // Animate notes list entrance
      if (notesContainer) {
        notesContainer.classList.add('panel-fade-in');
        setTimeout(() => notesContainer.classList.remove('panel-fade-in'), 220);
      }
      // Use same save path as Save button but non-blocking and without clearing draft/closing again
      saveStandard();
    });
    
    document.getElementById('saveNoteBtn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Same functionality as back button: save and close editor
      const notesContainer = document.querySelector('.notes-container');
      this.editorManager.closeEditor({ clearDraft: false });
      // Animate notes list entrance
      if (notesContainer) {
        notesContainer.classList.add('panel-fade-in');
        setTimeout(() => notesContainer.classList.remove('panel-fade-in'), 220);
      }
      // Use same save path as Back button
      saveStandard();
    });
    
    document.getElementById('deleteNoteBtn').addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    // Editor inputs
    document.getElementById('noteTitleHeader').addEventListener('input', () => {
      this.saveDraftDebounced();
    });
    
    const contentInput = document.getElementById('noteContentInput');
    contentInput.addEventListener('input', () => {
      this.saveDraftDebounced();
    });
    // Paste sanitization: allow only text, links, and line breaks
    contentInput.addEventListener('paste', (e) => this.handleEditorPaste(e));
    // Intercept link clicks inside the editor
    contentInput.addEventListener('click', (e) => this.handleEditorLinkClick(e));
    
    // Skip textarea-specific key handling; editor is now contenteditable
    
    document.getElementById('tagsInput').addEventListener('input', () => {
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

    // Developer tools removed: mock data generation/cleanup and storage stress tools

    // Font selector
    document.getElementById('fontSelector').addEventListener('change', (e) => {
      this.saveFontSetting(e.target.value);
    });





  // Refresh notes when storage changes (e.g., context menu adds a note)
  // Debounce to avoid thrashing on bulk updates/imports
  const debouncedRefresh = Utils.debounce(async () => {
      // Don't refresh during filter transitions to prevent pop-in effect
      if (this._isFilterTransitioning) return;
      
      this.allNotes = await this.loadNotes();
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

                         // Note: These methods don't exist in editorManager
          }
        }
      }
    }, 120);

    // Listen for in-app notes events to refresh immediately (authored changes)
    try {
      const refresh = () => debouncedRefresh();
      window.eventBus?.on('notes:created', refresh);
      window.eventBus?.on('notes:updated', refresh);
      window.eventBus?.on('notes:deleted', refresh);
      window.eventBus?.on('notes:domain_deleted', refresh);
      window.eventBus?.on('notes:imported', refresh);
    } catch (_) {}

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      // Ignore editorState-only changes (draft autosave), which shouldn't trigger a UI refresh
      const changedKeys = Object.keys(changes || {});
      if (changedKeys.length > 0 && changedKeys.every(k => k === 'editorState' || k === 'allNotesOpenDomains' || k === 'lastSearchQuery')) {
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
          // Don't change wasEditorOpen flag here - preserve it for next open
          // Just mark popup as closed
        } else {
          // No current note, so editor wasn't open
          this.persistEditorOpen(false);
        }
        
        // Mark popup as closed for context menu detection
        chrome.storage.local.get(['editorState']).then(({ editorState }) => {
          if (editorState) {
            editorState.open = false;
            // Preserve wasEditorOpen flag - don't clear it
            chrome.storage.local.set({ editorState });
            console.log('Popup: Set editorState.open = false on close, preserved wasEditorOpen flag');
          }
        });
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


  // Switch between different note filters
  // options.persist: whether to store lastFilterMode (default: true)
  async switchFilter(filter, options = { persist: true, render: true }) {
    // Prevent rapid filter switching
    if (this.filterMode === filter) return;
    
    // Set flag to prevent other renders during filter transition
    this._isFilterTransitioning = true;
    
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
    const filterBtn = document.getElementById(buttonId);
    if (filterBtn) filterBtn.classList.add('active');

    // Set data-view on root for view-specific styling (compact site/page)
    document.documentElement.setAttribute('data-view', filter);

    // Search placeholder is now handled centrally in restoreCachedUIState to prevent caching conflicts
    // No need to update it here anymore

    // Ensure notes are loaded before rendering to prevent pop-in effect
    if (options.render !== false) {
      // Load notes first if not already loaded
      if (!this.allNotes || !Array.isArray(this.allNotes)) {
        await this.loadNotes();
      }
      // Now render with fresh data
      this.render();
    }
    
    // Persist last chosen filter unless suppressed
    if (!options || options.persist !== false) {
      chrome.storage.local.set({ lastFilterMode: this.filterMode });
    }
    
    // Clear filter transition flag after a delay
    setTimeout(() => {
      this._isFilterTransitioning = false;
    }, 300);
  }

  // Delegate notes rendering to NotesManager (modularized)
  render() {
    const t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    this.notesManager.render();
    const t1 = (window.performance && performance.now) ? performance.now() : Date.now();
    // Note: Removed verbose render timing logging for cleaner console
  }

  // Proactive, non-blocking storage warnings using toast only (no dialog to avoid API mismatch)
  async maybeShowQuotaWarning() {
    try {
      if (!this.storageManager || !this.storageManager.checkStorageQuota) return;
      const est = await this.storageManager.checkStorageQuota();
      if (!est || typeof est.percentage !== 'number') return;
      const pct = est.percentage;
      const band = pct >= 95 ? 'critical' : pct >= 90 ? 'high' : pct >= 75 ? 'warn' : 'ok';
      if (band === 'ok') return;
      if (this._lastQuotaWarnBand === band) return;
      this._lastQuotaWarnBand = band;
      const msg = band === 'critical'
        ? `Storage almost full: ${est.usageInMB}/${est.quotaInMB} MB (${pct}%). Saves may fail.`
        : band === 'high'
        ? `Storage very high: ${est.usageInMB}/${est.quotaInMB} MB (${pct}%).`
        : `Storage usage high: ${est.usageInMB}/${est.quotaInMB} MB (${pct}%).`;
      Utils.showToast(msg, 'info');
    } catch (_) { /* noop */ }
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

    // Only clear if there are other children to prevent unnecessary clearing
    if (notesList.children.length > 0) {
      notesList.innerHTML = '';
    }
    notesList.classList.add('notes-fade-in');

    sortedDomains.forEach(domain => {
      const { notes: domainNotes, tags: domainTags } = groupedData[domain];

      const domainGroup = document.createElement('details');
      domainGroup.className = 'domain-group';
      // Expand top two results only when searching
      const domainIndex = sortedDomains.indexOf(domain);
      domainGroup.open = this.searchQuery && domainIndex < 2;
      
      // Domain group created

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

      // No pre-open suppression; restore original behavior
      
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
        el.classList.add('note-item-stagger');
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
    const previewHtml = this.buildPreviewHtml(note.content);
    
    // Show page indicator for current page notes when not in page filter mode
    const pageIndicator = (this.filterMode !== 'page' && this.isCurrentPageNote(note)) ?
      '<span class="page-indicator" data-tooltip="Current page note">•</span>' : '';

    // Check if user has premium access for version history button
    const hasVersionHistory = this.premiumStatus?.isPremium || false;

    noteDiv.innerHTML = `
      <div class="note-content">
        <div class="note-main">
          <h4 class="note-title">${pageIndicator}${note.title || 'Untitled'}</h4>
          <div class="note-preview">${previewHtml}</div>
        </div>
        <div class="note-sidebar">
          <div class="note-actions">
            <button class="icon-btn open-page-btn" data-url="${note.url}" title="Open page">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            ${hasVersionHistory ? `
              <button class="icon-btn version-history-btn" title="Version History">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>
                </svg>
              </button>
            ` : ''}
            <button class="icon-btn delete-note-btn" data-note-id="${note.id}" title="Delete note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2 2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2 2 0 0,1 2,2v2"></path>
                <line x1="10" y1="11" x2="10" y2="3"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
          <div class="note-meta">
            <span class="note-date">${Utils.formatDate(note.updatedAt)}</span>
            <span class="note-domain">${note.domain}</span>
          </div>
          ${note.tags && note.tags.length > 0 ? `<div class="note-tags">${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    `;

    // Add open button event listener (only present in non-page views)
    const openBtn = noteDiv.querySelector('.open-page-btn');
    if (openBtn) {
      // Debug: Log note data when setting up the button
      console.log('Popup: Setting up open button for note:', {
        id: note.id,
        hasUrl: !!note.url,
        url: note.url,
        hasDomain: !!note.domain,
        domain: note.domain,
        title: note.title
      });
      
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const displayText = note.title || note.pageTitle || '';
        console.log('Popup: Opening note URL:', note.url, 'for note:', note.id);
        this.openLinkAndHighlight(note.url, displayText);
      });
    }

    // Add version history button event listener
    const versionBtn = noteDiv.querySelector('.version-history-btn');
    if (versionBtn) {
      versionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Note: Removed verbose logging for cleaner console
        // Call the version history method from notes.js module
        if (window.notesManager && window.notesManager.showVersionHistory) {
          window.notesManager.showVersionHistory(note);
        } else {
          console.warn('Version history functionality not available');
        }
      });
    }

    // Add delete button event listener (two-tap confirm on same icon)
    const deleteBtn = noteDiv.querySelector('.delete-note-btn');
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
      this.editorManager.updateCharCount();
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
      // For "This Page" filter, be more flexible - just use hostname + base path
      // Remove query params and fragments for looser matching
      return `${host}${path}`;
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
        // Wait for content script to be ready, then highlight
        await this.awaitContentReady(targetTab.id, { timeoutMs: 4000, intervalMs: 200 });
        sendMessageWithRetry(targetTab.id, { action: 'highlightText', href: urlToOpen, text }, [100, 300, 600, 1200]);
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
    
    // Aggressively clear ALL cached state to prevent any caching issues
    this.currentNote = null;
    if (this.editorState) {
      this.editorState.noteDraft = null;
      this.editorState.open = false;
    }
    
    // Clear any stored drafts
    if (window.notesStorage && window.notesStorage.clearEditorDraft) {
      try {
        // Clear all drafts to ensure clean state
        window.notesStorage.clearAllEditorDrafts();
      } catch (error) {
        console.warn('Failed to clear editor drafts:', error);
      }
    }
    
    // Clear editor inputs directly
    const titleInput = document.getElementById('noteTitleHeader');
    const contentInput = document.getElementById('noteContentInput');
    const tagsInput = document.getElementById('tagsInput');
    
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.innerHTML = '';
    if (tagsInput) tagsInput.value = '';
    
    let noteContext;
    
    // Check if we have a valid currentSite context
    if (!this.currentSite || !this.currentSite.domain) {
      // Note: Removed verbose logging for cleaner console
      // Create a general note when no site context is available
      noteContext = {
        domain: 'general',
        url: 'chrome://extensions',
        title: 'General Note'
      };
    } else {
      noteContext = this.currentSite;
    }
    
    const newNote = {
      id: this.generateId(),
      title: '',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      domain: noteContext.domain,
      url: noteContext.url,
      pageTitle: noteContext.title
    };

    this.currentNote = newNote;
    this.openEditor();
  }
  

  // Open existing note
  async openNote(note) {
    // Create a deep copy to avoid reference issues
    this.currentNote = JSON.parse(JSON.stringify(note));
    
    // Clear ALL cached editor state to prevent caching issues
    if (this.editorState) {
      this.editorState.noteDraft = null;
      this.editorState.open = false;
    }
    
    // Clear any stored drafts for this note
    if (window.notesStorage && window.notesStorage.clearEditorDraft) {
      try {
        await window.notesStorage.clearEditorDraft(note.id);
      } catch (error) {
        console.warn('Failed to clear editor draft:', error);
      }
    }
    
    await this.openEditor(false);
  }

  // Open the note editor
  async openEditor(focusContent = false) {
    const editor = document.getElementById('noteEditor');
    const titleHeader = document.getElementById('noteTitleHeader');
    const contentInput = document.getElementById('noteContentInput');
    const tagsInput = document.getElementById('tagsInput');
    const dateSpan = document.getElementById('noteDate');
    const aiRewriteBtn = document.getElementById('aiRewriteBtn');

    // First, try to restore from cached draft
    const draftWasRestored = await this.restoreEditorDraft();
    
    // Populate editor with note data (either from note or restored draft)
    // Note: restoreEditorDraft() already populated the fields if a draft was restored
    if (!titleHeader.value) titleHeader.value = this.currentNote.title || '';
    if (!contentInput.innerHTML) contentInput.innerHTML = this.buildContentHtml(this.currentNote.content || '');
    if (!tagsInput.value) tagsInput.value = (this.currentNote.tags || []).join(', ');
    // Do not show created date inside the editor UI to avoid mid-editor clutter
    if (dateSpan) {
      dateSpan.textContent = '';
      dateSpan.style.display = 'none';
    }

    // Show premium features - use robust premium checking
    try {
      let isPremium = false;
      
      // First try notesStorage
      if (window.notesStorage?.checkPremiumAccess) {
        try {
          isPremium = await window.notesStorage.checkPremiumAccess();
        } catch (error) {
          console.warn('notesStorage premium check failed in openEditor:', error);
        }
      }
      
      // Fallback to chrome storage if notesStorage failed
      if (!isPremium) {
        try {
          const { userTier } = await chrome.storage.local.get(['userTier']);
          isPremium = !!(userTier && userTier !== 'free');
        } catch (error) {
          console.warn('Chrome storage premium check failed in openEditor:', error);
        }
      }
      
      // Final fallback to instance variable
      if (!isPremium && this.premiumStatus?.isPremium) {
        isPremium = this.premiumStatus.isPremium;
      }
      
              // Note: Removed verbose logging for cleaner console
      
      if (isPremium) {
        aiRewriteBtn.style.display = 'flex';
      } else {
        aiRewriteBtn.style.display = 'none';
      }
      
      // Also update the overall premium UI to ensure consistency
      try {
        await this.updatePremiumUI();
      } catch (error) {
        console.warn('Failed to update premium UI in openEditor:', error);
      }
    } catch (error) {
      console.error('Premium check failed in openEditor:', error);
      // Hide AI button on error
      aiRewriteBtn.style.display = 'none';
    }

    // Show editor with animation and persistent state
    editor.style.display = 'flex';
    editor.classList.add('open', 'slide-in', 'editor-fade-in');
    // Mark editor as open but don't save draft yet (wait for user changes)
    this.persistEditorOpen(true);
    
    // Only save draft if we didn't restore one (to avoid overwriting restored content)
    if (!draftWasRestored) {
      // Save initial state as draft
      setTimeout(() => this.saveEditorDraft(), 100);
    }
    
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
    
    // Note: updateCharCount method doesn't exist in editorManager
  }

  // Close the note editor
  async closeEditor(options = { clearDraft: false }) {
    const editor = document.getElementById('noteEditor');

    // Always save draft before closing (unless explicitly clearing)
    if (!options.clearDraft && this.currentNote) {
      try {
        // Save the current editor content as a draft (don't modify currentNote)
        await this.saveEditorDraft();
        // Note: Removed verbose logging for cleaner console
      } catch (error) {
        console.error('Failed to save editor draft:', error);
      }
    }

    editor.classList.add('slide-out');
    
    setTimeout(() => {
      editor.style.display = 'none';
      editor.classList.remove('open', 'slide-in', 'slide-out', 'editor-fade-in');
      // If requested, clear cached draft; otherwise keep cached but mark not open
      if (options && options.clearDraft) {
        this.clearEditorState();
        // Only when explicitly clearing the draft do we drop currentNote reference
        this.currentNote = null;
      } else {
        // Mark editor as not open but keep draft cached
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
      Utils.showToast('No note open to save', 'info');
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
    if (this.currentSite) {
      this.currentNote.url = this.currentSite.url;
      this.currentNote.pageTitle = this.currentSite.title;
    }
    
    // Don't save empty notes (title, content, and tags all empty)
    const isTitleEmpty = !this.currentNote.title;
    const isContentEmpty = (this.currentNote.content || '').trim() === '';
    const areTagsEmpty = (this.currentNote.tags || []).length === 0;
    if (isTitleEmpty && isContentEmpty && areTagsEmpty) {
      try { await this.editorManager.clearEditorState(); } catch (_) {}
      try { await this.editorManager.persistEditorOpen(false); } catch (_) {}
      this.editorManager.closeEditor({ clearDraft: true });
      return;
    }

    // Save note using storage manager (IndexedDB or Chrome storage)
    await this.storageManager.saveNote(this.currentNote);
    
    // Refresh notes list from storage to ensure consistency
    await this.loadNotes();

    try {
      // Show "Note Saved" popup
      this.showNoteSavedPopup('Note saved locally');
      
      // NO automatic sync - notes are saved locally only
      // Sync will happen on timer (every 5 minutes) or manual button press
      
    } catch (error) {
      console.error('Save failed:', error);
      this.showNoteSavedPopup('Save failed', 'error');
    }

    // Clear draft and/or close according to options
    if (opts.closeEditorAfterSave) {
      this.editorManager.closeEditor({ clearDraft: !!opts.clearDraftAfterSave });
    } else if (opts.clearDraftAfterSave) {
      await this.editorManager.clearEditorState();
    } else {
      // Persist editor open false since we're leaving editor via back
      await this.editorManager.persistEditorOpen(false);
    }

    if (opts.switchFilterAfterSave) {
      // After saving, switch to This Page filter
      this.switchFilter('page');
      // Re-render from memory (switchFilter already renders)
      Utils.checkStorageQuota();
    } else {
      // Still need to re-render to show the saved note
      this.render();
    }
  }

  // Add new method for sync-aware popup
  showNoteSavedPopup(message, type = 'saved') {
    // Remove any existing popups first to prevent overlapping
    const existingPopups = document.querySelectorAll('.note-saved-popup');
    existingPopups.forEach(popup => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    });

    const popup = document.createElement('div');
    popup.className = `note-saved-popup ${type}`;

    let icon = '✓';
    let bgColor = 'rgba(0, 122, 255, 0.9)';

    switch (type) {
      case 'sync':
        icon = '⟳';
        bgColor = 'rgba(255, 149, 0, 0.9)';
        break;
      case 'synced':
        icon = '✓';
        bgColor = 'rgba(52, 199, 89, 0.9)';
        break;
      case 'sync-error':
        icon = '⚠';
        bgColor = 'rgba(255, 59, 48, 0.9)';
        break;
    }

    popup.innerHTML = `
      <div class="popup-content">
        <span class="popup-icon">${icon}</span>
        <span class="popup-message">${message}</span>
      </div>
    `;

    // Apply liquid glass theme styling
    popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--glass-bg);
      color: var(--text-primary);
      padding: 12px 16px;
      border-radius: 12px;
      backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 300px;
      animation: slideInRight 0.3s ease-out;
    `;

    // Add to DOM and animate in
    document.body.appendChild(popup);
    
    // Trigger animation
    requestAnimationFrame(() => {
      popup.style.transform = 'translateX(0)';
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
          }
        }, 300);
      }
    }, 3000);
  }

  // Delete current note (from editor)
  async deleteCurrentNote() {
    if (!this.currentNote) {
      Utils.showToast('No note to delete', 'info');
      return;
    }

    // If it's a new, unsaved note, just close the editor
    const isNewNote = !this.allNotes.some(n => n.id === this.currentNote.id);
    if (isNewNote) {
      this.editorManager.closeEditor();
      return;
    }

    const confirmed = await this.dialog.show(`Delete "${this.currentNote.title || 'Untitled'}"?`);
    if (!confirmed) {
      return;
    }

    // Delete note using storage manager
    await this.storageManager.deleteNote(this.currentNote.id);
    
    // Refresh notes list from storage to ensure consistency
    await this.loadNotes();

    Utils.showToast('Note deleted', 'success');
    // Clear draft cache and close editor
    this.editorManager.closeEditor({ clearDraft: true });
    await this.postDeleteRefresh();
  }
  
  // Delete note from list (with confirmation)
  async deleteNoteFromList(noteId, skipConfirm = false) {
    const note = this.allNotes.find(n => n.id === noteId);
    if (!note) return;

    // This function is now only called directly when confirmed, so no need for dialog.
    // The inline confirmation is handled by the click listener in `createNoteElement`.

    // Delete note using storage manager
    await this.storageManager.deleteNote(noteId);
    
    // Clear draft if the deleted note is currently in the editor or draft
    if (this.currentNote && this.currentNote.id === noteId) {
      // If the deleted note is currently open in editor, close editor and clear draft
      this.editorManager.closeEditor({ clearDraft: true });
    } else {
      // Check if there's a draft for this note and clear it
      try {
        const { editorState } = await chrome.storage.local.get(['editorState']);
        if (editorState && editorState.noteDraft && editorState.noteDraft.id === noteId) {
          await chrome.storage.local.remove('editorState');
          console.log('Cleared draft for deleted note:', noteId);
        }
      } catch (error) {
        console.warn('Error checking/clearing draft for deleted note:', error);
      }
    }
    
    // Refresh notes list from storage to ensure consistency
    await this.loadNotes();

    Utils.showToast('Note deleted', 'success');
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
      
      if (isOpen) {
        // Set wasEditorOpen flag to true when editor is opened by user
        // This helps distinguish between popup opening and actual editor opening
        state.wasEditorOpen = true;
      } else {
        // Clear wasEditorOpen flag when editor is closed by user
        // This ensures we don't auto-open on next popup open
        state.wasEditorOpen = false;
      }
      
      await chrome.storage.local.set({ editorState: state });
      console.log('Popup: persistEditorOpen called with:', { isOpen, wasEditorOpen: state.wasEditorOpen });
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

      // Preserve existing editorState (including wasEditorOpen flag and open state) when saving draft
      const { editorState: existingState } = await chrome.storage.local.get(['editorState']);
      const updatedState = {
        ...existingState,
        noteDraft: draft
      };
      await chrome.storage.local.set({ editorState: updatedState });
              // Note: Removed verbose logging for cleaner console
    } catch (error) {
      console.error('Failed to save editor draft:', error);
    }
  }

  // NEW: Clean up old drafts to prevent unwanted auto-opening
  async cleanupOldDrafts() {
    try {
      const { editorState } = await chrome.storage.local.get(['editorState']);
      if (editorState && editorState.noteDraft) {
        const now = Date.now();
        const draftTime = editorState.noteDraft.updatedAt ? new Date(editorState.noteDraft.updatedAt).getTime() : 0;
        const timeDiff = now - draftTime;
        const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
        
        if (timeDiff > tenMinutes) {
          console.log('Popup: Cleaning up old draft (older than 10 minutes)');
          await chrome.storage.local.remove('editorState');
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old drafts:', error);
    }
  }

  // Restore editor draft from storage
  async restoreEditorDraft() {
    try {
      // First, clean up any old drafts
      await this.cleanupOldDrafts();
      
      // Then check for drafts to restore
      const { editorState } = await chrome.storage.local.get(['editorState']);
      if (!editorState) return;
      
      if (!this.currentNote) return;
      
      if (editorState && editorState.noteDraft && editorState.noteDraft.id === this.currentNote.id) {
        const draft = editorState.noteDraft;
        
        // Restore draft content if it's newer than the note
        // Handle cases where timestamps might not exist or might be different
        let shouldRestore = false;
        
        if (draft.updatedAt && this.currentNote.updatedAt) {
          const draftTime = new Date(draft.updatedAt).getTime();
          const noteTime = new Date(this.currentNote.updatedAt).getTime();
          shouldRestore = draftTime > noteTime;
        } else if (draft.updatedAt && !this.currentNote.updatedAt) {
          // If draft has timestamp but currentNote doesn't, restore the draft
          shouldRestore = true;
        } else if (!draft.updatedAt && this.currentNote.updatedAt) {
          // If currentNote has timestamp but draft doesn't, don't restore
          shouldRestore = false;
        } else {
          // If neither has timestamp, compare content lengths as fallback
          const draftLength = (draft.content || '').length;
          const noteLength = (this.currentNote.content || '').length;
          shouldRestore = draftLength > noteLength;
        }
        
        if (shouldRestore) {
            // Draft is newer, restore it to editor fields (don't modify currentNote)
            const titleHeader = document.getElementById('noteTitleHeader');
            const contentInput = document.getElementById('noteContentInput');
            const tagsInput = document.getElementById('tagsInput');
            
            if (titleHeader) titleHeader.value = draft.title || this.currentNote.title || '';
            if (contentInput) contentInput.innerHTML = this.buildContentHtml(draft.content || this.currentNote.content || '');
            if (tagsInput) tagsInput.value = (draft.tags || this.currentNote.tags || []).join(', ');
            
          console.log('Restored draft content:', { 
            draftContent: draft.content?.substring(0, 100), 
            noteContent: this.currentNote.content?.substring(0, 100) 
          });
            return true; // Indicate that a draft was restored
        }
      }
      return false; // No draft was restored
    } catch (error) {
      console.error('Failed to restore editor draft:', error);
      return false;
    }
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

    // Delete notes using storage manager
    await this.storageManager.deleteNotesByDomain(domain);
    
    // Clear draft if it belongs to the deleted domain
    if (this.currentNote && this.currentNote.domain === domain) {
      // If the current note belongs to the deleted domain, close editor and clear draft
      this.editorManager.closeEditor({ clearDraft: true });
    } else {
      // Check if there's a draft for this domain and clear it
      try {
        const { editorState } = await chrome.storage.local.get(['editorState']);
        if (editorState && editorState.noteDraft && editorState.noteDraft.domain === domain) {
          await chrome.storage.local.remove('editorState');
          console.log('Cleared draft for deleted domain:', domain);
        }
      } catch (error) {
        console.warn('Error checking/clearing draft for deleted domain:', error);
      }
    }
    
    // Refresh notes list from storage to ensure consistency
    await this.loadNotes();

    await this.postDeleteRefresh();
          Utils.showToast(`Deleted all notes for ${domain}`, 'success');
  }

  // After any deletion, optionally clear the search if it would show an empty list, then render
  async postDeleteRefresh() {
    // Compute what would be visible with current filter + search
    let filtered = [];
    if (this.filterMode === 'site') {
      // Only filter by site if we have a valid currentSite with domain
      if (this.currentSite && this.currentSite.domain && this.currentSite.domain !== 'localhost') {
        filtered = this.allNotes.filter(n => n.domain === this.currentSite.domain);
      } else {
        // If no valid currentSite, show all notes instead of filtering to empty
        filtered = this.allNotes;
      }
    } else if (this.filterMode === 'page') {
      // Only filter by page if we have a valid currentSite with URL
      if (this.currentSite && this.currentSite.url && this.currentSite.url !== 'http://localhost') {
        const currentKey = this.normalizePageKey(this.currentSite.url);
        filtered = this.allNotes.filter(n => this.normalizePageKey(n.url) === currentKey);
      } else {
        // If no valid currentSite URL, show all notes instead of filtering to empty
        filtered = this.allNotes;
      }
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


  // AI Rewrite (placeholder)
  aiRewrite() {
          Utils.showToast('AI Rewrite coming soon!', 'info');
  }

  async updatePremiumUI() {
    try {
      // Try multiple sources for premium status
      let isPremium = false;
      
      // First try notesStorage
      if (window.notesStorage?.checkPremiumAccess) {
        try {
          isPremium = await window.notesStorage.checkPremiumAccess();
        } catch (error) {
          console.warn('notesStorage premium check failed:', error);
        }
      }
      
      // Fallback to chrome storage if notesStorage failed
      if (!isPremium) {
        try {
          const { userTier } = await chrome.storage.local.get(['userTier']);
          isPremium = !!(userTier && userTier !== 'free');
        } catch (error) {
          console.warn('Chrome storage premium check failed:', error);
        }
      }
      
      // Final fallback to instance variable
      if (!isPremium && this.premiumStatus?.isPremium) {
        isPremium = this.premiumStatus.isPremium;
      }
      
      // AI button visibility
      const aiBtn = document.getElementById('aiRewriteBtn');
      if (aiBtn) {
        aiBtn.style.display = isPremium ? 'flex' : 'none';
      }

      // Ads container visibility
      const ad = document.getElementById('adContainer');
      if (ad) {
        ad.style.display = isPremium ? 'none' : 'block';
      }

      // Always allow All Notes view
      const allNotesBtn = document.getElementById('showAllNotesBtn');
      if (allNotesBtn) {
        allNotesBtn.classList.remove('premium-feature');
        allNotesBtn.disabled = false;
        allNotesBtn.title = 'View all notes';
      }
    } catch (error) { 
      console.error('updatePremiumUI failed:', error);
      // Hide premium features if check fails
      const aiBtn = document.getElementById('aiRewriteBtn');
      if (aiBtn) aiBtn.style.display = 'none';
      
      const ad = document.getElementById('adContainer');
      if (ad) ad.style.display = 'block';
    }
  }

  // Handle paste events in editor
  handleEditorPaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const sanitizedText = Utils.sanitizeHtml(text);
    document.execCommand('insertText', false, sanitizedText);
  }

  // Handle link clicks in editor
  handleEditorLinkClick(e) {
    if (e.target.tagName === 'A') {
      e.preventDefault();
      const url = e.target.href;
      
      // Check if the URL is already open in a tab (flexible matching)
      chrome.tabs.query({}, (tabs) => {
        const targetUrl = new URL(url);
        const existingTab = tabs.find(tab => {
          if (!tab.url) return false;
          try {
            const tabUrl = new URL(tab.url);
            // Match by hostname and pathname, ignore query params and fragments
            return tabUrl.hostname === targetUrl.hostname && 
                   tabUrl.pathname === targetUrl.pathname;
          } catch {
            return false;
          }
        });
        
        if (existingTab) {
          // Switch to existing tab and highlight text
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.tabs.sendMessage(existingTab.id, {
            action: 'highlightText',
            text: e.target.textContent,
            href: url
          }).catch(() => {});
        } else {
          // Create new tab
          chrome.tabs.create({ url: url });
        }
      });
    }
  }

  // Save font setting
  async saveFontSetting(fontFamily) {
    try {
      await chrome.storage.local.set({ fontFamily });
      document.body.style.fontFamily = fontFamily;
      Utils.showToast('Font updated', 'success');
    } catch (error) {
              Utils.showToast('Failed to save font setting', 'error');
    }
  }

  // AI rewrite functionality
  async aiRewrite() {
    // Check if we have a current note (including drafts)
    if (!this.currentNote) {
      Utils.showToast('Please open a note to use AI Rewrite.', 'info');
      return;
    }

    // Check if note has content (either saved or draft)
    // Get content from editor inputs first (for drafts), then fall back to note data
    const noteContentInput = document.getElementById('noteContentInput');
    const noteTitleHeader = document.getElementById('noteTitleHeader');
    
    const draftContent = noteContentInput?.value || noteContentInput?.textContent || '';
    const draftTitle = noteTitleHeader?.value || noteTitleHeader?.textContent || '';
    
    const hasContent = draftContent.trim() || 
                      draftTitle.trim() || 
                      this.currentNote?.content || 
                      this.currentNote?.title;

    if (!hasContent) {
      Utils.showToast('Please add some content to your note before using AI Rewrite.', 'info');
      return;
    }

    // Check if user is authenticated (required for usage tracking)
    if (!window.supabaseClient || !window.supabaseClient.isAuthenticated()) {
      Utils.showToast('Please create an account to use AI Rewrite. Free users get 5 rewrites/month!', 'info');
      // Optionally open settings to guide them to sign up
      setTimeout(() => {
        this.showSettings();
      }, 2000); // Show settings after 2 seconds
      return;
    }

    // Check if free user has any AI calls remaining
    const isPremium = await this.checkPremiumStatus();
    if (!isPremium) {
      const currentUsage = await this.getCurrentAIUsage();
      if (currentUsage && currentUsage.remainingCalls <= 0) {
        Utils.showToast('Monthly AI limit reached. Upgrade to Premium for more rewrites!', 'warning');
        return;
      }
    }

    // Toggle dropdown instead of showing dialog
    this.toggleAIDropdown();
  }

  // Show AI rewrite dialog
  async showAIRewriteDialog() {
    const dialog = document.getElementById('aiRewriteDialog');
    if (dialog) {
      dialog.style.display = 'flex';
      this.setupAIRewriteEventListeners();
      
      // Load and display usage info
      await this.loadUsageInfo();
    }
  }

  // Setup AI rewrite dialog event listeners
  setupAIRewriteEventListeners() {
    // Close button
    const closeBtn = document.getElementById('aiRewriteCloseBtn');
    if (closeBtn) {
      closeBtn.onclick = () => this.hideAIRewriteDialog();
    }

    // Style selection buttons
    const styleBtns = document.querySelectorAll('.rewrite-style-btn');
    styleBtns.forEach(btn => {
      btn.onclick = (e) => this.handleStyleSelection(e.target.dataset.style);
    });

    // Try another style button
    const tryAnotherBtn = document.getElementById('tryAnotherStyleBtn');
    if (tryAnotherBtn) {
      tryAnotherBtn.onclick = () => this.showStyleSelection();
    }

    // Apply rewrite button
    const applyBtn = document.getElementById('applyRewriteBtn');
    if (applyBtn) {
      applyBtn.onclick = () => this.applyAIRewrite();
    }
  }

  // Handle style selection
  async handleStyleSelection(style) {
    // Update active button
    const styleBtns = document.querySelectorAll('.rewrite-style-btn');
    styleBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.style === style) {
        btn.classList.add('active');
      }
    });

    // Show loading state
    this.showRewriteLoading();

    try {
      // Call AI rewrite API
      const rewrittenContent = await this.callAIRewriteAPI(this.currentNote.content, style, '');
      
      // Show preview
      this.showRewritePreview(rewrittenContent, style);
    } catch (error) {
      console.error('AI rewrite failed:', error);
      Utils.showToast('AI rewrite failed. Please try again.', 'error');
      this.showStyleSelection();
    }
  }

  // Show rewrite loading state
  showRewriteLoading() {
    document.getElementById('rewriteOptions').style.display = 'none';
    document.getElementById('rewritePreview').style.display = 'none';
    document.getElementById('rewriteLoading').style.display = 'block';
  }

  // Show style selection
  showStyleSelection() {
    document.getElementById('rewriteOptions').style.display = 'block';
    document.getElementById('rewritePreview').style.display = 'none';
    document.getElementById('rewriteLoading').style.display = 'none';
  }

  // Apply AI rewrite directly to the note
  applyAIRewriteToNote(rewrittenContent, style) {
    // Get the content input element
    const contentInput = document.getElementById('noteContentInput');
    
    if (contentInput && rewrittenContent) {
      // Apply the rewritten content
      contentInput.innerHTML = rewrittenContent;
      
      // Trigger content change event to update character count, etc.
      const event = new Event('input', { bubbles: true });
      contentInput.dispatchEvent(event);
      
      // Update the current note object
      if (this.currentNote) {
        this.currentNote.content = rewrittenContent;
        this.currentNote.updatedAt = new Date().toISOString();
      }
      
      // Success - content applied
    } else {
      console.error('Could not apply AI rewrite: missing content input or rewritten content');
    }
  }

  // Hide AI rewrite dialog
  hideAIRewriteDialog() {
    const dialog = document.getElementById('aiRewriteDialog');
    if (dialog) {
      dialog.style.display = 'none';
      // Reset state
      this.showStyleSelection();
    }
  }

  // Call AI rewrite API
  async callAIRewriteAPI(content, style, userContext = '') {
    try {
      // Check if user is authenticated
      if (!window.supabaseClient || !window.supabaseClient.isAuthenticated()) {
        throw new Error('User not authenticated');
      }

      // Prepare context information
      const context = {
        domain: this.currentNote.domain || 'general',
        noteTitle: this.currentNote.title || 'Untitled Note',
        userIntent: this.getUserIntentFromContent(content),
        writingStyle: this.analyzeWritingStyle(content),
        userContext: userContext // Add user-provided context
      };

      // Get the current user and access token from custom client
      if (!window.supabaseClient.isAuthenticated()) {
        throw new Error('Please create an account to use AI Rewrite. Free users get 5 rewrites/month!');
      }

      const user = window.supabaseClient.getCurrentUser();
      if (!user) {
        throw new Error('Please create an account to use AI Rewrite. Free users get 5 rewrites/month!');
      }

      // Call our Edge Function which handles Gemini API
      const apiUrl = `${window.supabaseClient.supabaseUrl}/functions/v1/hyper-api`;
      const requestBody = {
        content: content,
        style: style,
        context: context
      };
      
      // Log only essential info for debugging
      console.log('AI rewrite: Calling API for', style, 'style');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.supabaseClient.accessToken}`,
          'apikey': window.supabaseClient.supabaseAnonKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('AI rewrite API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          errorMessage: errorData.error,
          remainingCalls: errorData.remainingCalls,
          resetDate: errorData.resetDate
        });
        throw new Error(errorData.error || `AI rewrite failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // Log success with remaining calls
      console.log(`AI rewrite successful: ${data.remainingCalls} calls remaining`);
      
      // Show remaining calls info
      if (data.remainingCalls !== undefined) {
        const remainingText = data.remainingCalls === 1 ? '1 call' : `${data.remainingCalls} calls`;
        Utils.showToast(`AI rewrite successful! ${remainingText} remaining this month.`, 'success');
      }

      return data.rewrittenContent;
    } catch (error) {
      console.error('AI rewrite API call failed:', error);
      
      // Show helpful message for authentication errors
      if (error.message.includes('create an account')) {
        Utils.showToast(error.message, 'info');
        return null;
      }
      
      // Fallback to simulation if API fails for other reasons
      console.log('Falling back to simulated AI rewrite');
      return this.simulateAIRewrite(content, style);
    }
  }

  // Analyze user intent from content
  getUserIntentFromContent(content) {
    const text = content.toLowerCase();
    
    if (text.includes('meeting') || text.includes('agenda') || text.includes('schedule')) {
      return 'Meeting/Planning';
    } else if (text.includes('research') || text.includes('study') || text.includes('learn')) {
      return 'Research/Learning';
    } else if (text.includes('idea') || text.includes('concept') || text.includes('brainstorm')) {
      return 'Ideation/Brainstorming';
    } else if (text.includes('review') || text.includes('feedback') || text.includes('evaluate')) {
      return 'Review/Feedback';
    } else if (text.includes('todo') || text.includes('task') || text.includes('action')) {
      return 'Task Management';
    } else {
      return 'General Note';
    }
  }

  // Analyze current writing style
  analyzeWritingStyle(content) {
    const text = content.toLowerCase();
    
    if (text.includes('i am') || text.includes('you are') || text.includes('we are')) {
      return 'Formal';
    } else if (text.includes("i'm") || text.includes("you're") || text.includes("we're")) {
      return 'Casual';
    } else if (text.includes('gonna') || text.includes('wanna') || text.includes('kinda')) {
      return 'Very Casual';
    } else if (text.includes('therefore') || text.includes('furthermore') || text.includes('consequently')) {
      return 'Academic';
    } else {
      return 'Neutral';
    }
  }

  // Simulate AI rewrite (placeholder for real AI service)
  simulateAIRewrite(content, style) {
    const transformations = {
      formal: (text) => text.replace(/\b(?:I'm|I am|you're|you are|we're|we are|they're|they are)\b/gi, 
        (match) => match.toLowerCase().includes('i') ? 'I am' : 
                   match.toLowerCase().includes('you') ? 'you are' : 
                   match.toLowerCase().includes('we') ? 'we are' : 'they are'),
      casual: (text) => text.replace(/\b(?:I am|you are|we are|they are)\b/gi,
        (match) => match.toLowerCase().includes('i') ? "I'm" : 
                   match.toLowerCase().includes('you') ? "you're" : 
                   match.toLowerCase().includes('we') ? "we're" : "they're"),
      professional: (text) => text.replace(/\b(?:gonna|wanna|gotta|kinda|sorta)\b/gi,
        (match) => match === 'gonna' ? 'going to' : 
                   match === 'wanna' ? 'want to' : 
                   match === 'gotta' ? 'got to' : 
                   match === 'kinda' ? 'kind of' : 'sort of'),
      creative: (text) => text.replace(/\b(?:good|bad|big|small)\b/gi,
        (match) => match === 'good' ? 'excellent' : 
                   match === 'bad' ? 'terrible' : 
                   match === 'big' ? 'enormous' : 'tiny'),
      concise: (text) => text.replace(/\b(?:very|really|quite|rather|somewhat)\s+/gi, '')
    };

    const transform = transformations[style] || ((text) => text);
    return transform(content);
  }

  // Toggle AI dropdown
  toggleAIDropdown() {
    const dropdown = document.getElementById('aiDropdownMenu');
    if (dropdown) {
      const isVisible = dropdown.classList.contains('show');
      
      if (isVisible) {
        this.hideAIDropdown();
      } else {
        this.showAIDropdown();
      }
    }
  }

  // Show AI dropdown
  async showAIDropdown() {
    const dropdown = document.getElementById('aiDropdownMenu');
    const trigger = document.getElementById('aiRewriteBtn');
    
    if (dropdown && trigger) {
      // Load usage and context info
      await this.loadUsageInfo();
      await this.displayContextInfo();
      
      // Position dropdown relative to trigger button
      const triggerRect = trigger.getBoundingClientRect();
      dropdown.style.top = (triggerRect.bottom + 8) + 'px';
      dropdown.style.right = (window.innerWidth - triggerRect.right) + 'px';
      
      // Show dropdown
      dropdown.classList.add('show');
      
      // Setup event listeners
      this.setupDropdownEventListeners();
      
      // Close dropdown when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.handleOutsideClick.bind(this), { once: true });
      }, 100);
    }
  }

  // Hide AI dropdown
  hideAIDropdown() {
    const dropdown = document.getElementById('aiDropdownMenu');
    if (dropdown) {
      dropdown.classList.remove('show');
      
      // Clear user context input when hiding dropdown
      const userContextInput = document.getElementById('userContextInput');
      if (userContextInput) {
        userContextInput.value = '';
        const charCount = document.getElementById('charCount');
        if (charCount) {
          charCount.textContent = '0';
          charCount.style.color = 'rgba(255, 255, 255, 0.7)';
        }
      }
      
      // Reset style selection
      const styleOptions = document.querySelectorAll('.style-option');
      styleOptions.forEach(option => option.classList.remove('active'));
    }
  }

  // Handle clicks outside dropdown
  handleOutsideClick(event) {
    const dropdown = document.getElementById('aiDropdownMenu');
    const trigger = document.getElementById('aiRewriteBtn');
    
    if (dropdown && trigger && !dropdown.contains(event.target) && !trigger.contains(event.target)) {
      this.hideAIDropdown();
    }
  }

  // Setup dropdown event listeners
  setupDropdownEventListeners() {
    // Style selection
    const styleOptions = document.querySelectorAll('.style-option');
    styleOptions.forEach(option => {
      option.onclick = (e) => {
        // Remove active class from all options
        styleOptions.forEach(opt => opt.classList.remove('active'));
        // Add active class to clicked option
        e.currentTarget.classList.add('active');
      };
    });

    // User context input character counter
    const userContextInput = document.getElementById('userContextInput');
    const charCount = document.getElementById('charCount');
    
    if (userContextInput && charCount) {
      userContextInput.addEventListener('input', () => {
        const currentLength = userContextInput.value.length;
        charCount.textContent = currentLength;
        
        // Visual feedback when approaching limit
        if (currentLength > 250) {
          charCount.style.color = '#ff6b6b';
        } else if (currentLength > 200) {
          charCount.style.color = '#ffd93d';
        } else {
          charCount.style.color = 'rgba(255, 255, 255, 0.7)';
        }
      });
    }

    // Execute AI rewrite button
    const executeBtn = document.getElementById('executeAIRewrite');
    if (executeBtn) {
      executeBtn.onclick = () => this.executeAIRewrite();
    }
  }

  // Execute AI rewrite from dropdown
  async executeAIRewrite() {
    const activeStyle = document.querySelector('.style-option.active');
    if (!activeStyle) {
      Utils.showToast('Please select a rewrite style first.', 'warning');
      return;
    }

    const style = activeStyle.dataset.style;
    
    // Get content from editor or note
    let content = '';
    const contentInput = document.getElementById('noteContentInput');
    if (contentInput && contentInput.innerHTML.trim()) {
      content = contentInput.innerHTML;
    } else if (this.currentNote.content) {
      content = this.currentNote.content;
    }
    
    // Also check title
    const titleInput = document.getElementById('noteTitleHeader');
    const title = titleInput ? titleInput.value : (this.currentNote.title || '');
    
    const combinedContent = `${title} ${content}`.trim();
    
    if (!combinedContent) {
      Utils.showToast('Please add some content to your note before using AI Rewrite.', 'info');
      return;
    }

    // Hide dropdown
    this.hideAIDropdown();

    // Show loading state
    Utils.showToast('AI is rewriting your note...', 'info');

    try {
      // Get user context if provided
      const userContextInput = document.getElementById('userContextInput');
      const userContext = userContextInput ? userContextInput.value.trim() : '';
      
      // Call AI rewrite API with user context
      const rewrittenContent = await this.callAIRewriteAPI(combinedContent, style, userContext);
      
      // Check if API call was successful
      if (rewrittenContent === null) {
        // API call failed due to authentication, don't show preview
        return;
      }
      
      // Apply the rewritten content directly to the note
      this.applyAIRewriteToNote(rewrittenContent, style);
      
      // Hide dropdown
      this.hideAIDropdown();
      
      // Show success message
      Utils.showToast(`AI rewrite applied! Content rewritten in ${style} style.`, 'success');
      
    } catch (error) {
      console.error('AI rewrite failed:', error);
      Utils.showToast('AI rewrite failed. Please try again.', 'error');
    }
  }

  // Display context information
  async displayContextInfo() {
    if (!this.currentNote) return;

    // Update dropdown context tags
    const contextDomain = document.getElementById('contextDomain');
    const contextIntent = document.getElementById('contextIntent');
    const contextStyle = document.getElementById('contextStyle');

    if (contextDomain && contextIntent && contextStyle) {
      // Domain context
      const domain = this.currentNote.domain || 'general';
      contextDomain.textContent = `🌐 ${domain}`;

      // Intent context - handle both saved notes and drafts
      // Get content from editor inputs first (for drafts), then fall back to note data
      const noteContentInput = document.getElementById('noteContentInput');
      const noteTitleHeader = document.getElementById('noteTitleHeader');
      
      const draftContent = noteContentInput?.value || noteContentInput?.textContent || noteContentInput?.innerHTML || '';
      const draftTitle = noteTitleHeader?.value || noteTitleHeader?.textContent || '';
      
      const content = draftContent.trim() || this.currentNote.content || '';
      const title = draftTitle.trim() || this.currentNote.title || '';
      const combinedText = `${title} ${content}`.trim();
      
      const intent = this.getUserIntentFromContent(combinedText);
      contextIntent.textContent = `🎯 ${intent}`;

      // Style context - analyze current content
      const style = this.analyzeWritingStyle(combinedText);
      contextStyle.textContent = `✍️ ${style}`;
    }
  }

  // Load and display usage info
  async loadUsageInfo() {
    try {
      // Use the existing premium check method from notesStorage
      let isPremium = false;
      
      if (window.notesStorage?.checkPremiumAccess) {
        try {
          isPremium = await window.notesStorage.checkPremiumAccess();
        } catch (error) {
          console.warn('notesStorage premium check failed:', error);
        }
      }
      
      // Fallback to chrome storage if notesStorage failed
      if (!isPremium) {
        try {
          const { userTier } = await chrome.storage.local.get(['userTier']);
          isPremium = !!(userTier && userTier !== 'free');
        } catch (error) {
          console.warn('Chrome storage premium check failed:', error);
        }
      }
      
      // Update dropdown usage badge based on actual usage data
      const remainingCalls = document.getElementById('remainingCalls');
      if (remainingCalls) {
        // Always get current usage from backend for accurate numbers
        const currentUsage = await this.getCurrentAIUsage();
        if (currentUsage) {
          // Display actual remaining calls and monthly limit
          remainingCalls.textContent = `${currentUsage.remainingCalls}/${currentUsage.monthlyLimit}`;
        } else {
          // Fallback to premium status if backend call fails
          if (isPremium) {
            remainingCalls.textContent = '100/month';
          } else {
            remainingCalls.textContent = '5/month';
          }
        }
        
        // Show upgrade message if free user has 0 calls remaining
        if (!isPremium && currentUsage && currentUsage.remainingCalls === 0) {
          this.showUpgradeMessage();
        }
      }

      // Display context info
      await this.displayContextInfo();
    } catch (error) {
      console.error('Error loading usage info:', error);
    }
  }

  // Get current AI usage from Supabase
  async getCurrentAIUsage() {
    try {
      if (!window.supabaseClient || !window.supabaseClient.isAuthenticated()) {
        return null;
      }

      const user = window.supabaseClient.getCurrentUser();
      if (!user) return null;

      const { data: usageData, error } = await window.supabaseClient.rpc('check_ai_usage', {
        p_user_id: user.id,
        p_feature_name: 'ai_rewrite'
      });

      if (error) {
        console.warn('Failed to get AI usage:', error);
        return null;
      }

      return usageData;
    } catch (error) {
      console.warn('Error getting AI usage:', error);
      return null;
    }
  }

  // Check premium status
  async checkPremiumStatus() {
    try {
      if (window.notesStorage?.checkPremiumAccess) {
        return await window.notesStorage.checkPremiumAccess();
      }
      
      // Fallback to chrome storage
      const { userTier } = await chrome.storage.local.get(['userTier']);
      return !!(userTier && userTier !== 'free');
    } catch (error) {
      console.warn('Error checking premium status:', error);
      return false;
    }
  }

  // Show upgrade message when free users hit their limit
  showUpgradeMessage() {
    const usageBadge = document.getElementById('usageBadge');
    if (usageBadge) {
      // Create upgrade message
      const upgradeMsg = document.createElement('div');
      upgradeMsg.className = 'upgrade-message';
      upgradeMsg.innerHTML = `
        <span class="upgrade-text">Upgrade to Premium</span>
        <span class="upgrade-subtitle">Get 100 rewrites/month</span>
      `;
      
      // Replace the usage badge content
      usageBadge.innerHTML = '';
      usageBadge.appendChild(upgradeMsg);
      
              // Add click handler to open settings
        upgradeMsg.style.cursor = 'pointer';
        upgradeMsg.onclick = () => {
          // Open settings panel
          this.showSettings();
          this.hideAIDropdown();
        };
    }
  }

  // Apply AI rewrite to current note
  async applyAIRewrite() {
    const previewContent = document.getElementById('previewContent');
    if (previewContent && this.currentNote) {
      // Update note content
      this.currentNote.content = previewContent.textContent;
      
      // Update editor
      const contentInput = document.getElementById('noteContentInput');
      if (contentInput) {
        contentInput.innerHTML = previewContent.textContent;
      }

      // Save note
      await this.saveNote();

      // Close dialog
      this.hideAIRewriteDialog();

      Utils.showToast('AI rewrite applied successfully!', 'success');
    }
  }

  // Export notes
  async exportNotes() {
    // SettingsManager exposes handleExportNotes()
    if (this.settingsManager && typeof this.settingsManager.handleExportNotes === 'function') {
      this.settingsManager.handleExportNotes();
    } else if (this.storageManager && typeof this.storageManager.exportNotes === 'function') {
      // Fallback to storage manager export if settings module isn't wired
      try {
        const exportData = await this.storageManager.exportNotes();
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `url-notes-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Utils.showToast('Notes exported', 'success');
      } catch (e) {
                  Utils.showToast('Failed to export notes', 'error');
      }
    } else {
              Utils.showToast('Export not available', 'info');
    }
  }

  // Open settings panel
  openSettings() {
    this.settingsManager.openSettings();
  }

  // Post-delete refresh functionality
  async postDeleteRefresh() {
    try {
      // Re-render the notes list
      this.render();
      // Update storage quota display
      Utils.checkStorageQuota();
    } catch (error) {
      console.error('Error in post-delete refresh:', error);
    }
  }



  // Generate a unique ID for new notes
  generateId() {
    try {
      // Use crypto.randomUUID if available (modern browsers)
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      
      // Fallback for older browsers
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    } catch (error) {
      console.error('Failed to generate ID:', error);
      // Final fallback
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
  }

  // Apply font settings to editor
  applyFont(fontName, size) {
    try {
      const contentInput = document.getElementById('noteContentInput');
      if (contentInput) {
        const fontFamily = (fontName === 'Default' || fontName === 'System')
          ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
          : fontName;
        contentInput.style.fontFamily = fontFamily;
        contentInput.style.fontSize = `${size}px`;
      }
    } catch (error) {
      console.warn('Failed to apply font:', error);
    }
  }

  // Close settings panel
  closeSettings() {
    try {
      const settingsPanel = document.getElementById('settingsPanel');
      if (settingsPanel) {
        settingsPanel.style.display = 'none';
      }
    } catch (error) {
      console.warn('Failed to close settings:', error);
    }
  }

  // Import notes from file
  async importNotes(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const text = await file.text();
      const data = JSON.parse(text);
      
      if (this.storageManager && typeof this.storageManager.importNotes === 'function') {
        await this.storageManager.importNotes(data);
        Utils.showToast('Notes imported successfully', 'success');
        // Refresh notes list
        await this.loadNotes();
        this.render();
      } else {
        Utils.showToast('Import not available', 'info');
      }
      
      // Clear the input
      event.target.value = '';
    } catch (error) {
      console.error('Import failed:', error);
              Utils.showToast('Failed to import notes', 'error');
      // Clear the input
      event.target.value = '';
    }
  }

  // Show notification message
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = 'ℹ';
    let bgColor = 'rgba(0, 122, 255, 0.9)';
    
    switch (type) {
      case 'success':
        icon = '✓';
        bgColor = 'rgba(52, 199, 89, 0.9)';
        break;
      case 'warning':
        icon = '⚠';
        bgColor = 'rgba(255, 149, 0, 0.9)';
        break;
      case 'error':
        icon = '✗';
        bgColor = 'rgba(255, 59, 48, 0.9)';
        break;
    }
    
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      max-width: 300px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-hide after delay
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

}

// Get premium status from storage or default to false
async function getPremiumStatus() {
  try {
    // First try to get from notesStorage if available
    if (window.notesStorage?.checkPremiumAccess) {
      const isPremium = await window.notesStorage.checkPremiumAccess();
      return { isPremium };
    }
    
    // Fallback to chrome storage
    const { userTier } = await chrome.storage.local.get(['userTier']);
    const isPremium = !!(userTier && userTier !== 'free');
    return { isPremium };
  } catch (error) {
    console.warn('Failed to get premium status:', error);
    // Default to non-premium on error
    return { isPremium: false };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Expose the app globally so modules (e.g., editor.js) can read premiumStatus
  window.urlNotesApp = new URLNotesApp();
  
  // Expose notesManager globally for version history functionality
  if (window.urlNotesApp && window.urlNotesApp.notesManager) {
    window.notesManager = window.urlNotesApp.notesManager;
  }
});
