// URL Notes Extension - Simplified Sync Engine
// Only syncs latest versions, no version history, local priority

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.isOnline = navigator.onLine;
    this.lastVersionUpdateTime = Date.now();
    this.syncIntervalActive = false;
    this.isInitialized = false;

    this.startEventListeners();
  }

  async init() {
    if (this.isInitialized) {
      return;
    }

    try {
      if (!window.notesStorage) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!window.notesStorage) {
          console.warn('Storage still not ready after wait, skipping sync init');
          return;
        }
      }

      this.setupEventListeners();
      await this.loadLastSyncTime();

      const syncCheck = await this.canSync();
      if (syncCheck.canSync && !this.syncIntervalActive) {
        // Don't send auth-changed message here - it's not an actual auth change
        this.startPeriodicSync();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize sync engine:', error);
    }
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    window.eventBus?.on('notes:updated', (payload) => {
      this.lastVersionUpdateTime = Date.now();
    });

    window.eventBus?.on('notes:deleted', (payload) => {
      // NO automatic sync - only timer-based or manual
    });

    window.eventBus?.on('tier:changed', (status) => {
      if (status && status.active && status.tier !== 'free') {
        this.startPeriodicSync();

        chrome.runtime.sendMessage({
          action: 'tier-changed',
          active: status.active,
          tier: status.tier
        }).catch(() => { });
      } else {
        this.stopPeriodicSync();

        chrome.runtime.sendMessage({
          action: 'tier-changed',
          active: false,
          tier: status.tier || 'free'
        }).catch(() => { });
      }
    });

    window.eventBus?.on('notes:decryption_failed', async (payload) => {
      console.log('Sync: Decryption failed for note, will retry when key becomes available');
      setTimeout(async () => {
        try {
          await this.retryFailedDecryption();
        } catch (error) {
          console.warn('Sync: Failed to retry decryption after failure event:', error);
        }
      }, 2000);
    });

    window.eventBus?.on('auth:changed', (payload) => {
      if (payload && payload.user) {
        chrome.runtime.sendMessage({
          action: 'auth-changed',
          user: payload.user,
          statusRefresh: payload.statusRefresh || false
        }).catch(() => { });

        // Don't perform initial sync automatically - just start periodic sync
        this.startPeriodicSync();
      } else {
        chrome.runtime.sendMessage({ action: 'auth-changed', user: null }).catch(() => { });
        this.clearSyncState();
      }
    });
  }

  async loadLastSyncTime() {
    try {
      const result = await chrome.storage.local.get(['lastSyncTime']);
      this.lastSyncTime = result.lastSyncTime || null;
    } catch (error) {
      console.warn('Failed to load last sync time:', error);
    }
  }

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
      if (!window.noteEncryption) {
        console.warn('Sync: noteEncryption module not available');
        return false;
      }

      if (!window.supabaseClient || typeof window.supabaseClient.getUserEncryptionKey !== 'function') {
        console.warn('Sync: getUserEncryptionKey method not available');
        return false;
      }

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

  async retryFailedDecryption() {
    try {
      const retryCount = await window.notesStorage.getDecryptionRetryCount();
      if (retryCount === 0) {
        return { retried: 0, successful: 0, failed: 0 };
      }

      console.log(`Sync: Found ${retryCount} notes needing decryption retry`);

      let result = await window.notesStorage.retryDecryptionForFailedNotes();

      if (result.failed > 0 && window.supabaseClient?.isAuthenticated()) {
        console.log(`Sync: ${result.failed} notes still failed, refreshing premium status to get encryption key`);

        try {
          await window.supabaseClient.refreshPremiumStatusAndUI();

          await new Promise(resolve => setTimeout(resolve, 1000));

          const secondResult = await window.notesStorage.retryDecryptionForFailedNotes();

          result = {
            retried: result.retried,
            successful: result.successful + secondResult.successful,
            failed: secondResult.failed
          };

          if (secondResult.successful > 0) {
            console.log(`Sync: Successfully decrypted ${secondResult.successful} additional notes after premium refresh`);
          }
        } catch (refreshError) {
          console.warn('Sync: Failed to refresh premium status during decryption retry:', refreshError);
        }
      }

      if (result.successful > 0) {
        console.log(`Sync: Successfully decrypted ${result.successful} notes on retry`);
        this.showSyncSuccess(`Decrypted ${result.successful} previously encrypted notes`);
      }

      return result;
    } catch (error) {
      console.error('Sync: Failed to retry decryption:', error);
      return { retried: 0, successful: 0, failed: 0 };
    }
  }

  async canSync() {
    try {
      if (!window.supabaseClient) {
        return { authenticated: false, status: null, canSync: false };
      }

      if (typeof window.supabaseClient.isAuthenticated !== 'function') {
        return { authenticated: false, status: null, canSync: false };
      }

      try {
        if (window.supabaseClient.isAuthenticated()) {
          try {
            const status = await window.supabaseClient.getSubscriptionStatus();

            // CRITICAL: Multiple checks to ensure premium access
            const isPremium = status && status.active && status.tier === 'premium';

            const currentUser = window.supabaseClient.getCurrentUser();
            if (!currentUser || !currentUser.id) {
              console.warn('Sync: No current user available, cannot sync');
              return { authenticated: false, status, canSync: false };
            }

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

  async performInitialSync() {
    try {
      await this.performSync();
      this.startPeriodicSync();
    } catch (error) {
      console.error('Initial sync failed:', error);
      this.showSyncError('Sync failed');
    }
  }

  async performSync() {
    if (this.isSyncing) {
      return;
    }

    // CRITICAL: Double-check premium status before any sync operation
    if (!(await this.canSync())) {
      console.warn('Sync engine: Attempted sync without premium access - blocking');
      return;
    }

    if (!window.noteEncryption) {
      return;
    }

    this.isSyncing = true;

    try {
      const localNotes = await window.notesStorage.getNotesForSync();

      if (!Array.isArray(localNotes)) {
        console.error('Sync engine: localNotes is not an array:', typeof localNotes, localNotes);
        throw new Error('Failed to retrieve local notes - invalid format');
      }

      const localDeletions = await this.getLocalDeletions();

      if (!Array.isArray(localDeletions)) {
        console.error('Sync engine: localDeletions is not an array:', typeof localDeletions, localDeletions);
        localDeletions = []; // Fallback to empty array
      }

      const notesToSync = this.lastSyncTime
        ? localNotes.filter(note => new Date(note.updatedAt) > new Date(this.lastSyncTime))
        : localNotes;

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
        })),
        deletions: localDeletions,
        lastSyncTime: this.lastSyncTime,
        timestamp: Date.now()
      };

      const result = await window.supabaseClient.syncNotes(syncPayload);

      if (result.success) {
        const missingNotes = result.missingNotes || [];
        if (missingNotes.length > 0) {
          for (const serverNote of missingNotes) {
            const localNote = await window.notesStorage.getNote(serverNote.id);

            if (!localNote) {
              if (!serverNote.url || !serverNote.domain) {
                console.warn('Sync: Server note missing URL or domain:', serverNote.id);
              }
              await window.notesStorage.saveNote(serverNote);
            } else if (localNote.is_deleted) {
              const serverNoteTime = new Date(serverNote.updatedAt || 0);
              const deletionTime = new Date(localNote.deleted_at || 0);

              if (serverNoteTime > deletionTime) {
                // Server note is newer than deletion - restore it
                serverNote.is_deleted = false;
                serverNote.deleted_at = null;
                await window.notesStorage.saveNote(serverNote);

                await window.notesStorage.removeDeletionRecord(serverNote.id);
              }
            }
          }
        }

        if (localDeletions.length > 0) {
          const processedDeletions = result.processedDeletions || [];

          if (processedDeletions.length > 0) {
            const processedNoteIds = processedDeletions.map(del => del.id);
            await window.notesStorage.markDeletionsAsSyncedByNoteIds(processedNoteIds);
          }
        }

        const now = Date.now();
        await this.saveLastSyncTime(now);
        this.lastSyncTime = now;
        this.showSyncSuccess('Sync completed successfully');
      } else {
        throw new Error(result.error || 'Sync failed');
      }

    } catch (error) {
      console.error('Sync failed:', error);
      this.showSyncError('Sync failed');
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

  cleanup() {
    this.stopPeriodicSync();
    this.stopEventListeners();
  }

  async manualSync() {
    if (!(await this.canSync())) {
      this.showSyncError('Upgrade to sync across devices');
      return;
    }

    try {
      await this.performSync();
      this.showSyncSuccess('Synced');
    } catch (error) {
      this.showSyncError('Sync failed');
    }
  }

  resetSyncIntervals() {
    this.stopPeriodicSync();
    this.syncIntervalActive = false;
  }

  async getLocalDeletions() {
    try {
      const unsyncedDeletions = await window.notesStorage.getUnsyncedDeletions();

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

  showSyncSuccess(message) {
    try {
      window.urlNotesApp?.showNotification?.(message, 'success');
    } catch (_) { }
  }

  showSyncError(message) {
    try {
      window.urlNotesApp?.showNotification?.(message, 'error');
    } catch (_) { }
  }

  handleNoteUpdate(event) {
    const { noteId, note } = event;
    this.lastVersionUpdateTime = Date.now();
    // NO automatic sync - only timer-based or manual
  }

  handleNoteDeletion(event) {
    const { noteId, note } = event;
    // NO automatic sync - only timer-based or manual
  }

  handleDomainDeletion(event) {
    const { domain, deletedCount } = event;
    // NO automatic sync - only timer-based or manual
  }

  startEventListeners() {
    if (window.eventBus) {
      // These events are for tracking only - NO automatic sync
      // Sync only happens on timer or manual button press
      window.eventBus.on('notes:updated', this.handleNoteUpdate.bind(this));
      window.eventBus.on('notes:deleted', this.handleNoteDeletion.bind(this));
      window.eventBus.on('notes:domain_deleted', this.handleDomainDeletion.bind(this));
    }
  }

  stopEventListeners() {
    if (window.eventBus) {
      window.eventBus.off('notes:updated', this.handleNoteUpdate.bind(this));
      window.eventBus.off('notes:deleted', this.handleNoteDeletion.bind(this));
      window.eventBus.off('notes:domain_deleted', this.handleDomainDeletion.bind(this));
    }
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      syncIntervalActive: this.syncIntervalActive,
      lastSyncTime: this.lastSyncTime,
      isOnline: this.isOnline
    };
  }

  logSyncStatus() {
    const status = this.getSyncStatus();
  }
}

window.syncEngine = new SyncEngine();
