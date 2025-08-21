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
        resolve();
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

  // Add or update a note
  async saveNote(note) {
    if (!this.db) await this.init();

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
      request.onsuccess = () => resolve(note);
      request.onerror = () => reject(request.error);
    });
  }

  // Get notes by domain
  async getNotesByDomain(domain, includeUrlSpecific = true) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const index = store.index('domain');
      const request = index.getAll(domain);

      request.onsuccess = () => {
        let notes = request.result;
        
        if (!includeUrlSpecific) {
          notes = notes.filter(note => !note.isUrlSpecific);
        }
        
        // Sort by updatedAt descending
        notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(notes);
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
        notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get a single note by ID
  async getNote(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete a note
  async deleteNote(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes', 'attachments', 'versions'], 'readwrite');
      const notesStore = transaction.objectStore('notes');
      const attachmentsStore = transaction.objectStore('attachments');
      const versionsStore = transaction.objectStore('versions');

      // Delete note
      notesStore.delete(id);

      // Delete associated attachments
      const attachmentIndex = attachmentsStore.index('noteId');
      const attachmentRequest = attachmentIndex.getAll(id);
      attachmentRequest.onsuccess = () => {
        attachmentRequest.result.forEach(attachment => {
          attachmentsStore.delete(attachment.id);
        });
      };

      // Delete version history
      const versionIndex = versionsStore.index('noteId');
      const versionRequest = versionIndex.getAll(id);
      versionRequest.onsuccess = () => {
        versionRequest.result.forEach(version => {
          versionsStore.delete(version.id);
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
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
        
        const filteredNotes = notes.filter(note => {
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

  // Get all notes (for sync purposes)
  async getAllNotes() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        // Sort by updatedAt descending
        notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(notes);
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

  // Clean up old versions (keep last 10) - Premium users only
  async cleanupOldVersions(noteId, maxVersions = 10) {
    // Check premium status before allowing access
    if (!await this.checkPremiumAccess()) {
      console.warn('Version cleanup skipped - premium feature');
      return;
    }

    if (!this.db) await this.init();
    try {
      const versions = await this.getVersionHistory(noteId);
      if (versions.length > maxVersions) {
        const toDelete = versions.slice(maxVersions);
        const transaction = this.db.transaction(['versions'], 'readwrite');
        const store = transaction.objectStore('versions');
        
        for (const version of toDelete) {
          store.delete(version.id);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old versions:', error);
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

  // Export all data
  async exportData() {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(['notes', 'attachments', 'versions'], 'readonly');
    const notesStore = transaction.objectStore('notes');
    const attachmentsStore = transaction.objectStore('attachments');
    const versionsStore = transaction.objectStore('versions');

    const [notes, attachments, versions] = await Promise.all([
      new Promise(resolve => {
        const request = notesStore.getAll();
        request.onsuccess = () => resolve(request.result);
      }),
      new Promise(resolve => {
        const request = attachmentsStore.getAll();
        request.onsuccess = () => resolve(request.result);
      }),
      new Promise(resolve => {
        const request = versionsStore.getAll();
        request.onsuccess = () => resolve(request.result);
      })
    ]);

    return {
      notes,
      attachments,
      versions,
      exportedAt: new Date().toISOString(),
      version: this.version
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

  // Check if user has premium access for version history features
  async checkPremiumAccess() {
    try {
      // Try to get premium status from storage
      const { userTier } = await chrome.storage.local.get(['userTier']);
      if (userTier && userTier.active && userTier.tier !== 'free') {
        return true;
      }
      
      // Fallback: check if premium status exists in memory
      if (window.premiumStatus && window.premiumStatus.isPremium) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Failed to check premium status:', error);
      return false;
    }
  }

  // Check if version history is available for UI purposes
  async isVersionHistoryAvailable() {
    return await this.checkPremiumAccess();
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
}

// Export singleton instance
window.notesStorage = new NotesStorage();
