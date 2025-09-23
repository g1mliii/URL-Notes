// URL Notes Extension - Local Storage Manager
// Handles IndexedDB operations for notes and attachments



class NotesStorage {
  constructor() {
    this.dbName = 'URLNotesDB';
    this.dbVersion = 2; // Increment from 1 to 2 to trigger upgrade
    this.db = null;
  }

  // Initialize database
  async init() {
    if (this.db) return; // Already initialized
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        
        // Check if all required stores exist
        const requiredStores = ['notes', 'attachments', 'versions', 'searchIndex', 'deletions'];
        const missingStores = requiredStores.filter(storeName => !this.db.objectStoreNames.contains(storeName));
        
        if (missingStores.length > 0) {
          // Remove verbose logging
          
          // Backup existing data before deletion
          this.backupExistingData().then(backup => {
            // Close current connection and delete database
            this.db.close();
            const deleteRequest = indexedDB.deleteDatabase(this.dbName);
            
            deleteRequest.onsuccess = () => {
              // Remove verbose logging
              // Try to initialize again
              this.init().then(async () => {
                // Restore backed up data
                if (backup) {
                  await this.restoreData(backup);
                }
                resolve();
              }).catch(reject);
            };
            
            deleteRequest.onerror = () => {
              reject(deleteRequest.error);
            };
          }).catch(error => {
            reject(error);
          });
          
          return;
        }
        
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
        // Remove verbose logging
        
        // Create notes store if it doesn't exist
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('domain', 'domain', { unique: false });
          notesStore.createIndex('url', 'url', { unique: false });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('is_deleted', 'is_deleted', { unique: false });
          // Remove verbose logging
        }
        
        // Create attachments store if it doesn't exist
        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentsStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attachmentsStore.createIndex('noteId', 'noteId', { unique: false });
          // Remove verbose logging
        }
        
        // Create versions store if it doesn't exist
        if (!db.objectStoreNames.contains('versions')) {
          const versionsStore = db.createObjectStore('versions', { keyPath: 'id' });
          versionsStore.createIndex('noteId', 'noteId', { unique: false });
          versionsStore.createIndex('noteId_version', ['noteId', 'version'], { unique: false });
          // Remove verbose logging
        }
        
        // Create search index store if it doesn't exist
        if (!db.objectStoreNames.contains('searchIndex')) {
          const searchStore = db.createObjectStore('searchIndex', { keyPath: 'id' });
          searchStore.createIndex('term', 'term', { unique: false });
          searchStore.createIndex('noteId', 'noteId', { unique: false });
          // Remove verbose logging
        }

        // Create deletions store if it doesn't exist
        if (!db.objectStoreNames.contains('deletions')) {
          const deletionsStore = db.createObjectStore('deletions', { keyPath: 'id' });
          deletionsStore.createIndex('noteId', 'noteId', { unique: false });
          deletionsStore.createIndex('synced', 'synced', { unique: false });
          // Remove verbose logging
        }
      };
    });
  }

  async saveNote(note) {
    if (!this.db) await this.init();
  

  
    // 1. ENCRYPTION (only for premium users)
    let userKey = null;
    try {
      // Check if this is a note from the server (has encrypted content)
      if (note.title_encrypted && note.content_encrypted) {
              // This is a server note - decrypt it first
      // Clear premium status cache to get fresh status
      await chrome.storage.local.remove(['cachedPremiumStatus']);
      const premiumStatus = await getPremiumStatus();
      
      if (premiumStatus.isPremium) {
          userKey = await window.supabaseClient?.getUserEncryptionKey();

          if (userKey && window.noteEncryption) {
            try {
              const decryptedNote = await window.noteEncryption.decryptNoteFromCloud(note, userKey);
              // Update the note with decrypted content
              note.title = decryptedNote.title;
              note.content = decryptedNote.content;
              note.tags = decryptedNote.tags || [];
              // Keep the encrypted fields for future sync
              note.title_encrypted = decryptedNote.title_encrypted;
              note.content_encrypted = decryptedNote.content_encrypted;
              note.tags_encrypted = decryptedNote.tags_encrypted;
              note.content_hash = decryptedNote.content_hash;
            } catch (decryptError) {
              // Fallback: provide readable content for notes that can't be decrypted
              note.title = note.title || 'Note from Server (Encrypted)';
              note.content = note.content || 'This note was synced from the server but could not be decrypted. The URL and domain information should still be visible.';
              note.tags = [];
              // Clear encrypted fields to prevent future decryption attempts
              delete note.title_encrypted;
              delete note.content_encrypted;
              delete note.tags_encrypted;
              delete note.content_hash;
            }
          } else {
            // No encryption key or module available
            note.title = note.title || 'Note from Server (Premium Required)';
            note.content = note.content || 'This note requires premium access to decrypt. The URL and domain information should still be visible.';
            note.tags = [];
            // Clear encrypted fields
            delete note.title_encrypted;
            delete note.content_encrypted;
            delete note.tags_encrypted;
            delete note.content_hash;
          }
        } else {
          // No premium access - provide fallback content
          note.title = note.title || 'Note from Server (Premium Required)';
          note.content = note.content || 'This note requires premium access to decrypt. The URL and domain information should still be visible.';
          note.tags = [];
          // Clear encrypted fields
          delete note.title_encrypted;
          delete note.content_encrypted;
          delete note.tags_encrypted;
          delete note.content_hash;
        }
      } else {
        // This is a local note - encrypt it for cloud storage
        if ((await getPremiumStatus()).isPremium) {
          userKey = await window.supabaseClient?.getUserEncryptionKey();
          if (userKey && window.noteEncryption) {
            const encryptedNote = await window.noteEncryption.encryptNoteForCloud(note, userKey);
            // Update the note with encrypted fields
            note.title_encrypted = encryptedNote.title_encrypted;
            note.content_encrypted = encryptedNote.content_encrypted;
            note.tags_encrypted = encryptedNote.tags_encrypted;
            note.content_hash = encryptedNote.content_hash;
          }
        }
      }
    } catch (error) {
      // Provide fallback content for any notes that fail encryption/decryption
      note.title = note.title || 'Note (Error)';
      note.content = note.content || 'This note encountered an error during processing. The URL and domain information should still be visible.';
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
    
    // Remove verbose logging
  
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
            resolve(storedNote);
          }
        } else {
          // Note is NOT encrypted - return as-is (this is the current case)
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
      const transaction = this.db.transaction(['notes', 'deletions'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const deletionsStore = transaction.objectStore('deletions');

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
            // Track deletion for sync within the same transaction
            const deletionRecord = {
              id: crypto.randomUUID(),
              noteId: id,
              deletedAt: new Date().toISOString(),
              synced: false
            };

            const deletionRequest = deletionsStore.add(deletionRecord);
            deletionRequest.onsuccess = () => {
              // Emit event to trigger sync
              window.eventBus?.emit('notes:deleted', { noteId: note.id, note });
              resolve();
            };
            deletionRequest.onerror = () => {
              // Still resolve since the note was deleted
              resolve();
            };
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
        // Remove verbose logging
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
            const result = await this.maintainVersionHistory(note.id, 5);
            if (result.deleted > 0) totalCleaned += result.deleted;
          }
        }
        
              if (totalCleaned > 0) {
        // Remove verbose logging
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
        
        // Remove verbose logging
        
        // Sort by updatedAt descending
        notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get notes for sync - only latest versions of active notes
  async getNotesForSync() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        
        // Filter out deleted notes and only get active notes
        const activeNotes = notes.filter(note => !note.is_deleted);
        
        // Filter out notes without title or content
        const validNotes = activeNotes.filter(note => note.title && note.content);
        
        // Sort by updatedAt descending
        validNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        // Include essential fields for sync including url, domain, and tags
        const syncNotes = validNotes.map(note => ({
            id: note.id,
            title: note.title,
            content: note.content,
            url: note.url,
            domain: note.domain,
            tags: note.tags || [],
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
            // Explicitly exclude: version, parent_version_id, etc.
          }));
        
        // Remove verbose logging
        
        resolve(syncNotes);
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
    if (!(await getPremiumStatus()).isPremium) {
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

  // Save note version (for version history) - Only on manual save, not auto-save
  async saveNoteVersion(note, changeReason = 'manual_save') {
    if (!this.db) await this.init();
    
    // Only create versions for manual saves, not auto-saves
    if (changeReason === 'auto_save') {
      return null; // Don't create version for auto-save
    }
    
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
        changeReason: changeReason
      };

      const request = store.add(version);
      request.onsuccess = async () => {
        try {
          // After adding the new version, maintain exactly 5 versions
          await this.maintainVersionHistory(note.id, 5);
          resolve(version);
        } catch (error) {
          console.warn('Failed to maintain version history after adding new version:', error);
          resolve(version); // Still resolve since version was added
        }
      };
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
            
            // Keep the newest maxVersions and delete the rest (oldest ones)
            const toKeep = versions.slice(0, maxVersions);
            const toDelete = versions.slice(maxVersions);
            
            // Delete the oldest versions
            toDelete.forEach(version => {
              store.delete(version.id);
            });
            
            // Remove verbose logging
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

  // Ensure version history is always maintained at exactly maxVersions
  async maintainVersionHistory(noteId, maxVersions = 5) {
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
            
            // Keep the newest maxVersions and delete the rest (oldest ones)
            const toKeep = versions.slice(0, maxVersions);
            const toDelete = versions.slice(maxVersions);
            
            // Delete the oldest versions
            toDelete.forEach(version => {
              store.delete(version.id);
            });
            
            // Remove verbose logging
            resolve({ kept: toKeep.length, deleted: toDelete.length });
          } else {
            resolve({ kept: versions.length, deleted: 0 }); // No cleanup needed
          }
        };
        
        request.onerror = () => {
          console.warn('Failed to maintain version history:', request.error);
          resolve({ kept: 0, deleted: 0 }); // Indicate failed operation
        };
      });
    } catch (error) {
      console.warn('Error during version history maintenance:', error);
      return { kept: 0, deleted: 0 }; // Indicate failed operation
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
      const transaction = this.db.transaction(['notes', 'attachments', 'versions', 'searchIndex', 'deletions'], 'readwrite');
      
      transaction.objectStore('notes').clear();
      transaction.objectStore('attachments').clear();
      transaction.objectStore('versions').clear();
      transaction.objectStore('searchIndex').clear();
      transaction.objectStore('deletions').clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Check if user has premium access
  async checkPremiumAccess() {
    try {
      // First check if we have a working Supabase client
      if (window.supabaseClient && typeof window.supabaseClient.isAuthenticated === 'function') {
        try {
          // Check if user is authenticated using custom client method
          if (window.supabaseClient.isAuthenticated()) {
            // User is authenticated, check subscription status
            try {
              const status = await window.supabaseClient.getSubscriptionStatus();
              if (status && status.active && status.tier !== 'free') {
                console.log('Premium access confirmed via Supabase:', status);
                return true;
              }
            } catch (statusError) {
              console.log('Subscription check failed, falling back to cached status:', statusError.message);
            }
          } else {
            // User not authenticated via Supabase
          }
        } catch (authError) {
          console.log('Supabase auth check failed:', authError.message);
        }
      } else {
        console.log('Supabase client not available for auth check');
      }
      
      // Fallback: check chrome storage for cached premium status
      try {
        const result = await chrome.storage.local.get(['userTier']);
        if (result.userTier) {
          const isPremium = result.userTier.active && result.userTier.tier !== 'free';
          // Premium access via cached status
          return isPremium;
        }
      } catch (storageError) {
        console.log('Chrome storage check failed:', storageError.message);
      }
      
      // Default to false (no premium access)
      console.log('No premium access confirmed, defaulting to false');
      return false;
    } catch (error) {
      console.error('Error checking premium access:', error);
      return false;
    }
  }

  // Check if version history is available
  async isVersionHistoryAvailable() {
    try {
      return (await getPremiumStatus()).isPremium;
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
        // Remove verbose logging
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
            // Remove verbose logging
          }
        });
        
              if (migratedCount > 0) {
        // Remove verbose logging
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
      
      // Remove verbose logging
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
  // Note: Domain functionality is deprecated in simplified sync system
  async deleteNotesByDomain(domain) {
    console.warn('Storage: Domain deletion is deprecated in simplified sync system');
    
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes', 'deletions'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const deletionsStore = transaction.objectStore('deletions');
      
      // Get all notes (since we no longer have domain column)
      const request = notesStore.getAll();
      
      request.onsuccess = () => {
        const notes = request.result || [];
        let deletedCount = 0;
        
        // Filter notes by domain using the old domain field if it exists, or skip if not
        const notesToDelete = notes.filter(note => {
          // Skip if already deleted
          if (note.is_deleted) return false;
          
          // Check if note has domain field (for backward compatibility)
          if (note.domain && note.domain === domain) return true;
          
          // If no domain field, skip this note
          return false;
        });
        
        if (notesToDelete.length === 0) {
          // Remove verbose logging
          resolve(0);
          return;
        }
        
        // Remove verbose logging
        
        notesToDelete.forEach(note => {
          // Soft delete: mark as deleted and set deleted timestamp
          note.is_deleted = true;
          note.deleted_at = new Date().toISOString();
          note.updatedAt = new Date().toISOString(); // Update timestamp for sync detection
          note.sync_pending = true; // Mark as needing sync
          
          // Update the note in storage
          notesStore.put(note);
          
          // Track deletion for sync
          const deletionRecord = {
            id: crypto.randomUUID(),
            noteId: note.id,
            deletedAt: new Date().toISOString(),
            synced: false
          };
          deletionsStore.add(deletionRecord);
          
          deletedCount++;
        });
        
        transaction.oncomplete = () => {
          // Remove verbose logging
          
          // Emit a single event for the domain deletion instead of individual note events
          // This prevents infinite loops
          window.eventBus?.emit('notes:domain_deleted', { domain, deletedCount });
          
          resolve(deletedCount);
        };
        
        transaction.onerror = () => {
          console.error('Storage: Transaction error in deleteNotesByDomain:', transaction.error);
          reject(transaction.error);
        };
      };
      
      request.onerror = () => {
        console.error('Storage: Error getting notes:', request.error);
        reject(request.error);
      };
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

  // Get local deletions that need to be synced
  async getLocalDeletions() {
    try {
      // This would need to be implemented in storage.js to track deletions
      // For now, return empty array
      return [];
    } catch (error) {
      console.warn('Failed to get local deletions:', error);
      return [];
    }
  }

  // Track note deletion for sync
  async trackNoteDeletion(noteId) {
    if (!this.db) await this.init();
    
    try {
      const deletionRecord = {
        id: crypto.randomUUID(),
        noteId: noteId,
        deletedAt: new Date().toISOString(),
        synced: false
      };

      const transaction = this.db.transaction(['deletions'], 'readwrite');
      const store = transaction.objectStore('deletions');
      const request = store.add(deletionRecord);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          // Remove verbose logging
          resolve(deletionRecord);
        };
        request.onerror = () => {
          console.error(`Storage: Failed to track deletion for note ${noteId}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Storage: Error in trackNoteDeletion:', error);
      throw error;
    }
  }

  // Get unsynced deletions
  async getUnsyncedDeletions() {
    if (!this.db) await this.init();
    
    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction(['deletions'], 'readonly');
        const store = transaction.objectStore('deletions');
        const request = store.getAll();

        request.onsuccess = () => {
          try {
            const deletions = request.result || [];
            const unsynced = deletions.filter(d => !d.synced);
            resolve(unsynced);
          } catch (error) {
            console.error('Storage: Error processing deletions result:', error);
            resolve([]); // Return empty array on error
          }
        };
        
        request.onerror = () => {
          console.error('Storage: Error getting deletions:', request.error);
          resolve([]); // Return empty array on error
        };
        
        transaction.onerror = () => {
          console.error('Storage: Transaction error in getUnsyncedDeletions:', transaction.error);
          resolve([]); // Return empty array on error
        };
        
        transaction.oncomplete = () => {
          // Transaction completed successfully
        };
        
      } catch (error) {
        console.error('Storage: Error in getUnsyncedDeletions:', error);
        resolve([]); // Return empty array on error
      }
    });
  }

  // Mark deletions as synced
  async markDeletionsAsSynced(deletionIds) {
    if (!this.db) await this.init();
    
    try {
      const transaction = this.db.transaction(['deletions'], 'readwrite');
      const store = transaction.objectStore('deletions');
      
      let markedCount = 0;
      for (const deletionId of deletionIds) {
        const request = store.get(deletionId);
        request.onsuccess = () => {
          const deletion = request.result;
          if (deletion) {
            deletion.synced = true;
            store.put(deletion);
            markedCount++;
          }
        };
      }
      
      transaction.oncomplete = () => {
        // Remove verbose logging
      };
      
      transaction.onerror = () => {
        console.error('Storage: Error marking deletions as synced:', transaction.error);
      };
    } catch (error) {
      console.error('Storage: Error in markDeletionsAsSynced:', error);
    }
  }

  // Backup existing data before database recreation
  async backupExistingData() {
    if (!this.db) return null;
    
    try {
      const backup = {};
      
      // Backup notes
      const notesTransaction = this.db.transaction(['notes'], 'readonly');
      const notesStore = notesTransaction.objectStore('notes');
      const notesRequest = notesStore.getAll();
      
      backup.notes = await new Promise((resolve) => {
        notesRequest.onsuccess = () => resolve(notesRequest.result || []);
        notesRequest.onerror = () => resolve([]);
      });
      
      // Backup versions
      const versionsTransaction = this.db.transaction(['versions'], 'readonly');
      const versionsStore = versionsTransaction.objectStore('versions');
      const versionsRequest = versionsStore.getAll();
      
      backup.versions = await new Promise((resolve) => {
        versionsRequest.onsuccess = () => resolve(versionsRequest.result || []);
        versionsRequest.onerror = () => resolve([]);
      });
      
      // Backup attachments
      const attachmentsTransaction = this.db.transaction(['attachments'], 'readonly');
      const attachmentsStore = attachmentsTransaction.objectStore('attachments');
      const attachmentsRequest = attachmentsStore.getAll();
      
      backup.attachments = await new Promise((resolve) => {
        attachmentsRequest.onsuccess = () => resolve(attachmentsRequest.result || []);
        attachmentsRequest.onerror = () => resolve([]);
      });
      
      // Remove verbose logging
      return backup;
      
    } catch (error) {
      console.error('Storage: Error backing up data:', error);
      return null;
    }
  }

  // Restore data after database recreation
  async restoreData(backup) {
    if (!backup || !this.db) return;
    
    try {
      // Remove verbose logging
      
      // Restore notes
      if (backup.notes && backup.notes.length > 0) {
        const notesTransaction = this.db.transaction(['notes'], 'readwrite');
        const notesStore = notesTransaction.objectStore('notes');
        
        for (const note of backup.notes) {
          notesStore.put(note);
        }
        // Remove verbose logging
      }
      
      // Restore versions
      if (backup.versions && backup.versions.length > 0) {
        const versionsTransaction = this.db.transaction(['versions'], 'readwrite');
        const versionsStore = versionsTransaction.objectStore('versions');
        
        for (const version of backup.versions) {
          versionsStore.put(version);
        }
        // Remove verbose logging
      }
      
      // Restore attachments
      if (backup.attachments && backup.attachments.length > 0) {
        const attachmentsTransaction = this.db.transaction(['attachments'], 'readwrite');
        const attachmentsStore = attachmentsTransaction.objectStore('attachments');
        
        for (const attachment of backup.attachments) {
          attachmentsStore.put(attachment);
        }
        // Remove verbose logging
      }
      
      // Remove verbose logging
      
    } catch (error) {
      console.error('Storage: Error restoring data:', error);
    }
  }

  // Mark deletions as synced by note IDs (for simplified sync)
  async markDeletionsAsSyncedByNoteIds(noteIds) {
    if (!this.db) await this.init();
    
    try {
      const transaction = this.db.transaction(['deletions'], 'readwrite');
      const store = transaction.objectStore('deletions');
      
      let markedCount = 0;
      
      // Get all unsynced deletions
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const allDeletions = getAllRequest.result || [];
        
        // Mark deletions as synced if their noteId matches any of the processed note IDs
        for (const deletion of allDeletions) {
          if (!deletion.synced && noteIds.includes(deletion.noteId)) {
            deletion.synced = true;
            store.put(deletion);
            markedCount++;
          }
        }
      };
      
      transaction.oncomplete = () => {
        // Remove verbose logging
      };
      
      transaction.onerror = () => {
        console.error('Storage: Error marking deletions as synced by note IDs:', transaction.error);
      };
    } catch (error) {
      console.error('Storage: Error in markDeletionsAsSyncedByNoteIds:', error);
    }
  }

  // Remove deletion record for a specific note ID
  async removeDeletionRecord(noteId) {
    if (!this.db) await this.init();
    
    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction(['deletions'], 'readwrite');
        const store = transaction.objectStore('deletions');
        
        // Get all deletions to find the one for this note
        const request = store.getAll();
        
        request.onsuccess = () => {
          const deletions = request.result || [];
          let removedCount = 0;
          
          // Remove deletion records for this note ID
          for (const deletion of deletions) {
            if (deletion.noteId === noteId) {
              store.delete(deletion.id);
              removedCount++;
            }
          }
          
          resolve(removedCount);
        };
        
        request.onerror = () => {
          console.error('Storage: Error removing deletion record:', request.error);
          resolve(0);
        };
      } catch (error) {
        console.error('Storage: Error in removeDeletionRecord:', error);
        resolve(0);
      }
    });
  }
}

// Export singleton instance
window.notesStorage = new NotesStorage();
