// URL Notes Extension - Local Storage Manager
// Handles IndexedDB operations for notes and attachments

class NotesStorage {
  constructor() {
    this.dbName = 'URLNotesDB';
    this.version = 1;
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        // Migrate existing notes to add updatedAt field if missing
        this.migrateExistingNotes().then(() => {
          // Migrate existing notes to use proper UUID format
          this.migrateNoteIds().then(() => {
            // Start periodic cleanup of soft deleted notes
            this.startCleanupTask();
            resolve();
          });
        });
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('domain', 'domain', { unique: false });
          notesStore.createIndex('url', 'url', { unique: false });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('domain_url', ['domain', 'url'], { unique: false });
        }

        // Attachments store (for local file attachments)
        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentsStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attachmentsStore.createIndex('noteId', 'noteId', { unique: false });
        }

        // Search index store
        if (!db.objectStoreNames.contains('searchIndex')) {
          const searchStore = db.createObjectStore('searchIndex', { keyPath: 'id' });
          searchStore.createIndex('term', 'term', { unique: false });
        }

        // Version history store
        if (!db.objectStoreNames.contains('versions')) {
          const versionsStore = db.createObjectStore('versions', { keyPath: 'id' });
          versionsStore.createIndex('noteId', 'noteId', { unique: false });
          versionsStore.createIndex('noteId_version', ['noteId', 'version'], { unique: true });
        }
      };
    });
  }

  async saveNote(note) {
    if (!this.db) await this.init();
  
    // 1. ENCRYPTION (only for premium users)
    let userKey = null;
    try {
      // Only attempt encryption if user has premium access
      if (await this.checkPremiumAccess()) {
        userKey = await window.supabaseClient?.getUserEncryptionKey();
        if (userKey && window.noteEncryption) {
          const encryptedNote = await window.noteEncryption.encryptNoteForCloud(note, userKey);
          // Update the note with encrypted fields
          note.title_encrypted = encryptedNote.title_encrypted;
          note.content_encrypted = encryptedNote.content_encrypted;
          note.content_hash = encryptedNote.content_hash;
        }
      }
    } catch (error) {
      console.log('Encryption not available, saving note unencrypted:', error.message);
      // Clear any partial encryption data
      delete note.title_encrypted;
      delete note.content_encrypted;
      delete note.content_hash;
    }
  
    // 2. SET TIMESTAMPS AND VERSION
    const now = new Date().toISOString();
    note.updatedAt = note.updatedAt || now;
    
    // Check if this is a new note or an update
    const existingNote = await this.getNote(note.id);
    if (existingNote) {
      // This is an update - increment version
      note.version = (existingNote.version || 1) + 1;
    } else {
      // This is a new note - start at version 1
      note.version = 1;
    }
    
    // Debug: log note structure before saving
    console.log('Storage: Saving note with structure:', {
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
      version: note.version,
      hasContent: !!note.content
    });
  
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes', 'versions'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const versionsStore = transaction.objectStore('versions');
  
      // Save current version to history before updating
      if (note.version > 1) {
        const versionRecord = {
          id: `${note.id}_v${note.version - 1}`,
          noteId: note.id,
          version: note.version - 1,
          title: note.title,
          content: note.content,
          createdAt: new Date().toISOString()
        };
        versionsStore.add(versionRecord);
      }
  
      // Update search index
      this.updateSearchIndex(note);
  
      const request = notesStore.put(note);
      request.onsuccess = () => {
        // EMIT EVENT TO TRIGGER SYNC
        window.eventBus?.emit('notes:updated', { noteId: note.id, note });
        resolve(note);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get notes by specific URL
  async getNotesByUrl(url) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const index = store.index('url');
      const request = index.getAll(url);

      request.onsuccess = () => {
        const notes = request.result;
        // Filter out deleted notes for display
        const activeNotes = notes.filter(note => !note.is_deleted);
        activeNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(activeNotes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get a single note by ID
  async getNote(id) {
    if (!this.db) await this.init();
  
    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.get(id);
  
      request.onsuccess = async () => {
        const storedNote = request.result;
        if (!storedNote) {
          resolve(null);
          return;
        }
  
        // Check if note is already encrypted
        if (storedNote.content_encrypted && storedNote.title_encrypted) {
          // Note is encrypted - decrypt it
          try {
            const userKey = await window.supabaseClient?.getUserEncryptionKey();
            if (userKey) {
              const decryptedNote = await window.noteEncryption.decryptNoteFromCloud(storedNote, userKey);
              resolve(decryptedNote);
            } else {
              resolve(storedNote); // Fallback
            }
          } catch (error) {
            console.warn('Failed to decrypt note, returning encrypted version:', error);
            resolve(storedNote);
          }
        } else {
          // Note is NOT encrypted - return as-is (this is the current case)
          console.log('Note not encrypted, returning unencrypted version:', storedNote.id);
          resolve(storedNote);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Delete a note (soft delete - marks as deleted for sync)
  async deleteNote(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const notesStore = transaction.objectStore('notes');

      // Get the note first to soft delete it
      const getRequest = notesStore.get(id);
      getRequest.onsuccess = () => {
        const note = getRequest.result;
        if (note) {
          // Soft delete: mark as deleted and set deleted timestamp
          note.is_deleted = true;
          note.deleted_at = new Date().toISOString();
          note.updatedAt = new Date().toISOString(); // Update timestamp for sync detection
          note.sync_pending = true; // Mark as needing sync
          
          // Update the note in storage
          const updateRequest = notesStore.put(note);
          updateRequest.onsuccess = () => {
            // Emit event to trigger sync
            window.eventBus?.emit('notes:updated', { noteId: note.id, note });
            resolve();
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          // Note not found, resolve anyway
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Clean up soft deleted notes that have been synced to cloud
  async cleanupSyncedDeletedNotes() {
    if (!this.db) await this.init();

    try {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const request = notesStore.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        let cleanedCount = 0;
        
        notes.forEach(note => {
          // Clean up notes that are soft deleted AND have been synced (no sync_pending flag)
          if (note.is_deleted && !note.sync_pending) {
            // Check if it's been more than 24 hours since deletion (safety buffer)
            const deletedTime = new Date(note.deleted_at);
            const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            
            if (deletedTime < cutoffTime) {
              notesStore.delete(note.id);
              cleanedCount++;
            }
          }
        });
        
        if (cleanedCount > 0) {
          console.log(`Storage: Cleaned up ${cleanedCount} synced soft deleted notes`);
        }
      };
      
      request.onerror = () => {
        console.warn('Storage: Failed to cleanup soft deleted notes:', request.error);
      };
    } catch (error) {
      console.warn('Storage: Error during soft deleted notes cleanup:', error);
    }
  }

  // Start periodic cleanup of soft deleted notes
  startCleanupTask() {
    // Clean up soft deleted notes every hour
    setInterval(() => {
      this.cleanupSyncedDeletedNotes();
    }, 60 * 60 * 1000); // 1 hour
    
    // Clean up old versions every 6 hours
    setInterval(() => {
      this.cleanupAllOldVersions();
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    // Also clean up on first run
    setTimeout(() => {
      this.cleanupSyncedDeletedNotes();
      this.cleanupAllOldVersions();
    }, 5000); // 5 seconds after initialization
  }

  // Clean up old versions for all notes
  async cleanupAllOldVersions() {
    if (!this.db) await this.init();
    
    try {
      const transaction = this.db.transaction(['notes', 'versions'], 'readonly');
      const notesStore = transaction.objectStore('notes');
      const notesRequest = notesStore.getAll();
      
      notesRequest.onsuccess = async () => {
        const notes = notesRequest.result || [];
        let totalCleaned = 0;
        
        for (const note of notes) {
          if (!note.is_deleted) {
            const cleaned = await this.cleanupOldVersions(note.id, 5);
            if (cleaned > 0) totalCleaned += cleaned;
          }
        }
        
        if (totalCleaned > 0) {
          console.log(`Storage: Periodic cleanup removed ${totalCleaned} old versions total`);
        }
      };
      
      notesRequest.onerror = () => {
        console.warn('Failed to cleanup old versions during periodic task:', notesRequest.error);
      };
    } catch (error) {
      console.warn('Error during periodic version cleanup:', error);
    }
  }

  // Update note sync status without triggering full note update
  async updateNoteSyncStatus(noteId, syncData) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const getRequest = notesStore.get(noteId);

      getRequest.onsuccess = () => {
        const note = getRequest.result;
        if (note) {
          // Update only sync-related fields
          Object.assign(note, syncData);
          
          const updateRequest = notesStore.put(note);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(); // Note not found, resolve anyway
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Search notes
  async searchNotes(query, domain = null) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      
      let request;
      if (domain) {
        const index = store.index('domain');
        request = index.getAll(domain);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const notes = request.result;
        const searchTerm = query.toLowerCase();
        
        // Filter out deleted notes and apply search
        const filteredNotes = notes.filter(note => {
          if (note.is_deleted) return false; // Skip deleted notes
          
          return note.title.toLowerCase().includes(searchTerm) ||
                 note.content.toLowerCase().includes(searchTerm) ||
                 note.tags.some(tag => tag.toLowerCase().includes(searchTerm));
        });

        // Sort by relevance (title matches first, then content)
        filteredNotes.sort((a, b) => {
          const aTitle = a.title.toLowerCase().includes(searchTerm);
          const bTitle = b.title.toLowerCase().includes(searchTerm);
          
          if (aTitle && !bTitle) return -1;
          if (!aTitle && bTitle) return 1;
          
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        resolve(filteredNotes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Update search index
  async updateSearchIndex(note) {
    // Simple search index - extract words from title and content
    const words = new Set();
    const text = `${note.title} ${note.content}`.toLowerCase();
    const wordMatches = text.match(/\b\w+\b/g);
    
    if (wordMatches) {
      wordMatches.forEach(word => {
        if (word.length > 2) { // Only index words longer than 2 characters
          words.add(word);
        }
      });
    }

    // Store search terms (simplified implementation)
    const transaction = this.db.transaction(['searchIndex'], 'readwrite');
    const store = transaction.objectStore('searchIndex');
    
    words.forEach(word => {
      store.put({
        id: `${note.id}_${word}`,
        term: word,
        noteId: note.id,
        updatedAt: note.updatedAt
      });
    });
  }

  // Get all notes (for sync purposes - includes deleted notes)
  async getAllNotes() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        
        // Debug: log retrieved notes structure
        console.log('Storage: Retrieved notes from IndexedDB:', notes.map(n => ({
          id: n.id,
          title: n.title,
          updatedAt: n.updatedAt,
          version: n.version,
          hasContent: !!n.content,
          is_deleted: n.is_deleted
        })));
        
        // Sort by updatedAt descending
        notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get all notes for display (excludes deleted notes)
  async getAllNotesForDisplay() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        
        // Filter out deleted notes for display
        const activeNotes = notes.filter(note => !note.is_deleted);
        
        // Sort by updatedAt descending
        activeNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(activeNotes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get notes by domain
  async getNotesByDomain(domain) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const index = store.index('domain');
      const request = index.getAll(domain);

      request.onsuccess = () => {
        const notes = request.result || [];
        
        // Filter out deleted notes
        const activeNotes = notes.filter(note => !note.is_deleted);
        
        // Sort by updatedAt descending
        activeNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(activeNotes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get version history for a note (Premium users only)
  async getVersionHistory(noteId, limit = 10) {
    // Check premium status before allowing access
    if (!await this.checkPremiumAccess()) {
      throw new Error('Version history is a premium feature. Please upgrade to access.');
    }

    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['versions'], 'readonly');
      const store = transaction.objectStore('versions');
      const index = store.index('noteId');
      const request = index.getAll(noteId);

      request.onsuccess = () => {
        const versions = request.result;
        versions.sort((a, b) => b.version - a.version);
        resolve(versions.slice(0, limit));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Save note version (for version history) - Always stores data for all users
  async saveNoteVersion(note) {
    if (!this.db) await this.init();
    
    // Clean up old versions before adding new one (keep only last 5 versions)
    await this.cleanupOldVersions(note.id, 5);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['versions'], 'readwrite');
      const store = transaction.objectStore('versions');
      
      const version = {
        id: crypto.randomUUID(),
        noteId: note.id,
        title: note.title,
        content: note.content,
        contentHash: note.contentHash,
        version: note.version || 1,
        createdAt: new Date().toISOString(),
        changeReason: 'auto_save'
      };

      const request = store.add(version);
      request.onsuccess = () => resolve(version);
      request.onerror = () => reject(request.error);
    });
  }

  // Clean up old versions (keep last N versions) - Always runs for storage management
  async cleanupOldVersions(noteId, maxVersions = 5) {
    if (!this.db) await this.init();
    
    try {
      const transaction = this.db.transaction(['versions'], 'readwrite');
      const store = transaction.objectStore('versions');
      const index = store.index('noteId');
      const request = index.getAll(noteId);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const versions = request.result || [];
          if (versions.length > maxVersions) {
            // Sort by version number (newest first)
            versions.sort((a, b) => (b.version || 0) - (a.version || 0));
            
            // Delete old versions beyond the limit
            const toDelete = versions.slice(maxVersions);
            toDelete.forEach(version => {
              store.delete(version.id);
            });
            
            console.log(`Storage: Cleaned up ${toDelete.length} old versions for note ${noteId}, keeping ${maxVersions} most recent`);
            resolve(toDelete.length);
          } else {
            resolve(0); // No cleanup needed
          }
        };
        
        request.onerror = () => {
          console.warn('Failed to cleanup old versions:', request.error);
          resolve(0); // Indicate failed cleanup
        };
      });
    } catch (error) {
      console.warn('Error during version cleanup:', error);
      return 0; // Indicate failed cleanup
    }
  }

  // Add attachment to a note
  async addAttachment(noteId, file) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const attachment = {
          id: `${noteId}_${Date.now()}`,
          noteId: noteId,
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result,
          createdAt: new Date().toISOString()
        };

        const transaction = this.db.transaction(['attachments'], 'readwrite');
        const store = transaction.objectStore('attachments');
        const request = store.add(attachment);

        request.onsuccess = () => resolve(attachment);
        request.onerror = () => reject(request.error);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // Get attachments for a note
  async getAttachments(noteId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['attachments'], 'readonly');
      const store = transaction.objectStore('attachments');
      const index = store.index('noteId');
      const request = index.getAll(noteId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get storage usage statistics
  async getStorageStats() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes', 'attachments'], 'readonly');
      const notesStore = transaction.objectStore('notes');
      const attachmentsStore = transaction.objectStore('attachments');

      let stats = {
        totalNotes: 0,
        totalAttachments: 0,
        storageUsed: 0,
        domains: new Set()
      };

      const notesRequest = notesStore.getAll();
      notesRequest.onsuccess = () => {
        const notes = notesRequest.result;
        stats.totalNotes = notes.length;
        
        notes.forEach(note => {
          stats.domains.add(note.domain);
          stats.storageUsed += JSON.stringify(note).length;
        });

        const attachmentsRequest = attachmentsStore.getAll();
        attachmentsRequest.onsuccess = () => {
          const attachments = attachmentsRequest.result;
          stats.totalAttachments = attachments.length;
          
          attachments.forEach(attachment => {
            stats.storageUsed += attachment.size;
          });

          stats.domains = stats.domains.size;
          resolve(stats);
        };
        attachmentsRequest.onerror = () => reject(attachmentsRequest.error);
      };
      notesRequest.onerror = () => reject(notesRequest.error);
    });
  }

  // Export all data (only current notes, not version history)
  async exportData() {
    const transaction = this.db.transaction(['notes', 'attachments'], 'readonly');
    const notesStore = transaction.objectStore('notes');
    const attachmentsStore = transaction.objectStore('attachments');

    const [notes, attachments] = await Promise.all([
      new Promise(resolve => {
        const request = notesStore.getAll();
        request.onsuccess = () => {
          // Only export current notes (not deleted ones)
          const currentNotes = (request.result || []).filter(note => !note.is_deleted);
          resolve(currentNotes);
        };
      }),
      new Promise(resolve => {
        const request = attachmentsStore.getAll();
        request.onsuccess = () => resolve(request.result || []);
      })
    ]);

    return {
      notes,
      attachments,
      // Note: versions are NOT exported to keep file size manageable
      // Users can access version history through the UI if they have premium
      exportedAt: new Date().toISOString(),
      version: this.version,
      note: 'Only current notes are exported. Version history is preserved locally.'
    };
  }

  // Clear all data
  async clearAllData() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes', 'attachments', 'versions', 'searchIndex'], 'readwrite');
      
      transaction.objectStore('notes').clear();
      transaction.objectStore('attachments').clear();
      transaction.objectStore('versions').clear();
      transaction.objectStore('searchIndex').clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Check if user has premium access
  async checkPremiumAccess() {
    try {
      // First check if we have a working Supabase client
      if (window.supabaseClient) {
        try {
          // Check if user is authenticated
          const { data: { user }, error } = await window.supabaseClient.auth.getUser();
          if (user) {
            // User is authenticated, check subscription status
            const status = await window.supabaseClient.getSubscriptionStatus();
            return status && status.active && status.tier !== 'free';
          }
        } catch (authError) {
          console.log('Auth check failed, user not authenticated');
        }
      }
      
      // Fallback: check chrome storage for cached premium status
      try {
        const result = await chrome.storage.local.get(['userTier']);
        if (result.userTier) {
          return result.userTier.active && result.userTier.tier !== 'free';
        }
      } catch (storageError) {
        console.log('Chrome storage check failed');
      }
      
      // Default to false (no premium access)
      return false;
    } catch (error) {
      console.error('Error checking premium access:', error);
      return false;
    }
  }

  // Check if version history is available
  async isVersionHistoryAvailable() {
    try {
      return await this.checkPremiumAccess();
    } catch (error) {
      console.error('Error checking version history availability:', error);
      return false;
    }
  }

  // Get version count for a note (always available, but content access requires premium)
  async getVersionCount(noteId) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['versions'], 'readonly');
      const store = transaction.objectStore('versions');
      const index = store.index('noteId');
      const request = index.count(noteId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Migrate existing notes to add updatedAt field if missing
  async migrateExistingNotes() {
    try {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const notes = request.result || [];
        let migratedCount = 0;
        
        notes.forEach(note => {
          if (!note.updatedAt) {
            // Add updatedAt field based on createdAt or current time
            note.updatedAt = note.createdAt || new Date().toISOString();
            store.put(note);
            migratedCount++;
          }
        });
        
        if (migratedCount > 0) {
          console.log(`Storage: Migrated ${migratedCount} notes to add updatedAt field`);
        }
      };
      
      request.onerror = () => {
        console.warn('Storage: Failed to migrate existing notes:', request.error);
      };
    } catch (error) {
      console.warn('Storage: Error during note migration:', error);
    }
  }

  // Migrate existing notes to use proper UUID format
  async migrateNoteIds() {
    try {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const notes = request.result || [];
        let migratedCount = 0;
        
        notes.forEach(note => {
          // Check if note ID is not in UUID format (e.g., starts with 'mem' or similar)
          if (note.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(note.id)) {
            const oldId = note.id;
            // Generate new UUID
            note.id = this.generateId();
            // Mark for sync to cloud with new ID
            note.needsIdMigration = true;
            note.oldId = oldId;
            store.put(note);
            migratedCount++;
            console.log(`Storage: Migrated note ID from ${oldId} to ${note.id}`);
          }
        });
        
        if (migratedCount > 0) {
          console.log(`Storage: Migrated ${migratedCount} notes to proper UUID format`);
        }
      };
      
      request.onerror = () => {
        console.warn('Storage: Failed to migrate note IDs:', request.error);
      };
    } catch (error) {
      console.warn('Storage: Error during note ID migration:', error);
    }
  }

  // Check storage quota (compatibility method for StorageManager)
  async checkStorageQuota() {
    try {
      const stats = await this.getStorageStats();
      // Estimate quota usage (Chrome storage is typically 5-10MB)
      const estimatedQuota = 10 * 1024 * 1024; // 10MB
      const usagePercent = (stats.storageUsed / estimatedQuota) * 100;
      
      return {
        usage: stats.storageUsed,
        quota: estimatedQuota,
        usagePercent: Math.round(usagePercent * 100) / 100
      };
    } catch (error) {
      console.warn('Error checking storage quota:', error);
      return { usage: 0, quota: 0, usagePercent: 0 };
    }
  }

  // Export notes (compatibility method for StorageManager)
  async exportNotes() {
    try {
      // Only export notes that are visible in the UI (not deleted)
      const notes = await this.getAllNotesForDisplay();
      
      // Group notes by domain for compatibility with StorageManager format
      const notesByDomain = {};
      notes.forEach(note => {
        if (!notesByDomain[note.domain]) {
          notesByDomain[note.domain] = [];
        }
        notesByDomain[note.domain].push(note);
      });
      
      return notesByDomain;
    } catch (error) {
      console.error('Error exporting notes:', error);
      throw error;
    }
  }

  // Import notes from export data (compatibility method for StorageManager)
  async importNotes(importedData) {
    try {
      let notesImportedCount = 0;
      
      // Import notes from domain-based structure
      for (const domain in importedData) {
        if (!Array.isArray(importedData[domain])) continue;
        
        const domainNotes = importedData[domain];
        for (const note of domainNotes) {
          if (note && note.id) {
            // Ensure the note is not marked as deleted
            note.is_deleted = false;
            note.deleted_at = null;
            note.updatedAt = note.updatedAt || new Date().toISOString();
            
            await this.saveNote(note);
            notesImportedCount++;
          }
        }
      }
      
      console.log(`Storage: Imported ${notesImportedCount} notes`);
      return notesImportedCount;
    } catch (error) {
      console.error('Error importing notes:', error);
      throw error;
    }
  }

  // Get all attachments (helper method for exportNotes)
  async getAllAttachments() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['attachments'], 'readonly');
      const store = transaction.objectStore('attachments');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all versions (helper method for exportNotes)
  async getAllVersions() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['versions'], 'readonly');
      const store = transaction.objectStore('versions');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete all notes for a specific domain (soft delete for sync)
  async deleteNotesByDomain(domain) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      
      // Get all notes for the domain
      const domainIndex = notesStore.index('domain');
      const request = domainIndex.getAll(domain);
      
      request.onsuccess = () => {
        const notes = request.result || [];
        let deletedCount = 0;
        
        notes.forEach(note => {
          // Soft delete: mark as deleted and set deleted timestamp
          note.is_deleted = true;
          note.deleted_at = new Date().toISOString();
          note.updatedAt = new Date().toISOString(); // Update timestamp for sync detection
          note.sync_pending = true; // Mark as needing sync
          
          // Update the note in storage
          notesStore.put(note);
          deletedCount++;
          
          // Emit event to trigger sync for each note
          window.eventBus?.emit('notes:updated', { noteId: note.id, note });
        });
        
        transaction.oncomplete = () => {
          console.log(`Storage: Soft deleted ${deletedCount} notes for domain: ${domain}`);
          resolve(deletedCount);
        };
        
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Load notes (compatibility method for StorageManager)
  async loadNotes() {
    try {
      const notes = await this.getAllNotes();
      // Sort by most recently updated
      notes.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      return notes;
    } catch (error) {
      console.error('Error loading notes:', error);
      return [];
    }
  }

  // Get editor state (compatibility method for StorageManager)
  async getEditorState() {
    try {
      const result = await chrome.storage.local.get(['editorState']);
      return result.editorState || null;
    } catch (error) {
      console.warn('Error getting editor state:', error);
      return null;
    }
  }

  // Persist editor open flag (compatibility method for StorageManager)
  async persistEditorOpen(isOpen) {
    try {
      const { editorState } = await chrome.storage.local.get(['editorState']);
      const state = editorState || {};
      state.open = isOpen;
      await chrome.storage.local.set({ editorState: state });
    } catch (error) {
      console.warn('Error persisting editor open state:', error);
    }
  }

  // Save editor draft (compatibility method for StorageManager)
  async saveEditorDraft(noteDraft, caretStart = 0, caretEnd = 0) {
    try {
      if (!noteDraft) return;
      
      const state = {
        open: true,
        noteDraft: { ...noteDraft },
        caretStart,
        caretEnd
      };
      
      await chrome.storage.local.set({ editorState: state });
    } catch (error) {
      console.warn('Error saving editor draft:', error);
    }
  }

  // Clear editor state (compatibility method for StorageManager)
  async clearEditorState() {
    try {
      await chrome.storage.local.remove('editorState');
    } catch (error) {
      console.warn('Error clearing editor state:', error);
    }
  }

  // Generate a unique ID
  generateId() {
    // Use crypto.randomUUID() if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback to UUID v4 format for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Export singleton instance
window.notesStorage = new NotesStorage();
