// URL Notes Extension - Simplified Sync Engine
// Only syncs latest versions, no version history, local priority

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.syncIntervalMs = 5 * 60 * 1000; // 5 minutes
    this.lastSyncTime = null;
    this.lastVersionUpdateTime = Date.now();
    
    // Start event listeners (for tracking purposes only, no auto-sync)
    this.startEventListeners();
    
    // Start periodic sync (every 5 minutes)
    this.startPeriodicSync();
  }

  // Initialize sync engine
  async init() {
    this.setupEventListeners();
    await this.loadLastSyncTime();
    
    // Check if we should start sync for authenticated premium users
    const syncCheck = await this.canSync();
    if (syncCheck.canSync) {
      this.startPeriodicSync();
    }
  }

  // Setup online/offline detection and sync triggers
  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      // No offline queue to flush - sync happens on timer or manual
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Listen for note changes to track last version update time
    window.eventBus?.on('notes:updated', (payload) => {
      // Note: Removed verbose logging for cleaner console
      this.lastVersionUpdateTime = Date.now();
      // NO automatic sync - only local behavior
    });

    // Listen for note deletions
    window.eventBus?.on('notes:deleted', (payload) => {
      // Note: Removed verbose logging for cleaner console
      // NO automatic sync - only local behavior
    });

    // Listen for auth changes
    window.eventBus?.on('auth:changed', (payload) => {
      if (payload.user) {
        this.performInitialSync();
      } else {
        this.clearSyncState();
      }
    });
  }

  // Load last sync time from storage
  async loadLastSyncTime() {
    try {
      const result = await chrome.storage.local.get(['lastSyncTime']);
      this.lastSyncTime = result.lastSyncTime || null;
    } catch (error) {
      console.warn('Failed to load last sync time:', error);
    }
  }

  // Save last sync time to storage
  async saveLastSyncTime(timestamp) {
    try {
      await chrome.storage.local.set({ lastSyncTime: timestamp });
      this.lastSyncTime = timestamp;
    } catch (error) {
      console.warn('Failed to save last sync time:', error);
    }
  }

  // Check if user can sync
  async canSync() {
    try {
      // Early exit if no Supabase client
      if (!window.supabaseClient) {
        // Note: Removed verbose logging for cleaner console
        return { authenticated: false, status: null, canSync: false };
      }

      // Check if auth is available before calling getUser
      if (typeof window.supabaseClient.isAuthenticated !== 'function') {
        // Note: Removed verbose logging for cleaner console
        return { authenticated: false, status: null, canSync: false };
      }

      // Check authentication first
      try {
        if (window.supabaseClient.isAuthenticated()) {
          // User is authenticated, check subscription status
      try {
        const status = await window.supabaseClient.getSubscriptionStatus();
        const canSync = status && status.active;
        
        // Note: Removed verbose logging for cleaner console
        return { authenticated: true, status, canSync };
      } catch (statusError) {
        // Note: Removed verbose logging for cleaner console
        return { authenticated: true, status: null, canSync: false };
          }
        } else {
          // Note: Removed verbose logging for cleaner console
          return { authenticated: false, status: null, canSync: false };
        }
      } catch (authError) {
        // Note: Removed verbose logging for cleaner console
        return { authenticated: false, status: null, canSync: false };
      }
    } catch (error) {
      // Note: Removed verbose logging for cleaner console
      return { authenticated: false, status: null, canSync: false };
    }
  }

  // Perform initial sync when user first signs in
  async performInitialSync() {
    try {
      // Note: Removed verbose logging for cleaner console
      await this.performSync();
      this.startPeriodicSync();
    } catch (error) {
      console.error('Initial sync failed:', error);
      this.showSyncError('Initial sync failed. Please try again.');
    }
  }

  // Perform sync operation
  async performSync() {
    if (this.isSyncing) {
      console.log('Sync engine: Sync already in progress, skipping...');
      return;
    }
    
    const syncCheck = await this.canSync();
    if (!syncCheck.canSync) {
      // Note: Removed verbose logging for cleaner console
      return;
    }

    this.isSyncing = true;
    // Note: Removed verbose logging for cleaner console

    try {
      // Get notes for sync - only latest versions of active notes
      const localNotes = await window.notesStorage.getNotesForSync();
      // Note: Removed verbose logging for cleaner console
      
      // Validate localNotes is an array
      if (!Array.isArray(localNotes)) {
        console.error('Sync engine: localNotes is not an array:', typeof localNotes, localNotes);
        throw new Error('Failed to retrieve local notes - invalid format');
      }
      
      // Get local deletions
      const localDeletions = await this.getLocalDeletions();
      // Note: Removed verbose logging for cleaner console
      
      // Validate localDeletions is an array
      if (!Array.isArray(localDeletions)) {
        console.error('Sync engine: localDeletions is not an array:', typeof localDeletions, localDeletions);
        localDeletions = []; // Fallback to empty array
      }
      
      // Only sync notes that have changed since last sync
      const notesToSync = this.lastSyncTime 
        ? localNotes.filter(note => new Date(note.updatedAt) > new Date(this.lastSyncTime))
        : localNotes; // If no last sync time, sync all notes
      
      // Note: Removed verbose logging for cleaner console
      
      // Prepare sync payload - include essential fields including url and domain
      const syncPayload = {
        operation: 'sync',
        notes: notesToSync.map(note => ({
          id: note.id,
          title: note.title,
          content: note.content,
          url: note.url,
          domain: note.domain,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt
          // Explicitly exclude: tags, version, parent_version_id, etc.
        })),
        deletions: localDeletions,
        lastSyncTime: this.lastSyncTime,
        timestamp: Date.now()
      };

      // Note: Removed verbose logging for cleaner console

      // Send to server
      const result = await window.supabaseClient.syncNotes(syncPayload);
      
      if (result.success) {
        // Get any missing notes from server (local priority - only add missing notes)
        const missingNotes = result.missingNotes || [];
        if (missingNotes.length > 0) {
          console.log('Sync: Processing missing notes from server:', missingNotes.length);
          for (const serverNote of missingNotes) {
            // Debug: Log the server note structure
            console.log('Sync: Server note structure:', {
              id: serverNote.id,
              hasUrl: !!serverNote.url,
              hasDomain: !!serverNote.domain,
              url: serverNote.url,
              domain: serverNote.domain,
              title: serverNote.title,
              hasContent: !!serverNote.content
            });
            
            // Only add if note doesn't exist locally
            const localNote = localNotes.find(n => n.id === serverNote.id);
            if (!localNote) {
              // Ensure URL and domain are present before saving
              if (!serverNote.url || !serverNote.domain) {
                console.warn('Sync: Server note missing URL or domain:', serverNote.id);
              }
              await window.notesStorage.saveNote(serverNote);
            }
          }
        }

        // Mark deletions as synced using server response
        if (localDeletions.length > 0) {
          const processedDeletions = result.processedDeletions || [];
          // Note: Removed verbose logging for cleaner console
          
          if (processedDeletions.length > 0) {
            // Extract note IDs from processed deletions
            const processedNoteIds = processedDeletions.map(del => del.id);
            // Note: Removed verbose logging for cleaner console
            
            // Mark deletions as synced by note ID (not deletion record ID)
            await window.notesStorage.markDeletionsAsSyncedByNoteIds(processedNoteIds);
        } else {
            // Note: Removed verbose logging for cleaner console
          }
        }

        // Update sync time
        const now = Date.now();
        await this.saveLastSyncTime(now);
        this.lastSyncTime = now;
        
        // Note: Removed verbose logging for cleaner console
        this.showSyncSuccess('Sync completed successfully');
      } else {
        throw new Error(result.error || 'Sync failed');
      }
      
    } catch (error) {
      console.error('Sync failed:', error);
      this.showSyncError('Sync failed. Changes will be saved locally.');
    } finally {
      this.isSyncing = false;
    }
  }

  // Start periodic sync
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Sync every 5 minutes (300,000 milliseconds)
    this.syncInterval = setInterval(async () => {
      // Note: Removed verbose logging for cleaner console
      
      // Check if we can sync before proceeding
      const syncCheck = await this.canSync();
      if (syncCheck.canSync) {
        // Note: Removed verbose logging for cleaner console
        await this.performSync();
      } else {
        // Note: Removed verbose logging for cleaner console
      }
    }, this.syncIntervalMs);
    
    // Note: Removed verbose logging for cleaner console
  }

  // Stop periodic sync
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Clear sync state on sign out
  clearSyncState() {
    this.stopPeriodicSync();
    this.stopEventListeners();
    this.lastSyncTime = null;
  }

  // Cleanup method for extension shutdown
  cleanup() {
    this.stopPeriodicSync();
    this.stopEventListeners();
  }

  // Manual sync trigger
  async manualSync() {
    if (!(await this.canSync())) {
      this.showSyncError('Premium subscription required for sync');
      return;
    }
    
    try {
      // Note: Removed verbose logging for cleaner console
      await this.performSync();
      this.showSyncSuccess('Manual sync completed successfully');
    } catch (error) {
      this.showSyncError('Manual sync failed');
    }
  }

  // Get local deletions that need to be synced
  async getLocalDeletions() {
    try {
      // Get unsynced deletions from storage
      const unsyncedDeletions = await window.notesStorage.getUnsyncedDeletions();
      
      // Format deletions for sync
      const formattedDeletions = unsyncedDeletions.map(deletion => ({
        id: deletion.noteId,
        deletedAt: deletion.deletedAt
      }));
      
      // Note: Removed verbose logging for cleaner console
      return formattedDeletions;
    } catch (error) {
      console.warn('Failed to get local deletions:', error);
      return [];
    }
  }

  // Show sync success message
  showSyncSuccess(message) {
    try {
      window.urlNotesApp?.showNotification?.(message, 'success');
    } catch (_) {}
  }

  // Show sync error message
  showSyncError(message) {
    try {
      window.urlNotesApp?.showNotification?.(message, 'error');
    } catch (_) {}
  }

  // Handle note update events
  handleNoteUpdate(event) {
    const { noteId, note } = event;
    // Note: Removed verbose logging for cleaner console
    
    // Update last version update time (for tracking purposes only)
    this.lastVersionUpdateTime = Date.now();
    
    // NO automatic sync - only local behavior
    // Sync will happen on timer or manual button press
  }

  // Handle note deletion events
  handleNoteDeletion(event) {
    const { noteId, note } = event;
    // Note: Removed verbose logging for cleaner console
    
    // NO automatic sync - only local behavior
    // Sync will happen on timer or manual button press
  }

  // Handle domain deletion events
  handleDomainDeletion(event) {
    const { domain, deletedCount } = event;
    // Note: Removed verbose logging for cleaner console
    
    // NO automatic sync - only local behavior
    // Sync will happen on timer or manual button press
  }

  // Start event listeners
  startEventListeners() {
    if (window.eventBus) {
      // These events are only for tracking purposes - NO automatic sync
      // Sync only happens on timer (every 5 minutes) or manual button press
      window.eventBus.on('notes:updated', this.handleNoteUpdate.bind(this));
      window.eventBus.on('notes:deleted', this.handleNoteDeletion.bind(this));
      window.eventBus.on('notes:domain_deleted', this.handleDomainDeletion.bind(this));
    }
  }

  // Stop event listeners
  stopEventListeners() {
    if (window.eventBus) {
      window.eventBus.off('notes:updated', this.handleNoteUpdate.bind(this));
      window.eventBus.off('notes:deleted', this.handleNoteDeletion.bind(this));
      window.eventBus.off('notes:domain_deleted', this.handleDomainDeletion.bind(this));
    }
  }
}

// Export singleton instance
window.syncEngine = new SyncEngine();
