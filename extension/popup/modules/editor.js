/**
 * Editor Module - Handles note editing, content management, and editor UI
 */
class EditorManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.currentNote = null;
    this.saveDraftDebounced = Utils.debounce(() => this.saveEditorDraft(), 150);
  }

  // Create a new note
  createNewNote(currentSite) {
    // Handle case where currentSite might be null (e.g., extension opened from management page)
    if (!currentSite) {
      // Remove verbose logging
      currentSite = {
        domain: 'general',
        url: 'chrome://extensions',
        title: 'General Note'
      };
    }
    
    const newNote = {
      id: this.generateId(),
      title: '',
      content: '',
      tags: [],
      domain: currentSite.domain || 'unknown',
      url: currentSite.url || 'unknown',
      pageTitle: currentSite.title || 'Unknown Page',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.currentNote = newNote;
    this.openEditor();
    this.populateEditor();
    return newNote;
  }

  // Open existing note
  openNote(note) {
    this.currentNote = { ...note };
    this.openEditor();
    this.populateEditor();
  }

  // Populate editor with note data
  populateEditor() {
    try {
      if (!this.currentNote) return;
      
      const titleHeader = document.getElementById('noteTitleHeader');
      const contentInput = document.getElementById('noteContentInput');
      const tagsInput = document.getElementById('tagsInput');
      const dateSpan = document.getElementById('noteDate');
      
      // Populate title
      if (titleHeader) {
        titleHeader.value = this.currentNote.title || '';
      }
      
      // Populate content
      if (contentInput) {
        contentInput.innerHTML = this.buildContentHtml(this.currentNote.content || '');
      }
      
      // Populate tags
      if (tagsInput) {
        tagsInput.value = (this.currentNote.tags || []).join(', ');
      }
      
      // Populate date
      if (dateSpan) {
        dateSpan.textContent = this.currentNote.createdAt ? 
          new Date(this.currentNote.createdAt).toLocaleDateString() : '';
      }
      
      // Update character count
      this.updateCharCount();
      
    } catch (error) {
      console.error('Error populating editor:', error);
    }
  }

  // Open the note editor
  async openEditor(focusContent = false) {
    const editor = document.getElementById('noteEditor');
    const notesContainer = document.querySelector('.notes-container');
    const searchContainer = document.querySelector('.search-container');
    const aiRewriteBtn = document.getElementById('aiRewriteBtn');
    
    if (!editor || !notesContainer || !searchContainer) {
      console.error('Editor elements not found');
      return;
    }

    // Hide notes list and show editor
    notesContainer.style.display = 'none';
    searchContainer.style.display = 'none';
    
    // Show editor and trigger slide-in animation
    editor.style.display = 'flex';
    editor.classList.add('open');
    
    // Small delay to ensure display change is applied before animation
    setTimeout(() => {
      editor.classList.add('slide-in');
    }, 10);

    // Focus the editor
    if (focusContent) {
      const contentInput = document.getElementById('noteContentInput');
      if (contentInput) {
        contentInput.focus();
        // Move cursor to end of content
        const content = contentInput.textContent || '';
        if (content.length > 0) {
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(contentInput);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    } else {
      const titleHeader = document.getElementById('noteTitleHeader');
      if (titleHeader) titleHeader.focus();
    }

    // Toggle premium-only controls (AI button) based on premium access
    try {
      const premiumStatus = await getPremiumStatus();
      const isPremium = premiumStatus.isPremium;
      if (aiRewriteBtn) aiRewriteBtn.style.display = isPremium ? 'flex' : 'none';
    } catch (_) {
      // Hide AI button if premium check fails
      if (aiRewriteBtn) aiRewriteBtn.style.display = 'none';
    }

    // Update premium UI to hide/show ads appropriately
    try {
      if (window.urlNotesApp && window.urlNotesApp.updatePremiumUI) {
        await window.urlNotesApp.updatePremiumUI();
      }
    } catch (error) {
              // Remove verbose logging
    }

    // Emit editor opened event
    window.eventBus?.emit('editor:opened');
  }

  // Close the note editor
  closeEditor(options = { clearDraft: false }) {
    const editor = document.getElementById('noteEditor');
    const notesContainer = document.querySelector('.notes-container');
    const searchContainer = document.querySelector('.search-container');
    
    if (!editor || !notesContainer || !searchContainer) {
      console.error('Editor elements not found for closing');
      return;
    }
    
    // Add slide-out animation
    editor.classList.add('slide-out');
    
    setTimeout(() => {
      // Hide editor and show notes
      editor.style.display = 'none';
      notesContainer.style.display = 'block';
      searchContainer.style.display = 'block';
      
      // Remove animation classes
      editor.classList.remove('open', 'slide-in', 'slide-out', 'editor-fade-in');
      
      // If requested, clear cached draft; otherwise keep cached but mark not open
      if (options && options.clearDraft) {
        this.clearEditorState();
        // Only when explicitly clearing the draft do we drop currentNote reference
        this.currentNote = null;
      } else {
        // Cache latest draft immediately on close to avoid losing unsaved edits
        this.saveEditorDraft();
        this.persistEditorOpen(false);
      }
    }, 240);
  }

  // Render markdown/plain text to minimal HTML for the contenteditable editor
  buildContentHtml(content) {
    try {
      const escapeHtml = (s) => (s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const lines = (content || '').split(/\r?\n/);
      const mdLink = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
      const htmlLines = lines.map(line => {
        let out = '';
        let lastIndex = 0;
        let match;
        while ((match = mdLink.exec(line)) !== null) {
          out += escapeHtml(line.slice(lastIndex, match.index));
          const text = escapeHtml(match[1]);
          const href = match[2];
          out += `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
          lastIndex = mdLink.lastIndex;
        }
        out += escapeHtml(line.slice(lastIndex));
        return out;
      });
      return htmlLines.join('<br>');
    } catch (e) {
      return (content || '').replace(/\n/g, '<br>');
    }
  }

  // Convert limited HTML back to markdown-like plain text for storage
  htmlToMarkdown(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    // Remove disallowed tags by unwrapping while preserving line breaks.
    // For block elements, insert <br> boundaries to reflect visual line breaks.
    const allowed = new Set(['A', 'BR']);
    const blockTags = new Set(['DIV', 'P', 'PRE', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT, null);
    const toRemove = [];
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (!allowed.has(el.tagName)) {
        const isBlock = blockTags.has(el.tagName);
        if (isBlock) {
          // Insert a <br> before block (if not at start or already separated)
          if (el.previousSibling && el.previousSibling.nodeName !== 'BR') {
            el.parentNode.insertBefore(document.createElement('br'), el);
          }
        }
        // Unwrap: move children out in place
        let lastChild = null;
        while (el.firstChild) {
          lastChild = el.firstChild;
          el.parentNode.insertBefore(lastChild, el);
        }
        if (isBlock) {
          // Insert a <br> after block to mark end of this block
          if (lastChild && lastChild.nodeName !== 'BR') {
            el.parentNode.insertBefore(document.createElement('br'), el);
          }
        }
        toRemove.push(el);
      }
    }
    toRemove.forEach(n => n.remove());

    // Replace anchors with [text](href)
    tmp.querySelectorAll('a[href]').forEach(a => {
      const text = a.textContent || a.getAttribute('href');
      const href = a.getAttribute('href');
      const md = document.createTextNode(`[${text}](${href})`);
      a.replaceWith(md);
    });

    // Convert <br> to \n
    const htmlStr = tmp.innerHTML
      .replace(/<br\s*\/?>(?=\n)?/gi, '\n')
      .replace(/<br\s*\/?>(?!\n)/gi, '\n');

    // Strip remaining tags if any
    const text = htmlStr.replace(/<[^>]*>/g, '');
    // Decode entities by using textContent of a temp element
    const decode = document.createElement('textarea');
    decode.innerHTML = text;
    return decode.value;
  }

  // --- Caret/Selection utilities ---
  getSelectionOffsets(container) {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };
      const range = sel.getRangeAt(0);
      const computePos = (node, targetNode, targetOffset) => {
        let pos = 0;
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_ALL, null);
        let current = walker.currentNode;
        const advance = (n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            pos += n.nodeValue.length;
          } else if (n.nodeName === 'BR') {
            pos += 1; // treat <br> as one char (newline)
          }
        };
        // If container itself is text node, handle differently
        if (node.nodeType === Node.TEXT_NODE) {
          // Not typical for our container; fallback to length
          return Math.min(targetOffset, node.nodeValue.length);
        }
        while (current) {
          if (current === targetNode) {
            if (current.nodeType === Node.TEXT_NODE) {
              pos += Math.min(targetOffset, current.nodeValue.length);
            } else if (current.nodeName === 'BR') {
              pos += 1; // caret after BR counts as after newline
            }
            break;
          }
          // Dive into children first
          if (current.firstChild) {
            current = current.firstChild;
            continue;
          }
          // Process node
          advance(current);
          // Move to next sibling or ascend
          while (current && !current.nextSibling && current !== node) {
            current = current.parentNode;
          }
          if (!current || current === node) {
            break;
          }
          current = current.nextSibling;
        }
        return pos;
      };
      const start = computePos(container, range.startContainer, range.startOffset);
      const end = computePos(container, range.endContainer, range.endOffset);
      return { start, end };
    } catch (_) {
      return { start: 0, end: 0 };
    }
  }

  setSelectionOffsets(container, start, end) {
    try {
      let pos = 0;
      let startNode = null, startOffset = 0;
      let endNode = null, endOffset = 0;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_ALL, null);
      let current = walker.currentNode;

      const matchPoint = (needStart, needEnd, len) => {
        if (needStart && startNode === null && pos + len >= start) {
          startNode = current.nodeType === Node.TEXT_NODE ? current : container;
          startOffset = current.nodeType === Node.TEXT_NODE ? (start - pos) : 0;
        }
        if (needEnd && endNode === null && pos + len >= end) {
          endNode = current.nodeType === Node.TEXT_NODE ? current : container;
          endOffset = current.nodeType === Node.TEXT_NODE ? (end - pos) : 0;
        }
      };

      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          const len = current.nodeValue.length;
          matchPoint(true, true, len);
          pos += len;
        } else if (current.nodeName === 'BR') {
          const len = 1;
          // Place caret before/after BR by anchoring to container and zero offsets; browsers will place it around the BR
          matchPoint(true, true, len);
          pos += len;
        }

        // Traverse depth-first
        if (current.firstChild) {
          current = current.firstChild;
          continue;
        }
        while (current && !current.nextSibling && current !== container) {
          current = current.parentNode;
        }
        if (!current || current === container) break;
        current = current.nextSibling;
      }

      const range = document.createRange();
      range.setStart(startNode || container, startNode ? startOffset : 0);
      range.setEnd(endNode || container, endNode ? endOffset : 0);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }

  // Handle paste into contenteditable: sanitize to safe minimal HTML
  handleEditorPaste(e) {
    try {
      const clipboard = e.clipboardData || window.clipboardData;
      if (!clipboard) return; // let default behavior
      const text = clipboard.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      const html = this.sanitizePastedTextToHtml(text);
      this.insertHtmlAtCaret(html);
      this.updateCharCount();
    } catch (_) {
      // On error, allow default paste
    }
  }

  // Convert pasted plain text to safe HTML (linkify + line breaks)
  sanitizePastedTextToHtml(text) {
    const escapeHtml = (s) => (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&#34;')
      .replace(/'/g, '&#39;');

    // Split into lines and escape first
    const raw = (text || '').replace(/\r\n?/g, '\n');
    const lines = raw.split('\n').map(escapeHtml);
    // Linkify URLs and emails per line
    const urlRe = /\b(https?:\/\/[^\s<>"]+)\b/g;
    const emailRe = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
    const linked = lines.map(line => {
      let out = line.replace(urlRe, (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`);
      out = out.replace(emailRe, (m) => `<a href="mailto:${m}">${m}</a>`);
      return out;
    });
    return linked.join('<br>');
  }

  // Insert HTML at caret within contenteditable safely
  insertHtmlAtCaret(html) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      document.execCommand('insertHTML', false, html);
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const frag = range.createContextualFragment(html);
    const lastNode = frag.lastChild;
    range.insertNode(frag);
    // Move caret after inserted content
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // Handle clicking links inside the editor contenteditable
  handleEditorLinkClick(e) {
    const target = e.target;
    if (target && target.tagName === 'A') {
      e.preventDefault();
      const href = target.getAttribute('href');
      const text = target.textContent || '';
      // Need to call the main app's openLinkAndHighlight method
      if (window.urlNotesApp && window.urlNotesApp.openLinkAndHighlight) {
        window.urlNotesApp.openLinkAndHighlight(href, text);
      }
    }
  }

  // Simple list functionality
  createList() {
    const contentInput = document.getElementById('noteContentInput');
    if (!contentInput) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Always create a new line for the list button
    const brElement = document.createElement('br');
    range.insertNode(brElement);
    range.setStartAfter(brElement);
    
    // Insert bullet point
    const bulletText = document.createTextNode('• ');
    range.insertNode(bulletText);
    
    // Move cursor after bullet
    range.setStartAfter(bulletText);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    contentInput.focus();
  }

  // Handle Enter key for list creation
  handleEditorKeyDown(e) {
    if (e.key === 'Enter') {
      const contentInput = document.getElementById('noteContentInput');
      if (!contentInput) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const currentNode = range.startContainer;
      
      // Check if we're on a line that contains a bullet (anywhere on the line)
      if (currentNode.nodeType === Node.TEXT_NODE) {
        const textBeforeCursor = currentNode.textContent.substring(0, range.startOffset);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        
        // Check if the current line contains a bullet anywhere, not just at the start
        if (currentLine.includes('•')) {
          e.preventDefault();
          
          // Create new line first
          const brElement = document.createElement('br');
          range.insertNode(brElement);
          range.setStartAfter(brElement);
          
          // Insert bullet point on the new line
          const bulletText = document.createTextNode('• ');
          range.insertNode(bulletText);
          
          // Move cursor after bullet
          range.setStartAfter(bulletText);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          
          contentInput.focus();
          return; // Exit early to prevent default behavior
        }
      }
      
      // If not in list mode, let default Enter behavior happen
    }
  }



  // Update note preview while typing
  updateNotePreview() {
    // This could be used for real-time preview features
  }

  // Update character count (supports legacy #noteChars and new .char-count)
  updateCharCount() {
    try {
      const contentInput = document.getElementById('noteContentInput');
      const text = contentInput ? (contentInput.textContent || contentInput.innerText || '') : '';
      const count = text.length;
      const idEl = document.getElementById('noteChars');
      if (idEl) idEl.textContent = `${count} characters`;
      const clsEl = document.querySelector('.char-count');
      if (clsEl) {
        clsEl.textContent = `${count} characters`;
        if (count > 8000) clsEl.classList.add('warning'); else clsEl.classList.remove('warning');
      }
    } catch (_) {}
  }

  // Persist editor open flag (and keep existing noteDraft intact)
  async persistEditorOpen(isOpen) {
    try {
      const { editorState } = await chrome.storage.local.get(['editorState']);
      const state = editorState || {};
      state.open = isOpen;
      // Track if editor was ever open for auto-restore on next popup open
      if (isOpen) {
        state.wasEditorOpen = true;
      }
      // Don't clear wasEditorOpen when closing - leave it for auto-restore
      await chrome.storage.local.set({ editorState: state });
    } catch (_) { }
  }

  // Save the current editor draft (title/content/tags) into storage
  async saveEditorDraft() {
    try {
      if (!this.currentNote) {
        console.log('💾 Cannot save draft: no current note');
        return;
      }
      const titleHeader = document.getElementById('noteTitleHeader');
      const contentInput = document.getElementById('noteContentInput');
      const tagsInput = document.getElementById('tagsInput');

      // Update current note with editor values
      this.currentNote.title = (titleHeader && titleHeader.value ? titleHeader.value : '').trim();
      this.currentNote.content = this.htmlToMarkdown(contentInput ? contentInput.innerHTML : '');
      this.currentNote.tags = (tagsInput && tagsInput.value
        ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : []);
      this.currentNote.updatedAt = new Date().toISOString(); // Ensure updatedAt is set

      // Get caret position
      const { start, end } = contentInput ? this.getSelectionOffsets(contentInput) : { start: 0, end: 0 };
      
      const { editorState } = await chrome.storage.local.get(['editorState']);
      const state = editorState || {};
      // Preserve the existing open state - don't force it to true
      state.noteDraft = { ...this.currentNote };
      state.caretStart = start;
      state.caretEnd = end;
      
      console.log('💾 Saving draft:', {
        id: this.currentNote.id,
        title: this.currentNote.title,
        contentLength: this.currentNote.content.length,
        updatedAt: this.currentNote.updatedAt,
        wasEditorOpen: state.wasEditorOpen
      });
      
      await chrome.storage.local.set({ editorState: state });
    } catch (error) { 
      console.error('❌ Failed to save draft:', error);
    }
  }

  // Clear editor state entirely
  async clearEditorState() {
    try {
      await chrome.storage.local.remove('editorState');
    } catch (_) { }
  }

  // Update note preview in the editor
  updateNotePreview() {
    try {
      const titleHeader = document.getElementById('noteTitleHeader');
      const contentInput = document.getElementById('noteContentInput');
      const tagsInput = document.getElementById('tagsInput');
      
      if (!this.currentNote) return;
      
      // Update current note object with editor values for live preview
      this.currentNote.title = (titleHeader && titleHeader.value ? titleHeader.value : '').trim();
      this.currentNote.content = this.htmlToMarkdown(contentInput ? contentInput.innerHTML : '');
      this.currentNote.tags = (tagsInput && tagsInput.value
        ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : []);
      
      // Update any preview elements if they exist
      const previewTitle = document.querySelector('.note-preview-title');
      const previewContent = document.querySelector('.note-preview-content');
      
      if (previewTitle) {
        previewTitle.textContent = this.currentNote.title || 'Untitled';
      }
      if (previewContent) {
        previewContent.textContent = this.currentNote.content || '';
      }
    } catch (_) {}
  }

  // (duplicate removed; see unified updateCharCount above)

  // Utility functions
  debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

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

  // Save and close the editor
  async saveAndClose() {
    try {
      // Save the current note
      if (this.currentNote) {
        await this.saveCurrentNote();
      }
      
      // Close the editor
      this.closeEditor({ clearDraft: true });
    } catch (error) {
      console.error('Error saving and closing:', error);
    }
  }

  // Save the current note
  async saveCurrentNote() {
    try {
      if (!this.currentNote) return;
      
      const titleHeader = document.getElementById('noteTitleHeader');
      const contentInput = document.getElementById('noteContentInput');
      const tagsInput = document.getElementById('tagsInput');
      
      // Update current note with editor values
      this.currentNote.title = (titleHeader && titleHeader.value ? titleHeader.value : '').trim();
      this.currentNote.content = this.htmlToMarkdown(contentInput ? contentInput.innerHTML : '');
      this.currentNote.tags = (tagsInput && tagsInput.value
        ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : []);
      
      // Update timestamp
      this.currentNote.updatedAt = new Date().toISOString();
      
      // Save to storage
      if (window.notesStorage) {
        await window.notesStorage.saveNote(this.currentNote);
      }
      
      // Emit note updated event
      window.eventBus?.emit('notes:updated', { noteId: this.currentNote.id, note: this.currentNote });
      
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }
}

// Export for use in other modules
window.EditorManager = EditorManager;
