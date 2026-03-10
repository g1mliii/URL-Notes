// URL Notes Extension - Local Storage Manager
// Handles IndexedDB operations for notes and attachments

class NotesStorage {
  constructor() {
    this.dbName = 'URLNotesDB';
    this.dbVersion = 2;
    this.db = null;
  }

  // Initialize database
  async init() {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        const requiredStores = ['notes', 'attachments', 'versions', 'searchIndex', 'deletions'];
        const missingStores = requiredStores.filter(storeName => !this.db.objectStoreNames.contains(storeName));

        if (missingStores.length > 0) {
          this.backupExistingData().then(backup => {
            this.db.close();
            const deleteRequest = indexedDB.deleteDatabase(this.dbName);

            deleteRequest.onsuccess = () => {
              this.init().then(async () => {
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

        this.migrateExistingNotes().then(() => {
          this.migrateNoteIds().then(() => {
            this.startCleanupTask();
            resolve();
          });
        });
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('domain', 'domain', { unique: false });
          notesStore.createIndex('url', 'url', { unique: false });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('is_deleted', 'is_deleted', { unique: false });
        }

        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentsStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attachmentsStore.createIndex('noteId', 'noteId', { unique: false });
        }

        if (!db.objectStoreNames.contains('versions')) {
          const versionsStore = db.createObjectStore('versions', { keyPath: 'id' });
          versionsStore.createIndex('noteId', 'noteId', { unique: false });
          versionsStore.createIndex('noteId_version', ['noteId', 'version'], { unique: false });
        }

        if (!db.objectStoreNames.contains('searchIndex')) {
          const searchStore = db.createObjectStore('searchIndex', { keyPath: 'id' });
          searchStore.createIndex('term', 'term', { unique: false });
          searchStore.createIndex('noteId', 'noteId', { unique: false });
        }

        if (!db.objectStoreNames.contains('deletions')) {
          const deletionsStore = db.createObjectStore('deletions', { keyPath: 'id' });
          deletionsStore.createIndex('noteId', 'noteId', { unique: false });
          deletionsStore.createIndex('synced', 'synced', { unique: false });
        }
      };
    });
  }

  async saveNote(note) {
    if (!this.db) await this.init();
    let userKey = null;
    try {
      if (note.title_encrypted && note.content_encrypted) {
        await chrome.storage.local.remove(['cachedPremiumStatus']);
        const premiumStatus = await getPremiumStatus();

        if (premiumStatus.isPremium) {
          userKey = await window.supabaseClient?.getUserEncryptionKey();

          if (userKey && window.noteEncryption) {
            try {
              const decryptedNote = await window.noteEncryption.decryptNoteFromCloud(note, userKey);
              note.title = decryptedNote.title;
              note.content = decryptedNote.content;
              note.tags = decryptedNote.tags || [];
              note.title_encrypted = decryptedNote.title_encrypted;
              note.content_encrypted = decryptedNote.content_encrypted;
              note.tags_encrypted = decryptedNote.tags_encrypted;
              note.content_hash = decryptedNote.content_hash;
              note.needs_decryption_retry = false;
            } catch (decryptError) {
              note.needs_decryption_retry = true;
              note.decryption_error = decryptError.message;
              note.title = note.title || 'Note from Server (Decryption Pending)';
              note.content = note.content || 'This note is encrypted and will be decrypted when the encryption key becomes available.';
              note.tags = [];
              setTimeout(() => {
                window.eventBus?.emit('notes:decryption_failed', {
                  noteId: note.id,
                  error: decryptError.message
                });
              }, 100);
            }
          } else {

            note.needs_decryption_retry = true;
            note.decryption_error = 'Encryption key not available';
            note.title = note.title || 'Note from Server (Key Pending)';
            note.content = note.content || 'This note requires an encryption key that is not yet available.';
            note.tags = [];
            setTimeout(() => {
              window.eventBus?.emit('notes:decryption_failed', {
                noteId: note.id,
                error: 'Encryption key not available'
              });
            }, 100);
          }
        } else {
          note.title = note.title || 'Note from Server (Premium Required)';
          note.content = note.content || 'This note requires premium access to decrypt. The URL and domain information should still be visible.';
          note.tags = [];
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
            note.title_encrypted = encryptedNote.title_encrypted;
            note.content_encrypted = encryptedNote.content_encrypted;
            note.tags_encrypted = encryptedNote.tags_encrypted;
            note.content_hash = encryptedNote.content_hash;
          }
        }
      }
    } catch (error) {
      // Mark note as needing retry for any encryption/decryption errors
      if (note.title_encrypted && note.content_encrypted) {
        note.needs_decryption_retry = true;
        note.decryption_error = error.message;
        note.title = note.title || 'Note (Decryption Error)';
        note.content = note.content || 'This note encountered an error during decryption and will be retried.';

        setTimeout(() => {
          window.eventBus?.emit('notes:decryption_failed', {
            noteId: note.id,
            error: error.message
          });
        }, 100);
      } else {
        // Provide fallback content for local notes that fail encryption
        note.title = note.title || 'Note (Error)';
        note.content = note.content || 'This note encountered an error during processing. The URL and domain information should still be visible.';
        delete note.title_encrypted;
        delete note.content_encrypted;
        delete note.content_hash;
      }
    }

    const now = new Date().toISOString();
    note.updatedAt = note.updatedAt || now;

    const existingNote = await this.getNote(note.id);
    if (existingNote) {
      // This is an update - increment version
      note.version = (existingNote.version || 1) + 1;
    } else {
      note.version = 1;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes', 'versions'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const versionsStore = transaction.objectStore('versions');

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

      this.updateSearchIndex(note);

      const request = notesStore.put(note);
      request.onsuccess = () => {
        window.eventBus?.emit('notes:updated', { noteId: note.id, note });
        resolve(note);
      };
      request.onerror = () => reject(request.error);
    });
  }

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
          try {
            const userKey = await window.supabaseClient?.getUserEncryptionKey();
            if (userKey) {
              const decryptedNote = await window.noteEncryption.decryptNoteFromCloud(storedNote, userKey);
              resolve(decryptedNote);
            } else {
              resolve(storedNote);
            }
          } catch (error) {
            resolve(storedNote);
          }
        } else {
          resolve(storedNote);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes', 'deletions'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const deletionsStore = transaction.objectStore('deletions');

      const getRequest = notesStore.get(id);
      getRequest.onsuccess = () => {
        const note = getRequest.result;
        if (note) {
          note.is_deleted = true;
          note.deleted_at = new Date().toISOString();
          note.updatedAt = new Date().toISOString(); 
          note.sync_pending = true; 
          const updateRequest = notesStore.put(note);
          updateRequest.onsuccess = () => {
            const deletionRecord = {
              id: crypto.randomUUID(),
              noteId: id,
              deletedAt: new Date().toISOString(),
              synced: false
            };

            const deletionRequest = deletionsStore.add(deletionRecord);
            deletionRequest.onsuccess = () => {
              window.eventBus?.emit('notes:deleted', { noteId: note.id, note });
              resolve();
            };
            deletionRequest.onerror = () => {
              resolve();
            };
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

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
          if (note.is_deleted && !note.sync_pending) {
            const deletedTime = new Date(note.deleted_at);
            const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); 

            if (deletedTime < cutoffTime) {
              notesStore.delete(note.id);
              cleanedCount++;
            }
          }
        });

        if (cleanedCount > 0) {
        }
      };

      request.onerror = () => {
        console.warn('Storage: Failed to cleanup soft deleted notes:', request.error);
      };
    } catch (error) {
      console.warn('Storage: Error during soft deleted notes cleanup:', error);
    }
  }

  startCleanupTask() {
    if (!this._cleanupIntervals) {
      this._cleanupIntervals = [];
    }

    const deletedNotesInterval = setInterval(() => {
      this.cleanupSyncedDeletedNotes();
    }, 60 * 60 * 1000); 
    this._cleanupIntervals.push(deletedNotesInterval);

    const oldVersionsInterval = setInterval(() => {
      this.cleanupAllOldVersions();
    }, 6 * 60 * 60 * 1000);
    this._cleanupIntervals.push(oldVersionsInterval);

    setTimeout(() => {
      this.cleanupSyncedDeletedNotes();
      this.cleanupAllOldVersions();
    }, 5000); 
  }

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
        }
      };

      notesRequest.onerror = () => {
        console.warn('Failed to cleanup old versions during periodic task:', notesRequest.error);
      };
    } catch (error) {
      console.warn('Error during periodic version cleanup:', error);
    }
  }

  async retryDecryptionForFailedNotes() {
    if (!this.db) await this.init();

    return new Promise(async (resolve, reject) => {
      try {
        const premiumStatus = await getPremiumStatus();
        if (!premiumStatus.isPremium) {
          console.log('Storage: Not premium, skipping decryption retry');
          resolve({ retried: 0, successful: 0, failed: 0 });
          return;
        }

        let userKey = null;
        try {
          userKey = await window.supabaseClient?.getUserEncryptionKey();
        } catch (error) {
          console.log('Storage: Encryption key not available, skipping decryption retry');
          resolve({ retried: 0, successful: 0, failed: 0 });
          return;
        }

        if (!userKey || !window.noteEncryption) {
          console.log('Storage: Encryption module or key not available, skipping decryption retry');
          resolve({ retried: 0, successful: 0, failed: 0 });
          return;
        }

        const transaction = this.db.transaction(['notes'], 'readwrite');
        const store = transaction.objectStore('notes');
        const request = store.getAll();

        request.onsuccess = async () => {
          const notes = request.result || [];

          const notesNeedingRetry = notes.filter(note =>
            note.needs_decryption_retry &&
            note.title_encrypted &&
            note.content_encrypted &&
            !note.is_deleted
          );

          if (notesNeedingRetry.length === 0) {
            console.log('Storage: No notes need decryption retry');
            resolve({ retried: 0, successful: 0, failed: 0 });
            return;
          }

          console.log(`Storage: Retrying decryption for ${notesNeedingRetry.length} notes`);

          let successful = 0;
          let failed = 0;
          const updatedNotes = [];


          for (const note of notesNeedingRetry) {
            try {

              const decryptedNote = await window.noteEncryption.decryptNoteFromCloud(note, userKey);

              const updatedNote = {
                ...note,
                title: decryptedNote.title,
                content: decryptedNote.content,
                tags: decryptedNote.tags || [],
                needs_decryption_retry: false,
                decryption_error: undefined,
                updatedAt: new Date().toISOString() 
              };

              updatedNotes.push(updatedNote);
              successful++;

            } catch (decryptError) {
              console.warn(`Storage: Decryption retry failed for note ${note.id}:`, decryptError.message);

              const updatedNote = {
                ...note,
                decryption_error: decryptError.message,
                updatedAt: new Date().toISOString()
              };

              updatedNotes.push(updatedNote);
              failed++;
            }
          }

          const updateTransaction = this.db.transaction(['notes'], 'readwrite');
          const updateStore = updateTransaction.objectStore('notes');

          for (const updatedNote of updatedNotes) {
            updateStore.put(updatedNote);
          }

          updateTransaction.oncomplete = () => {
            console.log(`Storage: Decryption retry completed - ${successful} successful, ${failed} failed`);

            if (successful > 0) {
              window.eventBus?.emit('notes:decryption_retry_success', {
                successful,
                failed,
                total: notesNeedingRetry.length
              });
            }

            resolve({
              retried: notesNeedingRetry.length,
              successful,
              failed
            });
          };

          updateTransaction.onerror = () => {
            console.error('Storage: Failed to save decryption retry results:', updateTransaction.error);
            reject(updateTransaction.error);
          };
        };

        request.onerror = () => {
          console.error('Storage: Failed to get notes for decryption retry:', request.error);
          reject(request.error);
        };

      } catch (error) {
        console.error('Storage: Error during decryption retry:', error);
        reject(error);
      }
    });
  }

  async getDecryptionRetryCount() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        const retryCount = notes.filter(note =>
          note.needs_decryption_retry &&
          !note.is_deleted
        ).length;

        resolve(retryCount);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async updateNoteSyncStatus(noteId, syncData) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const getRequest = notesStore.get(noteId);

      getRequest.onsuccess = () => {
        const note = getRequest.result;
        if (note) {
          Object.assign(note, syncData);

          const updateRequest = notesStore.put(note);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

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

        const filteredNotes = notes.filter(note => {
          if (note.is_deleted) return false;

          return note.title.toLowerCase().includes(searchTerm) ||
            note.content.toLowerCase().includes(searchTerm) ||
            note.tags.some(tag => tag.toLowerCase().includes(searchTerm));
        });

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

  async updateSearchIndex(note) {
    const words = new Set();
    const text = `${note.title} ${note.content}`.toLowerCase();
    const wordMatches = text.match(/\b\w+\b/g);

    if (wordMatches) {
      wordMatches.forEach(word => {
        if (word.length > 2) {
          words.add(word);
        }
      });
    }

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

  async getAllNotes() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getNotesForSync() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        const activeNotes = notes.filter(note => !note.is_deleted);
        const validNotes = activeNotes.filter(note => note.title && note.content);
        const syncableNotes = validNotes.filter(note => !note.needs_decryption_retry);
        syncableNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        const syncNotes = syncableNotes.map(note => ({
          id: note.id,
          title: note.title,
          content: note.content,
          url: note.url,
          domain: note.domain,
          tags: note.tags || [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt
        }));

        const retryNeededCount = validNotes.length - syncableNotes.length;
        if (retryNeededCount > 0) {
          console.log(`Storage: Excluding ${retryNeededCount} notes from sync due to pending decryption retry`);
        }

        resolve(syncNotes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllNotesForDisplay() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        const activeNotes = notes.filter(note => !note.is_deleted);
        activeNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(activeNotes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getNotesByDomain(domain) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const index = store.index('domain');
      const request = index.getAll(domain);

      request.onsuccess = () => {
        const notes = request.result || [];
        const activeNotes = notes.filter(note => !note.is_deleted);
        activeNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(activeNotes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getVersionHistory(noteId, limit = 10) {
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

  async saveNoteVersion(note, changeReason = 'manual_save') {
    if (!this.db) await this.init();
    if (changeReason === 'auto_save') {
      return null;
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
          await this.maintainVersionHistory(note.id, 5);
          resolve(version);
        } catch (error) {
          console.warn('Failed to maintain version history after adding new version:', error);
          resolve(version);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

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
            versions.sort((a, b) => (b.version || 0) - (a.version || 0));
            const toKeep = versions.slice(0, maxVersions);
            const toDelete = versions.slice(maxVersions);
            toDelete.forEach(version => {
              store.delete(version.id);
            });

            resolve(toDelete.length);
          } else {
            resolve(0);
          }
        };

        request.onerror = () => {
          console.warn('Failed to cleanup old versions:', request.error);
          resolve(0);
        };
      });
    } catch (error) {
      console.warn('Error during version cleanup:', error);
      return 0;
    }
  }

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
            versions.sort((a, b) => (b.version || 0) - (a.version || 0));
            const toKeep = versions.slice(0, maxVersions);
            const toDelete = versions.slice(maxVersions);
            toDelete.forEach(version => {
              store.delete(version.id);
            });
            resolve({ kept: toKeep.length, deleted: toDelete.length });
          } else {
            resolve({ kept: versions.length, deleted: 0 }); 
          }
        };

        request.onerror = () => {
          console.warn('Failed to maintain version history:', request.error);
          resolve({ kept: 0, deleted: 0 }); 
        };
      });
    } catch (error) {
      console.warn('Error during version history maintenance:', error);
      return { kept: 0, deleted: 0 }; 
    }
  }

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

  async exportData() {
    const transaction = this.db.transaction(['notes', 'attachments'], 'readonly');
    const notesStore = transaction.objectStore('notes');
    const attachmentsStore = transaction.objectStore('attachments');

    const [notes, attachments] = await Promise.all([
      new Promise(resolve => {
        const request = notesStore.getAll();
        request.onsuccess = () => {
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
      exportedAt: new Date().toISOString(),
      version: this.version,
      note: 'Only current notes are exported. Version history is preserved locally.'
    };
  }

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

  async checkPremiumAccess() {
    try {
      if (window.supabaseClient && typeof window.supabaseClient.isAuthenticated === 'function') {
        try {
          if (window.supabaseClient.isAuthenticated()) {
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
          }
        } catch (authError) {
          console.log('Supabase auth check failed:', authError.message);
        }
      } else {
        console.log('Supabase client not available for auth check');
      }
      try {
        const result = await chrome.storage.local.get(['userTier']);
        if (result.userTier) {
          const isPremium = result.userTier.active && result.userTier.tier !== 'free';
          return isPremium;
        }
      } catch (storageError) {
        console.log('Chrome storage check failed:', storageError.message);
      }
      console.log('No premium access confirmed, defaulting to false');
      return false;
    } catch (error) {
      console.error('Error checking premium access:', error);
      return false;
    }
  }
  async isVersionHistoryAvailable() {
    try {
      return (await getPremiumStatus()).isPremium;
    } catch (error) {
      console.error('Error checking version history availability:', error);
      return false;
    }
  }
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
            note.updatedAt = note.createdAt || new Date().toISOString();
            store.put(note);
            migratedCount++;
          }
        });

        if (migratedCount > 0) {
        }
      };

      request.onerror = () => {
        console.warn('Storage: Failed to migrate existing notes:', request.error);
      };
    } catch (error) {
      console.warn('Storage: Error during note migration:', error);
    }
  }
  async migrateNoteIds() {
    try {
      const transaction = this.db.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        let migratedCount = 0;

        notes.forEach(note => {
          if (note.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(note.id)) {
            const oldId = note.id;
            note.id = this.generateId();
            note.needsIdMigration = true;
            note.oldId = oldId;
            store.put(note);
            migratedCount++;
          }
        });

        if (migratedCount > 0) {
        }
      };

      request.onerror = () => {
        console.warn('Storage: Failed to migrate note IDs:', request.error);
      };
    } catch (error) {
      console.warn('Storage: Error during note ID migration:', error);
    }
  }

  async checkStorageQuota() {
    try {
      const stats = await this.getStorageStats();
      const estimatedQuota = 10 * 1024 * 1024;
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

  cleanNoteForExport(note) {
    const cleanNote = { ...note };
    delete cleanNote.title_encrypted;
    delete cleanNote.content_encrypted;
    delete cleanNote.tags_encrypted;
    delete cleanNote.content_hash;
    delete cleanNote.is_deleted;
    delete cleanNote.deleted_at;
    delete cleanNote.version;
    delete cleanNote.sync_pending;
    delete cleanNote.needs_decryption_retry;
    delete cleanNote.decryption_error;
    delete cleanNote.last_synced_at;
  
    if (!Array.isArray(cleanNote.tags)) {
      cleanNote.tags = [];
    }
    
    return cleanNote;
  }

  async exportNotes() {
    try {
      const notes = await this.getAllNotesForDisplay();
      const notesByDomain = {};
      notes.forEach(note => {
        if (!notesByDomain[note.domain]) {
          notesByDomain[note.domain] = [];
        }
        const cleanNote = this.cleanNoteForExport(note);
        notesByDomain[note.domain].push(cleanNote);
      });

      const exportData = {
        _anchored: {
          version: "1.0.0",
          exportedAt: new Date().toISOString(),
          source: "extension",
          format: "anchored-notes"
        },
        ...notesByDomain
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting notes:', error);
      throw error;
    }
  }

  async importNotes(importedData) {
    try {
      let notesImportedCount = 0;
      for (const domain in importedData) {
        if (domain === '_anchored' || !Array.isArray(importedData[domain])) continue;

        const domainNotes = importedData[domain];
        for (const note of domainNotes) {
          if (note && note.id) {
            const existingNote = await this.getNote(note.id);
            if (existingNote && existingNote.is_deleted && existingNote.sync_pending) {
              await this.removeDeletionRecord(note.id);
              console.log(`Overwriting deleted note ${note.id} with imported version`);
            }

            note.is_deleted = false;
            note.deleted_at = null;
            note.updatedAt = new Date().toISOString();

            await this.saveNote(note);
            notesImportedCount++;
          }
        }
      }

      return notesImportedCount;
    } catch (error) {
      console.error('Error importing notes:', error);
      throw error;
    }
  }

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

  async deleteNotesByDomain(domain) {
    console.warn('Storage: Domain deletion is deprecated in simplified sync system');

    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes', 'deletions'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const deletionsStore = transaction.objectStore('deletions');
      const request = notesStore.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        let deletedCount = 0;
        const notesToDelete = notes.filter(note => {
          if (note.is_deleted) return false;
          if (note.domain && note.domain === domain) return true;
          return false;
        });

        if (notesToDelete.length === 0) {
          resolve(0);
          return;
        }

        notesToDelete.forEach(note => {
          note.is_deleted = true;
          note.deleted_at = new Date().toISOString();
          note.updatedAt = new Date().toISOString();
          note.sync_pending = true;
          notesStore.put(note);
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

  async loadNotes() {
    try {
      const notes = await this.getAllNotes();
      notes.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      return notes;
    } catch (error) {
      console.error('Error loading notes:', error);
      return [];
    }
  }

  async getEditorState() {
    try {
      const result = await chrome.storage.local.get(['editorState']);
      return result.editorState || null;
    } catch (error) {
      console.warn('Error getting editor state:', error);
      return null;
    }
  }

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


  async clearEditorState() {
    try {
      await chrome.storage.local.remove('editorState');
    } catch (error) {
      console.warn('Error clearing editor state:', error);
    }
  }

  generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async getLocalDeletions() {
    try {
      return [];
    } catch (error) {
      console.warn('Failed to get local deletions:', error);
      return [];
    }
  }

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
            resolve([]); 
          }
        };
        request.onerror = () => {
          console.error('Storage: Error getting deletions:', request.error);
          resolve([]); 
        };
        transaction.onerror = () => {
          console.error('Storage: Transaction error in getUnsyncedDeletions:', transaction.error);
          resolve([]); 
        };
        transaction.oncomplete = () => {
        };

      } catch (error) {
        console.error('Storage: Error in getUnsyncedDeletions:', error);
        resolve([]);
      }
    });
  }
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
      };

      transaction.onerror = () => {
        console.error('Storage: Error marking deletions as synced:', transaction.error);
      };
    } catch (error) {
      console.error('Storage: Error in markDeletionsAsSynced:', error);
    }
  }
  async backupExistingData() {
    if (!this.db) return null;

    try {
      const backup = {};
      const notesTransaction = this.db.transaction(['notes'], 'readonly');
      const notesStore = notesTransaction.objectStore('notes');
      const notesRequest = notesStore.getAll();
      backup.notes = await new Promise((resolve) => {
        notesRequest.onsuccess = () => resolve(notesRequest.result || []);
        notesRequest.onerror = () => resolve([]);
      });
      const versionsTransaction = this.db.transaction(['versions'], 'readonly');
      const versionsStore = versionsTransaction.objectStore('versions');
      const versionsRequest = versionsStore.getAll();
      backup.versions = await new Promise((resolve) => {
        versionsRequest.onsuccess = () => resolve(versionsRequest.result || []);
        versionsRequest.onerror = () => resolve([]);
      });
      const attachmentsTransaction = this.db.transaction(['attachments'], 'readonly');
      const attachmentsStore = attachmentsTransaction.objectStore('attachments');
      const attachmentsRequest = attachmentsStore.getAll();
      backup.attachments = await new Promise((resolve) => {
        attachmentsRequest.onsuccess = () => resolve(attachmentsRequest.result || []);
        attachmentsRequest.onerror = () => resolve([]);
      });
      return backup;

    } catch (error) {
      console.error('Storage: Error backing up data:', error);
      return null;
    }
  }
  async restoreData(backup) {
    if (!backup || !this.db) return;

    try {
      if (backup.notes && backup.notes.length > 0) {
        const notesTransaction = this.db.transaction(['notes'], 'readwrite');
        const notesStore = notesTransaction.objectStore('notes');

        for (const note of backup.notes) {
          notesStore.put(note);
        }
      }

      if (backup.versions && backup.versions.length > 0) {
        const versionsTransaction = this.db.transaction(['versions'], 'readwrite');
        const versionsStore = versionsTransaction.objectStore('versions');

        for (const version of backup.versions) {
          versionsStore.put(version);
        }
      }

      if (backup.attachments && backup.attachments.length > 0) {
        const attachmentsTransaction = this.db.transaction(['attachments'], 'readwrite');
        const attachmentsStore = attachmentsTransaction.objectStore('attachments');

        for (const attachment of backup.attachments) {
          attachmentsStore.put(attachment);
        }
      }

    } catch (error) {
      console.error('Storage: Error restoring data:', error);
    }
  }

  async markDeletionsAsSyncedByNoteIds(noteIds) {
    if (!this.db) await this.init();

    try {
      const transaction = this.db.transaction(['deletions'], 'readwrite');
      const store = transaction.objectStore('deletions');
      let markedCount = 0;
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const allDeletions = getAllRequest.result || [];
        for (const deletion of allDeletions) {
          if (!deletion.synced && noteIds.includes(deletion.noteId)) {
            deletion.synced = true;
            store.put(deletion);
            markedCount++;
          }
        }
      };

      transaction.oncomplete = () => {
      };

      transaction.onerror = () => {
        console.error('Storage: Error marking deletions as synced by note IDs:', transaction.error);
      };
    } catch (error) {
      console.error('Storage: Error in markDeletionsAsSyncedByNoteIds:', error);
    }
  }
  async removeDeletionRecord(noteId) {
    if (!this.db) await this.init();

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction(['deletions'], 'readwrite');
        const store = transaction.objectStore('deletions');
        const request = store.getAll();
        request.onsuccess = () => {
          const deletions = request.result || [];
          let removedCount = 0;

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
window.notesStorage = new NotesStorage();
