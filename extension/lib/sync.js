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
    const syncCheck = await this.canSync();
    if (syncCheck.canSync) {
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

    // Listen for IndexedDB note updates (from storage.js)
    window.eventBus?.on('notes:updated', (payload) => {
      console.log('Sync engine: notes:updated event received:', payload);
      this.queueSyncOperation('update', payload.note);
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

  // Check if user can sync
  async canSync() {
    try {
      // Early exit if no Supabase client
      if (!window.supabaseClient) {
        console.log('Sync engine: No Supabase client available');
        return { authenticated: false, status: null, canSync: false };
      }

      // Check if auth is available before calling getUser
      if (!window.supabaseClient.auth) {
        console.log('Sync engine: Supabase auth not available');
        return { authenticated: false, status: null, canSync: false };
      }

      // Check authentication first
      try {
        const { data: { user }, error } = await window.supabaseClient.auth.getUser();
        if (!user || error) {
          console.log('Sync engine: User not authenticated');
          return { authenticated: false, status: null, canSync: false };
        }
      } catch (authError) {
        console.log('Sync engine: Auth check failed:', authError.message);
        return { authenticated: false, status: null, canSync: false };
      }

      // Check subscription status
      try {
        const status = await window.supabaseClient.getSubscriptionStatus();
        const canSync = status && status.active;
        
        console.log('Sync engine: canSync check:', { authenticated: true, status, canSync });
        return { authenticated: true, status, canSync };
      } catch (statusError) {
        console.log('Sync engine: Subscription check failed:', statusError.message);
        return { authenticated: true, status: null, canSync: false };
      }
    } catch (error) {
      console.log('Sync engine: Error checking sync capability:', error.message);
      return { authenticated: false, status: null, canSync: false };
    }
  }

  // Perform initial sync when user first signs in
  async performInitialSync() {
    const syncCheck = await this.canSync();
    if (!syncCheck.canSync) return;
    
    try {
      console.log('Performing initial sync...');
      await this.pullFromCloud();
      this.startPeriodicSync();
    } catch (error) {
      console.error('Initial sync failed:', error);
      this.showSyncError('Initial sync failed. Please try again.');
    }
  }

  // Pull notes from cloud
  async pullFromCloud() {
    const syncCheck = await this.canSync();
    if (!syncCheck.canSync) return [];
    
    try {
      console.log('Sync engine: Pulling from cloud...');
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
    console.log('Sync engine: pushToCloud called');
    
    const syncCheck = await this.canSync();
    if (!syncCheck.canSync) {
      console.log('Sync engine: Cannot sync, returning early');
      return;
    }
    
    try {
      // Get local changes since last sync
      const localChanges = await this.getLocalChanges();
      
      if (localChanges.length === 0) {
        return { success: true, count: 0 };
      }
      
      // Save versions before pushing - only for actual content changes
      for (const change of localChanges) {
        if (change.operation === 'update' && change.note && !change.note.is_deleted) {
          // Only save versions for premium users and when content actually changed
          if (change.note && window.notesStorage?.isVersionHistoryAvailable?.()) {
            // Check if this is a real content change (not just sync metadata update)
            const shouldCreateVersion = this.shouldCreateVersion(change.note);
            if (shouldCreateVersion) {
              await window.notesStorage.saveNoteVersion(change.note);
              await window.notesStorage.cleanupOldVersions(change.note.id, 10);
            }
          }
        }
      }
      
      // Push to cloud - add operation field and prepare notes for Edge Function
      const notesToSync = localChanges.map(change => {
        const note = { ...change.note };
        
        // Log the note structure for debugging
        console.log('Sync engine: Processing note for sync:', {
          id: note.id,
          title: note.title,
          hasTitleEncrypted: !!note.title_encrypted,
          hasContentEncrypted: !!note.content_encrypted,
          hasContent: !!note.content,
          operation: change.operation
        });
        
        // Validate note has required fields (either encrypted or unencrypted)
        const hasEncryptedFields = note.title_encrypted && note.content_encrypted;
        const hasUnencryptedFields = note.title && note.content;
        
        if (!note.id || (!hasEncryptedFields && !hasUnencryptedFields)) {
          console.error('Sync engine: Note missing required fields:', {
            id: note.id,
            hasTitleEncrypted: !!note.title_encrypted,
            hasContentEncrypted: !!note.content_encrypted,
            hasTitle: !!note.title,
            hasContent: !!note.content,
            note: note
          });
          // Skip invalid notes
          return null;
        }
        
        // If note doesn't have encrypted fields, use unencrypted ones
        if (!hasEncryptedFields && hasUnencryptedFields) {
          console.log(`Sync engine: Note ${note.id} using unencrypted fields for sync`);
          note.title_encrypted = note.title;
          note.content_encrypted = note.content;
        }
        
        // Add version history data for sync to Supabase
        if (change.operation === 'create' || change.operation === 'update') {
          try {
            // Get existing versions for this note from local storage
            const getVersions = async () => {
              try {
                if (window.notesStorage?.getVersionHistory) {
                  const versions = await window.notesStorage.getVersionHistory(note.id, 50); // Get up to 50 versions
                  console.log(`Sync engine: Found ${versions.length} local versions for note ${note.id}`);
                  return versions;
                }
              } catch (error) {
                console.warn(`Sync engine: Could not retrieve versions for note ${note.id}:`, error);
              }
              return [];
            };
            
            // For now, we'll add a placeholder for versions - the actual versions will be retrieved
            // by the Edge Function when it processes the note
            note.hasLocalVersions = true;
            note.localVersionCount = 0; // Will be updated by Edge Function
          } catch (error) {
            console.warn(`Sync engine: Error preparing version data for note ${note.id}:`, error);
          }
        }
        
        // Handle migrated notes that need new IDs
        if (note.needsIdMigration && note.oldId) {
          console.log(`Sync engine: Processing migrated note from old ID ${note.oldId} to new UUID ${note.id}`);
          // This note was migrated from old ID format
          // For create operations, we'll create a new note with the new UUID
          if (change.operation === 'update') {
            change.operation = 'create'; // Change to create since it's a new ID
            console.log(`Sync engine: Changed operation from 'update' to 'create' for migrated note ${note.id}`);
          }
          // Remove migration flags
          delete note.needsIdMigration;
          delete note.oldId;
        }
        
        // Handle deleted notes
        if (note.is_deleted && change.operation === 'update') {
          change.operation = 'delete';
          console.log(`Sync engine: Converting soft delete to delete operation for note ${note.id}`);
        }
        
        return {
          ...note,
          operation: change.operation,
          updated_at: note.updatedAt, // Convert camelCase to snake_case for Edge Function
          previous_hash: note.content_hash, // For conflict detection
          deleted_at: note.deleted_at // For delete operations
        };
      }).filter(note => note !== null); // Remove invalid notes
      
      console.log('Sync engine: Syncing notes:', notesToSync.map(n => ({ id: n.id, title: n.title, operation: n.operation })));
      
      // Log the full payload being sent
      console.log('Sync engine: Full payload being sent to Edge Function:', {
        operation: 'push',
        notes: notesToSync,
        lastSyncTime: this.lastSyncTime
      });
      
      const result = await window.supabaseClient.syncNotes(notesToSync);
      console.log('Sync engine: Push result:', result);
      
      // Handle conflicts if any
      if (result.conflicts && result.conflicts.length > 0) {
        console.log(`Sync engine: Found ${result.conflicts.length} conflicts, resolving...`);
        for (const conflict of result.conflicts) {
          try {
            await this.handleConflict(conflict);
          } catch (conflictError) {
            console.error(`Sync engine: Failed to handle conflict for note ${conflict.id}:`, conflictError);
            // Continue with other conflicts instead of failing entire sync
          }
        }
      }
      
      // Mark successfully synced notes as no longer pending
      await this.markNotesAsSynced(localChanges);
      
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

  // Mark notes as successfully synced and trigger cleanup
  async markNotesAsSynced(localChanges) {
    try {
      for (const change of localChanges) {
        const note = change.note;
        if (note && note.sync_pending) {
          // Mark as synced
          note.sync_pending = false;
          note.last_synced = new Date().toISOString();
          
          // Update in storage
          await window.notesStorage.updateNoteSyncStatus(note.id, {
            sync_pending: false,
            last_synced: note.last_synced
          });
        }
      }
      
      // Trigger cleanup of soft deleted notes that are now synced
      await window.notesStorage.cleanupSyncedDeletedNotes();
      
    } catch (error) {
      console.warn('Failed to mark notes as synced:', error);
    }
  }

  // Determine if a version should be created for this note change
  shouldCreateVersion(note) {
    // Don't create versions for sync metadata updates
    if (note.sync_pending !== undefined || note.last_synced !== undefined) {
      return false;
    }
    
    // Don't create versions for soft deletes
    if (note.is_deleted) {
      return false;
    }
    
    // Only create versions for actual content changes
    // Check if this is a real content update (not just timestamp sync)
    const hasContentChange = note.title || note.content;
    const isRealUpdate = hasContentChange && note.updatedAt;
    
    return isRealUpdate;
  }

  // Get local changes since last sync
  async getLocalChanges() {
    try {
      const allNotes = await window.notesStorage.getAllNotes();
      const changes = [];
      
      // If no lastSyncTime, consider all notes as changes (initial sync)
      const lastSync = this.lastSyncTime ? new Date(this.lastSyncTime) : new Date(0);
      
      for (const note of allNotes) {
        // Skip notes that are already synced and don't need updates
        if (note.sync_pending === false && !note.is_deleted) {
          continue;
        }
        
        // Check if note was modified since last sync
        const noteDate = new Date(note.updatedAt);
        const isModified = noteDate > lastSync;
        
        // Check if note was deleted since last sync
        const wasDeleted = note.is_deleted && note.deleted_at && new Date(note.deleted_at) > lastSync;
        
        // Check if note needs sync (has pending changes)
        const needsSync = note.sync_pending === true;
        
        console.log(`Sync engine: Note ${note.id} (${note.title}): updatedAt=${note.updatedAt}, lastSync=${lastSync.toISOString()}, isModified=${isModified}, wasDeleted=${wasDeleted}, needsSync=${needsSync}`);
        
        if (isModified || wasDeleted || needsSync) {
          let operation = 'update';
          
          // If note was deleted, mark as delete operation
          if (wasDeleted) {
            operation = 'delete';
          }
          
          changes.push({
            operation: operation,
            note: note
          });
        }
      }
      
      console.log(`Sync engine: Found ${changes.length} local changes since ${lastSync.toISOString()}`);
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

  // Resolve conflicts using last-write-wins strategy
  async resolveConflict(localNote, serverNote) {
    try {
      if (!localNote || !serverNote) {
        console.warn('Sync engine: Missing note data for conflict resolution');
        return localNote || serverNote;
      }
      
      const localTime = new Date(localNote.updatedAt || localNote.updated_at || 0);
      const serverTime = new Date(serverNote.updatedAt || serverNote.updated_at || 0);
      
      // Use the more recent version
      if (localTime > serverTime) {
        console.log(`Sync engine: Resolving conflict by keeping local version (${localTime} > ${serverTime})`);
        return localNote;
      } else {
        console.log(`Sync engine: Resolving conflict by using server version (${serverTime} >= ${localTime})`);
        return serverNote;
      }
    } catch (error) {
      console.error('Sync engine: Error in resolveConflict:', error);
      // Fallback to local note if resolution fails
      return localNote;
    }
  }

  // Handle conflicts using Edge Function
  async handleConflict(conflict) {
    try {
      console.log(`Sync engine: Handling conflict for note ${conflict.id}`);
      
      // Show conflict banner to user
      window.eventBus?.emit('conflict:detected', conflict);
      
      // For now, use last-write-wins as fallback
      const resolvedNote = await this.resolveConflict(conflict.local, conflict.server);
      
      if (!resolvedNote) {
        console.warn(`Sync engine: Could not resolve conflict for note ${conflict.id}, skipping`);
        return;
      }
      
      // Update local storage
      try {
        await window.notesStorage.saveNote(resolvedNote);
        console.log(`Sync engine: Successfully saved resolved note ${conflict.id} to local storage`);
      } catch (saveError) {
        console.error(`Sync engine: Failed to save resolved note ${conflict.id} to local storage:`, saveError);
        throw saveError; // Re-throw to be caught by outer catch
      }
      
      // Mark as resolved in cloud
      try {
        const result = await window.supabaseClient.resolveConflict(
          conflict.id, 
          resolvedNote === conflict.local ? 'keep_local' : 'use_server',
          resolvedNote === conflict.local ? resolvedNote : null
        );
        
        if (result && result.success) {
          console.log(`Conflict resolved for note ${conflict.id}`);
        } else {
          console.warn(`Conflict resolution failed for note ${conflict.id}:`, result ? result.error : 'No result returned');
        }
      } catch (resolveError) {
        console.warn(`Failed to mark conflict as resolved in cloud for note ${conflict.id}:`, resolveError);
        // Don't throw - local resolution is still successful
      }
      
    } catch (error) {
      console.error(`Failed to handle conflict for note ${conflict.id}:`, error);
      // Queue for manual resolution instead of failing
      this.queueSyncOperation('resolve_conflict', { conflict, timestamp: Date.now() });
    }
  }

  // Queue sync operation for offline handling
  async queueSyncOperation(operation, data) {
    try {
      const syncCheck = await this.canSync();
      if (syncCheck.canSync) {
        this.syncQueue.push({ operation, data, timestamp: Date.now() });
        console.log(`Sync engine: Queueing operation: ${operation}`, data);
        
        if (this.isOnline) {
          console.log('Sync engine: Online, performing immediate sync');
          this.performSync();
        }
      } else {
        console.log('Sync engine: Cannot sync, operation queued for later');
        this.syncQueue.push({ operation, data, timestamp: Date.now() });
      }
    } catch (error) {
      console.error('Sync engine: Error queueing sync operation:', error);
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
    if (this.isSyncing) {
      console.log('Sync engine: Already syncing, skipping');
      return;
    }
    
    console.log('Sync engine: Starting sync operation');
    this.isSyncing = true;
    
    try {
      // Pull first, then push
      console.log('Sync engine: Pulling from cloud...');
      await this.pullFromCloud();
      console.log('Sync engine: Pushing to cloud...');
      await this.pushToCloud();
      
      // Reset retry backoff on success
      this.retryBackoff = 1000;
      console.log('Sync engine: Sync completed successfully');
      
      // Check and sync any unsynced versions
      await this.checkAndSyncVersions();
      
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

  // Prevent duplicate sync operations for the same note
  isNoteBeingSynced(noteId) {
    return this.syncQueue.some(item => 
      item.data && item.data.noteId === noteId
    );
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
      console.log('Sync engine: Starting manual sync...');
      
      // First do regular sync
      await this.performSync();
      
      // Then sync existing local versions to cloud
      console.log('Sync engine: Starting version sync after regular sync...');
      await this.syncLocalVersionsToCloud();
      
      this.showSyncSuccess('Manual sync completed successfully');
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

  // Sync local versions to cloud
  async syncLocalVersionsToCloud() {
    const syncCheck = await this.canSync();
    if (!syncCheck.canSync) {
      console.log('Sync engine: Cannot sync versions, user not authenticated or premium');
      return;
    }
    
    console.log('Sync engine: Starting local version sync to cloud...');
    
    try {
      // Get all notes that have versions
      const allNotes = await window.notesStorage.getAllNotes();
      let totalVersionsSynced = 0;
      
      for (const note of allNotes) {
        if (note.is_deleted) continue; // Skip deleted notes
        
        try {
          // Get versions for this note
          const versions = await window.notesStorage.getVersionHistory(note.id, 10);
          if (!versions || versions.length === 0) continue;
          
          // First check if the note exists in Supabase before syncing versions
          try {
            // Try to get the note from cloud to ensure it exists
            const noteExists = await window.supabaseClient.fetchNotes(null);
            const cloudNote = noteExists.find(n => n.id === note.id);
            
            if (!cloudNote) {
              console.warn(`Sync engine: Note ${note.id} doesn't exist in cloud, skipping version sync`);
              continue;
            }
          } catch (noteCheckError) {
            console.warn(`Sync engine: Could not verify note ${note.id} exists in cloud, skipping version sync:`, noteCheckError);
            continue;
          }
          
          // Send versions to Edge Function for sync
          const versionData = await Promise.all(versions.map(async (version) => {
            try {
              // Ensure we have required fields and generate content_hash if missing
              const contentHash = version.content_hash || version.contentHash || 
                (version.content ? this.generateContentHash(version.content + (version.title || '')) : null);
              
              if (!contentHash) {
                console.warn(`Sync engine: Skipping version ${version.version} for note ${note.id} - no content_hash available`);
                return null;
              }
              
              // Encrypt version data if we have encryption available
              let titleEncrypted = version.title_encrypted;
              let contentEncrypted = version.content_encrypted;
              
              if (!titleEncrypted && !contentEncrypted && window.noteEncryption && window.supabaseClient) {
                try {
                  const userKey = await window.supabaseClient.getUserEncryptionKey();
                  if (userKey && version.title && version.content) {
                    const encryptedVersion = await window.noteEncryption.encryptNoteForCloud({
                      title: version.title,
                      content: version.content
                    }, userKey);
                    titleEncrypted = encryptedVersion.title_encrypted;
                    contentEncrypted = encryptedVersion.content_encrypted;
                    console.log(`Sync engine: Encrypted version ${version.version} for note ${note.id}`);
                  }
                } catch (encryptError) {
                  console.warn(`Sync engine: Failed to encrypt version ${version.version} for note ${note.id}:`, encryptError);
                }
              }
              
              return {
                note_id: note.id,
                title_encrypted: titleEncrypted || version.title || '',
                content_encrypted: contentEncrypted || version.content || '',
                content_hash: contentHash,
                version: version.version || 1,
                change_reason: version.change_reason || 'auto_save',
                created_at: version.createdAt || version.created_at || new Date().toISOString()
              };
            } catch (versionError) {
              console.warn(`Sync engine: Error processing version ${version.version} for note ${note.id}:`, versionError);
              return null;
            }
          }));
          
          const validVersions = versionData.filter(version => version !== null);
          
          if (validVersions.length === 0) {
            console.warn(`Sync engine: No valid versions to sync for note ${note.id}`);
            continue;
          }
          
          console.log(`Sync engine: Syncing ${validVersions.length} valid versions for note ${note.id}`);
          
          // Use the existing sync infrastructure to send versions
          const result = await window.supabaseClient.syncVersions(note.id, validVersions);
          
          if (result.success) {
            totalVersionsSynced += versions.length;
            console.log(`Sync engine: Successfully synced ${versions.length} versions for note ${note.id}`);
          } else {
            console.error(`Sync engine: Failed to sync versions for note ${note.id}:`, result.error);
          }
        } catch (error) {
          console.error(`Sync engine: Error syncing versions for note ${note.id}:`, error);
        }
      }
      
      console.log(`Sync engine: Version sync completed. Total versions synced: ${totalVersionsSynced}`);
      
      // Emit event for UI updates
      window.eventBus?.emit('versions:synced', { 
        count: totalVersionsSynced,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Sync engine: Version sync failed:', error);
    }
  }

  // Generate content hash for version data
  generateContentHash(content) {
    try {
      // Simple hash function for content
      let hash = 0;
      if (content.length === 0) return hash.toString();
      
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return hash.toString();
    } catch (error) {
      console.error('Sync engine: Error generating content hash:', error);
      // Fallback to timestamp-based hash
      return Date.now().toString();
    }
  }

  // Check if there are unsynced versions and sync them
  async checkAndSyncVersions() {
    const syncCheck = await this.canSync();
    if (!syncCheck.canSync) {
      console.log('Sync engine: Cannot sync versions, user not authenticated or premium');
      return;
    }
    
    try {
      // Get all notes that have versions
      const allNotes = await window.notesStorage.getAllNotes();
      let hasUnsyncedVersions = false;
      
      for (const note of allNotes) {
        try {
          if (window.notesStorage?.getVersionHistory) {
            const versions = await window.notesStorage.getVersionHistory(note.id, 10);
            if (versions && versions.length > 0) {
              hasUnsyncedVersions = true;
              break;
            }
          }
        } catch (versionError) {
          // Skip notes that can't access version history (e.g., non-premium users)
          console.log(`Sync engine: Skipping version check for note ${note.id}:`, versionError.message);
          continue;
        }
      }
      
      if (hasUnsyncedVersions) {
        console.log('Sync engine: Found unsynced versions, starting version sync...');
        await this.syncLocalVersionsToCloud();
      } else {
        console.log('Sync engine: No unsynced versions found');
      }
    } catch (error) {
      console.log('Sync engine: Error checking versions:', error.message);
    }
  }
}

// Export singleton instance
window.syncEngine = new SyncEngine();
