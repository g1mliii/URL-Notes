// Settings Manager Module
// Handles settings panel, font settings, data import/export, and user preferences

class SettingsManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.settingsPanel = document.getElementById('settingsPanel');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.settingsBackBtn = document.getElementById('settingsBackBtn');
    this.fontSelector = document.getElementById('fontSelector');
    this.fontSizeSlider = document.getElementById('fontSizeSlider');
    this.fontSizeValue = document.getElementById('fontSizeValue');
    this.fontPreviewText = document.getElementById('fontPreviewText');
    this.exportNotesBtn = document.getElementById('exportNotesBtn');
    this.importNotesBtn = document.getElementById('importNotesBtn');
    this.importNotesInput = document.getElementById('importNotesInput');
    
    this.currentFont = 'Default';
    this.currentFontSize = 12;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Settings panel toggle
    this.settingsBtn?.addEventListener('click', () => this.openSettings());
    this.settingsBackBtn?.addEventListener('click', () => this.closeSettings());

    // Font settings
    this.fontSelector?.addEventListener('change', (e) => this.handleFontChange(e.target.value));
    this.fontSizeSlider?.addEventListener('input', (e) => this.handleFontSizeChange(parseInt(e.target.value)));

    // Data management
    this.exportNotesBtn?.addEventListener('click', () => this.handleExportNotes());
    this.importNotesBtn?.addEventListener('click', () => this.importNotesInput?.click());
    this.importNotesInput?.addEventListener('change', (e) => this.handleImportNotes(e));
  }

  // Open settings panel
  openSettings() {
    const notesList = document.querySelector('.notes-container');
    const noteEditor = document.getElementById('noteEditor');
    
    if (notesList) notesList.style.display = 'none';
    if (noteEditor) noteEditor.style.display = 'none';
    if (this.settingsPanel) this.settingsPanel.style.display = 'block';
  }

  // Close settings panel
  closeSettings() {
    const notesList = document.querySelector('.notes-container');
    const noteEditor = document.getElementById('noteEditor');
    
    if (this.settingsPanel) this.settingsPanel.style.display = 'none';
    if (notesList) notesList.style.display = 'block';
    
    // Don't automatically show editor - let the main app handle state
  }

  // Load font settings from storage
  async loadFontSetting() {
    try {
      const { fontFamily, fontSize } = await chrome.storage.local.get(['fontFamily', 'fontSize']);
      
      this.currentFont = fontFamily || 'Default';
      this.currentFontSize = fontSize || 12;
      
      // Update UI controls
      if (this.fontSelector) {
        this.fontSelector.value = this.currentFont;
      }
      if (this.fontSizeSlider) {
        this.fontSizeSlider.value = this.currentFontSize;
      }
      if (this.fontSizeValue) {
        this.fontSizeValue.textContent = `${this.currentFontSize}px`;
      }
      
      // Apply font settings
      this.applyFontSettings();
    } catch (error) {
      console.error('Error loading font settings:', error);
    }
  }

  // Handle font family change
  async handleFontChange(fontFamily) {
    this.currentFont = fontFamily;
    await chrome.storage.local.set({ fontFamily });
    this.applyFontSettings();
  }

  // Handle font size change
  async handleFontSizeChange(fontSize) {
    this.currentFontSize = fontSize;
    if (this.fontSizeValue) {
      this.fontSizeValue.textContent = `${fontSize}px`;
    }
    await chrome.storage.local.set({ fontSize });
    this.applyFontSettings();
  }

  // Apply font settings to the UI
  applyFontSettings() {
    const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
    const fontSize = `${this.currentFontSize}px`;
    
    // Apply to editor content
    const noteContentInput = document.getElementById('noteContentInput');
    if (noteContentInput) {
      noteContentInput.style.fontFamily = fontFamily;
      noteContentInput.style.fontSize = fontSize;
    }
    
    // Apply to preview
    const noteContentPreview = document.getElementById('noteContentPreview');
    if (noteContentPreview) {
      noteContentPreview.style.fontFamily = fontFamily;
      noteContentPreview.style.fontSize = fontSize;
    }
    
    // Apply to font preview
    if (this.fontPreviewText) {
      this.fontPreviewText.style.fontFamily = fontFamily;
      this.fontPreviewText.style.fontSize = fontSize;
    }
    
    // Apply to notes list content
    const notesList = document.getElementById('notesList');
    if (notesList) {
      const noteContents = notesList.querySelectorAll('.note-content');
      noteContents.forEach(content => {
        content.style.fontFamily = fontFamily;
        content.style.fontSize = fontSize;
      });
    }
  }

  // Initialize settings UI
  initSettings() {
    // Ensure font preview is properly styled
    if (this.fontPreviewText) {
      this.applyFontSettings();
    }
    
    // Set up any other initial settings UI state
    this.updateFontPreview();
  }

  // Update font preview display
  updateFontPreview() {
    if (this.fontPreviewText) {
      const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
      this.fontPreviewText.style.fontFamily = fontFamily;
      this.fontPreviewText.style.fontSize = `${this.currentFontSize}px`;
    }
  }

  // Handle export notes
  async handleExportNotes() {
    try {
      const exportData = await this.storageManager.exportNotes();
      
      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `url-notes-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Show success message
      this.showNotification('Notes exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting notes:', error);
      this.showNotification('Failed to export notes', 'error');
    }
  }

  // Handle import notes
  async handleImportNotes(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data structure
      if (!importData.notes || !Array.isArray(importData.notes)) {
        throw new Error('Invalid import file format');
      }
      
      const result = await this.storageManager.importNotes(importData);
      
      if (result.success) {
        this.showNotification(`Successfully imported ${result.imported} notes!`, 'success');
        // Trigger notes reload in main app
        if (window.urlNotesApp && window.urlNotesApp.loadNotes) {
          window.urlNotesApp.loadNotes();
        }
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (error) {
      console.error('Error importing notes:', error);
      this.showNotification('Failed to import notes: ' + error.message, 'error');
    } finally {
      // Clear the file input
      event.target.value = '';
    }
  }

  // Show notification message
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Get current settings
  getSettings() {
    return {
      fontFamily: this.currentFont,
      fontSize: this.currentFontSize
    };
  }

  // Apply settings to new elements (called when notes are rendered)
  applySettingsToElement(element) {
    if (!element) return;
    
    const fontFamily = this.currentFont === 'Default' ? 'inherit' : this.currentFont;
    const fontSize = `${this.currentFontSize}px`;
    
    // Apply to note content within the element
    const noteContents = element.querySelectorAll('.note-content');
    noteContents.forEach(content => {
      content.style.fontFamily = fontFamily;
      content.style.fontSize = fontSize;
    });
  }
}

// Export to global scope
window.SettingsManager = SettingsManager;
