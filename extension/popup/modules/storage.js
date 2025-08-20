/**
 * Storage Operations Module
 * Handles all Chrome storage interactions, note CRUD operations, and data management
 */
class StorageManager {
  constructor() {
    this.allNotes = [];
  }

  // Load all notes from storage into the master list
  async loadNotes() {
    try {
      const allData = await chrome.storage.local.get(null);
      let allNotes = [];
      for (const key in allData) {
        // Filter out settings or non-array data
        if (key !== 'themeMode' && Array.isArray(allData[key])) {
          allNotes = allNotes.concat(allData[key]);
        }
      }
      // Sort by most recently updated
      allNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      this.allNotes = allNotes;
      return allNotes;
    } catch (error) {
      console.error('Error loading notes:', error);
      this.allNotes = []; // Fallback to an empty list on error
      return [];
    }
  }

  // Save a note to storage
  async saveNote(note) {
    if (!note || !note.domain) {
      throw new Error('Invalid note or missing domain');
    }

    // Get all notes for the current domain from storage
    const domain = note.domain;
    const data = await chrome.storage.local.get(domain);
    const notesForDomain = data[domain] || [];

    // Find and update the note, or add it if new
    const noteIndex = notesForDomain.findIndex(n => n.id === note.id);
    if (noteIndex > -1) {
      notesForDomain[noteIndex] = note;
    } else {
      notesForDomain.push(note);
    }

    // Save back to storage
    await chrome.storage.local.set({ [domain]: notesForDomain });

    // Update master list in memory
    const masterIndex = this.allNotes.findIndex(n => n.id === note.id);
    if (masterIndex > -1) {
      this.allNotes[masterIndex] = note;
    } else {
      this.allNotes.unshift(note); // Add to front for visibility
    }

    // Sort master list again to be safe
    this.allNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
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
    const data = await chrome.storage.local.get(domain);
    let notesForDomain = data[domain] || [];
    notesForDomain = notesForDomain.filter(n => n.id !== noteId);
    await chrome.storage.local.set({ [domain]: notesForDomain });

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
    await chrome.storage.local.remove(domain);

    return domain;
  }

  // Export all notes to JSON format
  async exportNotes() {
    try {
      const allData = await chrome.storage.local.get(null);
      const notesData = {};
      for (const key in allData) {
        if (key !== 'themeMode' && key !== 'editorFont' && key !== 'editorFontSize' && key !== 'accentCache' && key !== 'editorState' && key !== 'lastFilterMode' && key !== 'lastAction') {
          notesData[key] = allData[key];
        }
      }
      return notesData;
    } catch (error) {
      console.error('Error exporting notes:', error);
      throw error;
    }
  }

  // Import notes from JSON data
  async importNotes(importedData) {
    try {
      const currentData = await chrome.storage.local.get(null);
      let notesImportedCount = 0;

      // Merge data, imported notes will overwrite existing notes with the same ID
      for (const domain in importedData) {
        if (domain === 'themeMode' || !Array.isArray(importedData[domain])) continue;
        
        const existingNotes = currentData[domain] || [];
        const importedNotes = importedData[domain];
        const notesMap = new Map(existingNotes.map(note => [note.id, note]));
        
        importedNotes.forEach(note => {
          if (note && note.id) { // Basic validation
            notesMap.set(note.id, note);
            notesImportedCount++;
          }
        });

        currentData[domain] = Array.from(notesMap.values());
      }

      await chrome.storage.local.set(currentData);
      await this.loadNotes(); // Reload all notes into memory
      
      return notesImportedCount;
    } catch (error) {
      console.error('Error importing notes:', error);
      throw error;
    }
  }

  // Check storage quota and return usage info
  async checkStorageQuota() {
    try {
      const usage = await navigator.storage.estimate();
      const quota = usage.quota;
      const usageInMB = (usage.usage / (1024 * 1024)).toFixed(2);
      const quotaInMB = (quota / (1024 * 1024)).toFixed(2);
      const percentage = ((usage.usage / quota) * 100).toFixed(1);

      return {
        usage: usage.usage,
        quota: quota,
        usageInMB: parseFloat(usageInMB),
        quotaInMB: parseFloat(quotaInMB),
        percentage: parseFloat(percentage)
      };
    } catch (error) {
      console.error('Error checking storage quota:', error);
      return null;
    }
  }

  // Persist editor open flag (and keep existing noteDraft intact)
  async persistEditorOpen(isOpen) {
    try {
      const { editorState } = await chrome.storage.local.get(['editorState']);
      const state = editorState || {};
      state.open = isOpen;
      await chrome.storage.local.set({ editorState: state });
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
      
      await chrome.storage.local.set({ editorState: state });
    } catch (_) { }
  }

  // Clear editor state entirely
  async clearEditorState() {
    try {
      await chrome.storage.local.remove('editorState');
    } catch (_) { }
  }

  // Get editor state
  async getEditorState() {
    try {
      const { editorState } = await chrome.storage.local.get(['editorState']);
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
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

// Export for use in other modules
window.StorageManager = StorageManager;
