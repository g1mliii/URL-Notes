// URL Notes Extension - Sync Engine
// Orchestrates cloud sync operations, conflict resolution, and offline handling

class SyncEngine {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncInterval = null;
    this.retryBackoff = 1000; // Start with 1 second
    this.maxRetryBackoff = 30000; // Max 30 seconds
  }

  // Initialize sync engine
  async init() {
    this.setupEventListeners();
    await this.loadLastSyncTime();
    
    // Check if we should start sync for authenticated premium users
    if (await this.canSync()) {
      this.startPeriodicSync();
    }
  }

  // Setup online/offline detection and sync triggers
  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushOfflineQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Listen for note changes to trigger sync
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('note_')) {
        this.queueSyncOperation('update', e.newValue);
      }
    });

    // Listen for auth changes
    window.eventBus?.on('auth:changed', (payload) => {
      if (payload.event === 'SIGNED_IN') {
        this.performInitialSync();
      } else if (payload.event === 'SIGNED_OUT') {
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

  // Check if user is premium and authenticated
  async canSync() {
    try {
      if (!window.supabaseClient?.isAuthenticated()) {
        return false;
      }
      
      const status = await window.supabaseClient.getSubscriptionStatus();
      return status.active && status.tier !== 'free';
    } catch (error) {
      console.warn('Failed to check sync eligibility:', error);
      return false;
    }
  }

  // Perform initial sync when user first signs in
  async performInitialSync() {
    if (!(await this.canSync())) return;
    
    try {
      console.log('Performing initial sync...');
      await this.pullFromCloud();
      this.startPeriodicSync();
    } catch (error) {
      console.error('Initial sync failed:', error);
      this.showSyncError('Initial sync failed. Please try again.');
    }
  }

  // Pull notes from cloud since last sync
  async pullFromCloud() {
    if (!(await this.canSync())) return [];
    
    try {
      const notes = await window.supabaseClient.fetchNotes(this.lastSyncTime);
      
      if (notes.length > 0) {
        await this.mergeCloudNotes(notes);
        console.log(`Pulled ${notes.length} notes from cloud`);
      }
      
      // Update last sync time
      const now = new Date().toISOString();
      await this.saveLastSyncTime(now);
      
      // Emit event for UI updates
      window.eventBus?.emit('notes:synced', { 
        source: 'cloud', 
        count: notes.length,
        timestamp: now
      });
      
      return notes;
    } catch (error) {
      console.error('Pull from cloud failed:', error);
      throw error;
    }
  }

  // Push local changes to cloud
  async pushToCloud() {
    if (!(await this.canSync())) return;
    
    try {
      // Get local changes since last sync
      const localChanges = await this.getLocalChanges();
      
      if (localChanges.length === 0) {
        return { success: true, count: 0 };
      }
      
      // Save versions before pushing
      for (const change of localChanges) {
        if (change.operation === 'update' && change.note) {
          // Save version for premium users
          if (change.note && window.notesStorage?.isVersionHistoryAvailable?.()) {
            await window.notesStorage.saveNoteVersion(change.note);
            await window.notesStorage.cleanupOldVersions(change.note.id, 10);
          }
        }
      }
      
      // Push to cloud
      const result = await window.supabaseClient.syncNotes(localChanges);
      
      // Handle conflicts if any
      if (result.conflicts && result.conflicts.length > 0) {
        for (const conflict of result.conflicts) {
          await this.handleConflict(conflict);
        }
      }
      
      // Update last sync time
      const now = new Date().toISOString();
      await this.saveLastSyncTime(now);
      
      // Emit event for UI updates
      window.eventBus?.emit('notes:synced', { 
        source: 'local', 
        count: localChanges.length,
        conflicts: result.conflicts?.length || 0,
        timestamp: now
      });
      
      console.log(`Pushed ${localChanges.length} notes to cloud`);
      return { success: true, count: localChanges.length };
    } catch (error) {
      console.error('Push to cloud failed:', error);
      throw error;
    }
  }

  // Get local changes since last sync
  async getLocalChanges() {
    try {
      const allNotes = await window.notesStorage.getAllNotes();
      const changes = [];
      
      for (const note of allNotes) {
        // Check if note was modified since last sync
        if (new Date(note.updatedAt) > new Date(this.lastSyncTime || 0)) {
          changes.push({
            operation: 'update',
            note: note
          });
        }
      }
      
      return changes;
    } catch (error) {
      console.error('Failed to get local changes:', error);
      return [];
    }
  }

  // Merge cloud notes with local storage
  async mergeCloudNotes(cloudNotes) {
    try {
      for (const cloudNote of cloudNotes) {
        const localNote = await window.notesStorage.getNote(cloudNote.id);
        
        if (!localNote) {
          // New note from cloud - add to local storage
          await window.notesStorage.saveNote(cloudNote);
        } else {
          // Check for conflicts
          const hasConflict = await this.detectConflict(localNote, cloudNote);
          
          if (hasConflict) {
            // Resolve conflict using last-write-wins
            const resolvedNote = await this.resolveConflict(localNote, cloudNote);
            await window.notesStorage.saveNote(resolvedNote);
          } else if (new Date(cloudNote.updatedAt) > new Date(localNote.updatedAt)) {
            // Cloud version is newer - update local
            await window.notesStorage.saveNote(cloudNote);
          }
        }
      }
    } catch (error) {
      console.error('Failed to merge cloud notes:', error);
      throw error;
    }
  }

  // Detect conflicts between local and cloud notes
  async detectConflict(localNote, cloudNote) {
    try {
      // Check if content has diverged
      const localHash = await window.noteEncryption.generateContentHash(
        localNote.content + localNote.title
      );
      const cloudHash = cloudNote.content_hash;
      
      return localHash !== cloudHash && 
             new Date(localNote.updatedAt) > new Date(this.lastSyncTime) &&
             new Date(cloudNote.updatedAt) > new Date(this.lastSyncTime);
    } catch (error) {
      console.error('Conflict detection failed:', error);
      return false;
    }
  }

  // Resolve conflicts using last-write-wins
  async resolveConflict(localNote, cloudNote) {
    const localTime = new Date(localNote.updatedAt);
    const cloudTime = new Date(cloudNote.updatedAt);
    
    // Use the more recent version
    if (localTime > cloudTime) {
      return localNote;
    } else {
      return cloudNote;
    }
  }

  // Handle conflicts using Edge Function
  async handleConflict(conflict) {
    try {
      // Show conflict banner to user
      window.eventBus?.emit('conflict:detected', conflict);
      
      // For now, use last-write-wins as fallback
      const resolvedNote = await this.resolveConflict(conflict.local, conflict.server);
      
      // Update local storage
      await window.notesStorage.saveNote(resolvedNote);
      
      // Mark as resolved in cloud
      await window.supabaseClient.resolveConflict(
        conflict.id, 
        resolvedNote === conflict.local ? 'keep_local' : 'use_server',
        resolvedNote === conflict.local ? resolvedNote : null
      );
      
      console.log(`Conflict resolved for note ${conflict.id}`);
      
    } catch (error) {
      console.error('Failed to handle conflict:', error);
      // Queue for manual resolution
      this.queueSyncOperation('resolve_conflict', { conflict, timestamp: Date.now() });
    }
  }

  // Queue sync operation for offline handling
  queueSyncOperation(operation, data) {
    if (this.isOnline) {
      // Try immediate sync if online
      this.performSync();
    } else {
      // Queue for later if offline
      this.syncQueue.push({ operation, data, timestamp: Date.now() });
      console.log(`Queued sync operation: ${operation}`);
    }
  }

  // Flush offline queue when back online
  async flushOfflineQueue() {
    if (this.syncQueue.length === 0) return;
    
    console.log(`Flushing ${this.syncQueue.length} queued sync operations`);
    
    try {
      await this.performSync();
      this.syncQueue = []; // Clear queue after successful sync
    } catch (error) {
      console.error('Failed to flush offline queue:', error);
    }
  }

  // Perform sync operation with retry logic
  async performSync() {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    
    try {
      // Pull first, then push
      await this.pullFromCloud();
      await this.pushToCloud();
      
      // Reset retry backoff on success
      this.retryBackoff = 1000;
      
    } catch (error) {
      console.error('Sync failed:', error);
      
      // Implement exponential backoff for retries
      if (this.isOnline) {
        setTimeout(() => {
          this.performSync();
        }, this.retryBackoff);
        
        this.retryBackoff = Math.min(this.retryBackoff * 2, this.maxRetryBackoff);
      }
      
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
    
    // Sync every 5 minutes
    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.canSync()) {
        this.performSync();
      }
    }, 5 * 60 * 1000);
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
    this.syncQueue = [];
    this.lastSyncTime = null;
    this.retryBackoff = 1000;
  }

  // Get sync status for UI
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      queueLength: this.syncQueue.length,
      canSync: this.canSync()
    };
  }

  // Show sync error to user
  showSyncError(message) {
    window.eventBus?.emit('sync:error', { message });
    
    // Also show as toast if available
    if (window.showToast) {
      window.showToast(message, 'error');
    }
  }

  // Manual sync trigger
  async manualSync() {
    if (!(await this.canSync())) {
      this.showSyncError('Premium subscription required for sync');
      return;
    }
    
    try {
      await this.performSync();
      this.showSyncSuccess('Sync completed successfully');
    } catch (error) {
      this.showSyncError('Manual sync failed');
    }
  }

  // Show sync success message
  showSyncSuccess(message) {
    window.eventBus?.emit('sync:success', { message });
    
    if (window.showToast) {
      window.showToast(message, 'success');
    }
  }
}

// Export singleton instance
window.syncEngine = new SyncEngine();
