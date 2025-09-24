// URL Notes Extension - Simplified Sync Engine
// Only syncs latest versions, no version history, local priority

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.isOnline = navigator.onLine;
    this.lastVersionUpdateTime = Date.now();
    this.syncIntervalActive = false; // Flag to track if sync is enabled
    this.isInitialized = false; // Flag to prevent multiple initializations

    // Start event listeners (for tracking purposes only, no auto-sync)
    this.startEventListeners();
  }

  // Initialize sync engine
  async init() {
    // Prevent multiple initializations
    if (this.isInitialized) {
      return;
    }

    try {
      // Wait for storage to be ready
      if (!window.notesStorage) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!window.notesStorage) {
          console.warn('Storage still not ready after wait, skipping sync init');
          return;
        }
      }

      this.setupEventListeners();
      await this.loadLastSyncTime();

      // Check if we should start sync for authenticated premium users
      const syncCheck = await this.canSync();
      if (syncCheck.canSync && !this.syncIntervalActive) {
        // Don't send auth-changed message here - it's not an actual auth change
        // Just start periodic sync locally
        this.startPeriodicSync();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize sync engine:', error);
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

    // Listen for tier changes
    window.eventBus?.on('tier:changed', (status) => {
      if (status && status.active && status.tier !== 'free') {
        this.startPeriodicSync();

        // Notify background script to start sync timer
        chrome.runtime.sendMessage({
          action: 'tier-changed',
          active: status.active,
          tier: status.tier
        }).catch(() => { });
      } else {
        this.stopPeriodicSync();

        // Notify background script to stop sync timer
        chrome.runtime.sendMessage({
          action: 'tier-changed',
          active: false,
          tier: status.tier || 'free'
        }).catch(() => { });
      }
    });

    // Listen for auth changes
    window.eventBus?.on('auth:changed', (payload) => {
      if (payload && payload.user) {
        // Notify background script to start timer
        chrome.runtime.sendMessage({
          action: 'auth-changed',
          user: payload.user,
          statusRefresh: payload.statusRefresh || false
        }).catch(() => { });

        // Don't perform initial sync automatically - just start periodic sync
        this.startPeriodicSync();
      } else {
        // Notify background script to stop timer
        chrome.runtime.sendMessage({ action: 'auth-changed', user: null }).catch(() => { });
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

  // Check if encryption key is available (prevents placeholder content)
  async isEncryptionReady() {
    try {
      // Check if encryption module is loaded
      if (!window.noteEncryption) {
        console.warn('Sync: noteEncryption module not available');
        return false;
      }

      // Check if we can get the encryption key (this is the critical check)
      if (!window.supabaseClient || typeof window.supabaseClient.getUserEncryptionKey !== 'function') {
        console.warn('Sync: getUserEncryptionKey method not available');
        return false;
      }

      // Try to get the encryption key - this is what prevents placeholder content
      try {
        const encryptionKey = await window.supabaseClient.getUserEncryptionKey();
        if (!encryptionKey) {
          console.warn('Sync: No encryption key available - would cause placeholder content');
          return false;
        }

        return true;
      } catch (keyError) {
        console.warn('Sync: Failed to get encryption key - would cause placeholder content:', keyError.message);
        return false;
      }

    } catch (error) {
      console.warn('Sync: Encryption key check failed:', error.message);
      return false;
    }
  }

  // Check if user can sync
  async canSync() {
    try {
      // Early exit if no Supabase client
      if (!window.supabaseClient) {
        return { authenticated: false, status: null, canSync: false };
      }

      // Check if auth is available before calling getUser
      if (typeof window.supabaseClient.isAuthenticated !== 'function') {
        return { authenticated: false, status: null, canSync: false };
      }

      // Check authentication first
      try {
        if (window.supabaseClient.isAuthenticated()) {
          // Verify the token is still valid before checking subscription
          const isValidToken = await window.supabaseClient.verifyToken();
          if (!isValidToken) {
            console.warn('Sync: Authentication token is invalid, cannot sync');
            return { authenticated: false, status: null, canSync: false };
          }

          // User is authenticated with valid token, check subscription status
          try {
            const status = await window.supabaseClient.getSubscriptionStatus();

            // CRITICAL: Multiple checks to ensure premium access
            const isPremium = status && status.active && status.tier === 'premium';

            // Additional check: ensure we have a current user object
            const currentUser = window.supabaseClient.getCurrentUser();
            if (!currentUser || !currentUser.id) {
              console.warn('Sync: No current user available, cannot sync');
              return { authenticated: false, status, canSync: false };
            }

            // Final safety check: if tier is explicitly 'free', block sync
            if (status && status.tier === 'free') {
              return { authenticated: true, status, canSync: false };
            }

            // CRITICAL: Ensure encryption is fully ready before allowing sync
            if (isPremium) {
              const encryptionReady = await this.isEncryptionReady();
              if (!encryptionReady) {
                console.warn('Sync: Premium active but encryption not ready - blocking sync');
                return { authenticated: true, status, canSync: false };
              }
            }

            return { authenticated: true, status, canSync: isPremium };
          } catch (statusError) {
            console.warn('Sync: Failed to get subscription status:', statusError);
            return { authenticated: true, status: null, canSync: false };
          }
        } else {
          return { authenticated: false, status: null, canSync: false };
        }
      } catch (authError) {
        console.warn('Sync: Authentication check failed:', authError);
        return { authenticated: false, status: null, canSync: false };
      }
    } catch (error) {
      console.warn('Sync: canSync check failed:', error);
      return { authenticated: false, status: null, canSync: false };
    }
  }

  // Perform initial sync when user first signs in
  async performInitialSync() {
    try {
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
      return;
    }



    // CRITICAL: Double-check premium status before any sync operation
    if (!(await this.canSync())) {
      console.warn('Sync engine: Attempted sync without premium access - blocking');
      return;
    }

    // Ensure encryption is available
    if (!window.noteEncryption) {
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

      // Validate localDeletions is an array
      if (!Array.isArray(localDeletions)) {
        console.error('Sync engine: localDeletions is not an array:', typeof localDeletions, localDeletions);
        localDeletions = []; // Fallback to empty array
      }

      // Only sync notes that have changed since last sync
      const notesToSync = this.lastSyncTime
        ? localNotes.filter(note => new Date(note.updatedAt) > new Date(this.lastSyncTime))
        : localNotes; // If no last sync time, sync all notes

      // Check if we have anything to sync (notes OR deletions)
      const hasNotesToSync = notesToSync.length > 0;
      const hasDeletionsToSync = localDeletions.length > 0;

      // Always proceed with sync to check for server notes, even if no local changes

      // Prepare sync payload - include essential fields including url, domain, and tags
      const syncPayload = {
        operation: 'sync',
        notes: notesToSync.map(note => ({
          id: note.id,
          title: note.title,
          content: note.content,
          url: note.url,
          domain: note.domain,
          tags: note.tags || [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt
          // Explicitly exclude: version, parent_version_id, etc.
        })),
        deletions: localDeletions,
        lastSyncTime: this.lastSyncTime,
        timestamp: Date.now()
      };

      // Send to server

      const result = await window.supabaseClient.syncNotes(syncPayload);

      if (result.success) {

        // Get any missing notes from server (local priority - only add missing notes)
        const missingNotes = result.missingNotes || [];
        if (missingNotes.length > 0) {
          for (const serverNote of missingNotes) {

            // Check if note exists locally (including deleted notes)
            const localNote = await window.notesStorage.getNote(serverNote.id);

            if (!localNote) {
              // Note doesn't exist locally - safe to add
              // Ensure URL and domain are present before saving
              if (!serverNote.url || !serverNote.domain) {
                console.warn('Sync: Server note missing URL or domain:', serverNote.id);
              }
              await window.notesStorage.saveNote(serverNote);
            } else if (localNote.is_deleted) {
              // Note exists locally but is marked as deleted
              // Check if server note is newer than deletion
              const serverNoteTime = new Date(serverNote.updatedAt || 0);
              const deletionTime = new Date(localNote.deleted_at || 0);

              if (serverNoteTime > deletionTime) {
                // Server note is newer than deletion - restore it
                // Clear deletion flags
                serverNote.is_deleted = false;
                serverNote.deleted_at = null;
                await window.notesStorage.saveNote(serverNote);

                // Remove the deletion record since we're restoring the note
                await window.notesStorage.removeDeletionRecord(serverNote.id);
              } else {
                // Server note is older than deletion - keep it deleted locally
              }
            } else {
              // Note exists locally and is not deleted - skip (local priority)
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

  // Start periodic sync (now handled by background script)
  startPeriodicSync() {
    // Timer logic moved to background script for persistence
    // This method is kept for compatibility but doesn't start timers
    this.syncIntervalActive = true;
  }

  // Stop periodic sync (now handled by background script)
  stopPeriodicSync() {
    // Timer logic moved to background script for persistence
    // This method is kept for compatibility but doesn't stop timers
    this.syncIntervalActive = false;
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
      await this.performSync();
      this.showSyncSuccess('Manual sync completed successfully');
    } catch (error) {
      this.showSyncError('Manual sync failed');
    }
  }

  // Reset sync intervals (for debugging)
  resetSyncIntervals() {
    this.stopPeriodicSync();
    this.syncIntervalActive = false;
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
    } catch (_) { }
  }

  // Show sync error message
  showSyncError(message) {
    try {
      window.urlNotesApp?.showNotification?.(message, 'error');
    } catch (_) { }
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

  // Get current sync status for debugging
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      syncIntervalActive: this.syncIntervalActive,
      lastSyncTime: this.lastSyncTime,
      isOnline: this.isOnline
    };
  }

  // Debug method to log sync status
  logSyncStatus() {
    const status = this.getSyncStatus();
    // Status logging removed for cleaner console
  }
}

// Export singleton instance
window.syncEngine = new SyncEngine();
