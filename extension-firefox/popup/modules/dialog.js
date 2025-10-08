/**
 * Custom Confirmation Dialog (Promise-based)
 */
class CustomDialog {
  constructor() {
    this.overlay = document.getElementById('custom-dialog-overlay');
    this.messageElement = document.getElementById('dialog-message');
    this.confirmBtn = document.getElementById('dialog-confirm-btn');
    this.cancelBtn = document.getElementById('dialog-cancel-btn');
    this.resolve = null;

    this.confirmBtn.addEventListener('click', () => this.handleConfirm(true));
    this.cancelBtn.addEventListener('click', () => this.handleConfirm(false));
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.handleConfirm(false);
      }
    });

    // Flush draft immediately when popup is deactivating to capture last keystrokes
    const flushDraft = () => {
      try {
        // Only save if we have a current note, editor is open, and not during AI rewrite
        if (window.urlNotesApp && window.urlNotesApp.saveEditorDraft && window.urlNotesApp.currentNote) {
          const editor = document.getElementById('noteEditor');
          if (editor && editor.style.display !== 'none' && !window.urlNotesApp._isApplyingAIRewrite) {
            window.urlNotesApp.saveEditorDraft();
          }
        }
      } catch (_) { }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushDraft();
    });
    window.addEventListener('blur', flushDraft);
    window.addEventListener('pagehide', flushDraft);
  }

  show(message) {
    return new Promise((resolve) => {
      this.messageElement.textContent = message;
      this.resolve = resolve;
      this.overlay.classList.add('show');
    });
  }

  hide() {
    this.overlay.classList.remove('show');
    this.resolve = null;
  }

  handleConfirm(confirmed) {
    if (this.resolve) {
      this.resolve(confirmed);
    }
    this.hide();
  }
}

// Export for use in other modules
window.CustomDialog = CustomDialog;
