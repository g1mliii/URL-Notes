/**
 * Storage Operations Module
 * Handles all Chrome storage interactions, note CRUD operations, and data management
 */
class StorageManager {
  constructor() {
    this.allNotes = [];
  }

  // ---- Promise wrappers to ensure reliability across Chrome versions ----
  async _lsGet(keys = null) {
    return new Promise((resolve) => {
      try { browserAPI.storage.local.get(keys, (res) => resolve(res || {})); } catch (_) { resolve({}); }
    });
  }
  async _lsSet(obj) {
    return new Promise((resolve, reject) => {
      try { browserAPI.storage.local.set(obj, () => resolve(true)); } catch (e) { reject(e); }
    });
  }
  async _lsRemove(keys) {
    return new Promise((resolve) => {
      try { browserAPI.storage.local.remove(keys, () => resolve(true)); } catch (_) { resolve(false); }
    });
  }

  // Load all notes from storage into the master list
  async loadNotes() {
    try {
      const allData = await this._lsGet(null);
      let allNotes = [];
      for (const key in allData) {
        // Filter out settings or non-array data. Only include arrays that look like notes.
        const val = allData[key];
        if (!Array.isArray(val)) continue;
        // Explicitly ignore known settings arrays
        if (key === 'allNotesOpenDomains') continue;
        // Heuristic: include only arrays of objects with expected note-like properties
        const sample = val.find?.(x => x && typeof x === 'object');
        const looksLikeNote = !!(sample && (sample.id || sample.content || sample.url || sample.domain));
        if (!looksLikeNote) continue;
        allNotes = allNotes.concat(val);
      }
      // Sort by most recently updated
      allNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      this.allNotes = allNotes;
      return this.allNotes;
    } catch (error) {
      this.allNotes = [];
      return this.allNotes;
    }
  }

  // Save a note to storage
  async saveNote(note) {
    if (!note || !note.domain) {
      throw new Error('Invalid note or missing domain');
    }

    // Get all notes for the current domain from storage
    const domain = note.domain;
    const data = await browserAPI.storage.local.get(domain);
    const notesForDomain = data[domain] || [];

    // Find and update the note, or add it if new
    const noteIndex = notesForDomain.findIndex(n => n.id === note.id);
    const isUpdate = noteIndex > -1;
    if (isUpdate) {
      notesForDomain[noteIndex] = note;
    } else {
      notesForDomain.push(note);
    }

    // Save back to storage
    await browserAPI.storage.local.set({ [domain]: notesForDomain });

    // Update master list in memory
    const masterIndex = this.allNotes.findIndex(n => n.id === note.id);
    if (masterIndex > -1) {
      this.allNotes[masterIndex] = note;
    } else {
      this.allNotes.unshift(note); // Add to front for visibility
    }

    // Sort master list again to be safe
    this.allNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Emit event
    try {
      if (window.eventBus) {
        if (isUpdate) window.eventBus.emit('notes:updated', { note });
        else window.eventBus.emit('notes:created', { note });
      }
    } catch (_) { }

    return note;
  }

  // Delete a note by ID
  async deleteNote(noteId) {
    const note = this.allNotes.find(n => n.id === noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Remove from master list
    this.allNotes = this.allNotes.filter(n => n.id !== noteId);

    // Remove from storage
    const domain = note.domain;
    const data = await browserAPI.storage.local.get(domain);
    let notesForDomain = data[domain] || [];
    notesForDomain = notesForDomain.filter(n => n.id !== noteId);
    await browserAPI.storage.local.set({ [domain]: notesForDomain });

    // Emit event
    try { window.eventBus?.emit('notes:deleted', { id: noteId, domain }); } catch (_) { }
    return note;
  }

  // Delete all notes for a specific domain
  async deleteNotesByDomain(domain) {
    if (!domain) {
      throw new Error('Domain is required');
    }

    // Remove from master list in memory
    this.allNotes = this.allNotes.filter(note => note.domain !== domain);

    // Remove from storage
    await browserAPI.storage.local.remove(domain);

    // Emit event
    try { window.eventBus?.emit('notes:domain_deleted', { domain }); } catch (_) { }
    return domain;
  }

  // Clean note data for export by removing internal fields
  cleanNoteForExport(note) {
    const cleanNote = { ...note };
    
    // Remove encryption-related fields
    delete cleanNote.title_encrypted;
    delete cleanNote.content_encrypted;
    delete cleanNote.tags_encrypted;
    delete cleanNote.content_hash;
    
    // Remove internal storage fields
    delete cleanNote.is_deleted;
    delete cleanNote.deleted_at;
    delete cleanNote.version;
    delete cleanNote.sync_pending;
    delete cleanNote.needs_decryption_retry;
    delete cleanNote.decryption_error;
    delete cleanNote.last_synced_at;
    
    // Ensure tags is always an array
    if (!Array.isArray(cleanNote.tags)) {
      cleanNote.tags = [];
    }
    
    return cleanNote;
  }

  // Export all notes to JSON format (only visible notes, excluding deleted/filtered notes)
  async exportNotes() {
    try {
      // Use the filtered notes from memory (same as what's displayed in UI)
      // This ensures we only export notes that are currently visible to the user
      const filteredNotes = this.allNotes || [];

      // Group notes by domain and clean them for export
      const notesData = {};
      for (const note of filteredNotes) {
        if (!note.domain) continue; // Skip notes without domain

        if (!notesData[note.domain]) {
          notesData[note.domain] = [];
        }
        // Clean note data before export
        const cleanNote = this.cleanNoteForExport(note);
        notesData[note.domain].push(cleanNote);
      }

      // Add Anchored export identifier and metadata
      const exportData = {
        _anchored: {
          version: "1.0.0",
          exportedAt: new Date().toISOString(),
          source: "extension",
          format: "anchored-notes"
        },
        ...notesData
      };

      return exportData;
    } catch (error) {
      throw error;
    }
  }

  // Import notes from JSON data
  async importNotes(importedData) {
    try {
      const currentData = await browserAPI.storage.local.get(null);
      let notesImportedCount = 0;
      let notesSkippedCount = 0;
      let notesUpdatedCount = 0;

      // Merge data, imported notes will overwrite existing notes with the same ID
      for (const domain in importedData) {
        // Skip metadata and non-note data
        if (domain === '_anchored' || domain === 'themeMode' || !Array.isArray(importedData[domain])) continue;

        const existingNotes = currentData[domain] || [];
        const importedNotes = importedData[domain];
        const notesMap = new Map(existingNotes.map(note => [note.id, note]));

        importedNotes.forEach(note => {
          if (note && note.id) {
            // Check if note already exists
            const existingNote = notesMap.get(note.id);

            // If existing note is deleted with pending sync, we'll overwrite it
            if (existingNote && existingNote.is_deleted && existingNote.sync_pending) {
              console.log(`Overwriting deleted note ${note.id} with imported version`);
            }

            // Add timestamp if missing
            if (!note.createdAt) {
              note.createdAt = new Date().toISOString();
            }
            
            // CRITICAL: Force fresh timestamp for imported notes to ensure they sync
            // This ensures imported notes are newer than lastSyncTime
            note.updatedAt = new Date().toISOString();

            // Ensure imported note is not marked as deleted
            note.is_deleted = false;
            note.deleted_at = null;

            notesMap.set(note.id, note);

            if (existingNote) {
              notesUpdatedCount++;
            } else {
              notesImportedCount++;
            }
          } else {
            notesSkippedCount++;
          }
        });

        currentData[domain] = Array.from(notesMap.values());
      }

      await browserAPI.storage.local.set(currentData);
      await this.loadNotes(); // Reload all notes into memory

      // Emit event
      try {
        window.eventBus?.emit('notes:imported', {
          imported: notesImportedCount,
          updated: notesUpdatedCount,
          skipped: notesSkippedCount
        });
      } catch (_) { }

      return {
        success: true,
        imported: notesImportedCount,
        updated: notesUpdatedCount,
        skipped: notesSkippedCount,
        total: notesImportedCount + notesUpdatedCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown import error',
        imported: 0,
        updated: 0,
        skipped: 0
      };
    }
  }

  // Check storage quota and return usage info
  // Removed: checkStorageQuota (dev-only utility)

  // Persist editor open flag (and keep existing noteDraft intact)
  async persistEditorOpen(isOpen) {
    try {
      const { editorState } = await browserAPI.storage.local.get(['editorState']);
      const state = editorState || {};
      state.open = isOpen;
      await browserAPI.storage.local.set({ editorState: state });
    } catch (_) { }
  }

  // Save the current editor draft (title/content/tags) into storage
  async saveEditorDraft(noteDraft, caretStart = 0, caretEnd = 0) {
    try {
      if (!noteDraft) return;

      const state = {
        open: true,
        noteDraft: { ...noteDraft },
        caretStart,
        caretEnd
      };

      await browserAPI.storage.local.set({ editorState: state });
    } catch (_) { }
  }

  // Clear editor state entirely
  async clearEditorState() {
    try {
      await browserAPI.storage.local.remove('editorState');
    } catch (_) { }
  }

  // Clear all editor drafts (for complete state reset)
  async clearAllEditorDrafts() {
    try {
      await browserAPI.storage.local.remove(['editorState']);
      // Also clear any other draft-related storage
      const keys = await browserAPI.storage.local.get(null);
      const draftKeys = Object.keys(keys).filter(key =>
        key.includes('draft') || key.includes('editor')
      );
      if (draftKeys.length > 0) {
        await browserAPI.storage.local.remove(draftKeys);
      }
    } catch (_) { }
  }

  // Get editor state
  async getEditorState() {
    try {
      const { editorState } = await browserAPI.storage.local.get(['editorState']);
      return editorState || null;
    } catch (_) {
      return null;
    }
  }

  // Filter notes by domain
  getNotesByDomain(domain) {
    return this.allNotes.filter(note => note.domain === domain);
  }

  // Filter notes by URL (normalized)
  getNotesByUrl(url, normalizePageKey) {
    if (!normalizePageKey) {
      return this.allNotes.filter(note => note.url === url);
    }
    const currentKey = normalizePageKey(url);
    return this.allNotes.filter(note => normalizePageKey(note.url) === currentKey);
  }

  // Get all notes
  getAllNotes() {
    return this.allNotes;
  }

  // Generate a unique ID
  generateId() {
    // Use crypto.randomUUID() if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback to UUID v4 format for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Removed: development utilities for mock data generation/cleanup

  // Removed: storage usage and stress tools (quota testing)
}

// Export for use in other modules
window.StorageManager = StorageManager;

