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
    const newNote = {
      id: this.generateId(),
      title: '',
      content: '',
      tags: [],
      domain: currentSite.domain,
      url: currentSite.url,
      pageTitle: currentSite.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.currentNote = newNote;
    this.openEditor();
    return newNote;
  }

  // Open existing note
  openNote(note) {
    this.currentNote = { ...note };
    this.openEditor();
  }

  // Open the note editor
  openEditor(focusContent = false) {
    const editor = document.getElementById('noteEditor');
    const titleHeader = document.getElementById('noteTitleHeader');
    const contentInput = document.getElementById('noteContentInput');
    const tagsInput = document.getElementById('tagsInput');
    const dateSpan = document.getElementById('noteDate');
    const aiRewriteBtn = document.getElementById('aiRewriteBtn');

    // Populate editor with note data
    titleHeader.value = this.currentNote.title;
    // Render markdown/plain text to HTML for the contenteditable editor
    contentInput.innerHTML = this.buildContentHtml(this.currentNote.content);
    tagsInput.value = this.currentNote.tags.join(', ');
    // Do not show created date inside the editor UI to avoid mid-editor clutter
    if (dateSpan) {
      dateSpan.textContent = '';
    }

    // Toggle premium-only controls (AI button) based on app premium status
    try {
      const isPremium = !!(window.urlNotesApp && window.urlNotesApp.premiumStatus && window.urlNotesApp.premiumStatus.isPremium);
      if (aiRewriteBtn) aiRewriteBtn.style.display = isPremium ? 'flex' : 'none';
    } catch (_) {}

    // Show editor with animation and persistent open state
    editor.style.display = 'flex';
    editor.classList.add('open', 'slide-in', 'editor-fade-in');
    // Mark editor as open and persist current draft immediately
    this.persistEditorOpen(true);
    this.saveEditorDraft();
    // Wire up live events for typing/paste to keep counter and draft in sync
    try {
      if (contentInput) {
        contentInput.addEventListener('input', () => {
          this.updateCharCount();
          this.saveDraftDebounced();
        });
        contentInput.addEventListener('paste', (e) => this.handleEditorPaste(e));
        contentInput.addEventListener('click', (e) => this.handleEditorLinkClick(e));
        // Initialize count for existing content
        this.updateCharCount();
      }
      if (titleHeader) {
        titleHeader.addEventListener('input', () => this.saveDraftDebounced());
      }
      if (tagsInput) {
        tagsInput.addEventListener('input', () => this.saveDraftDebounced());
      }
    } catch (_) {}
    
    // Focus content area after animation completes if requested
    if (focusContent) {
      setTimeout(() => {
        try {
          contentInput.focus();
        } catch (_) {}
      }, 280);
    }
    
    // Restore caret position from cached draft if available
    setTimeout(() => {
      try {
        chrome.storage.local.get(['editorState']).then(({ editorState }) => {
          if (!editorState || !editorState.noteDraft) return;
          const d = editorState.noteDraft;
          if (d.id === this.currentNote.id && typeof d.caretStart === 'number' && typeof d.caretEnd === 'number') {
            // Ensure content area is focused before restoring selection
            contentInput.focus();
            this.setSelectionOffsets(contentInput, d.caretStart, d.caretEnd);
          }
        }).catch(() => {});
      } catch (_) {}
    }, 120);
    
    this.updateCharCount();
  }

  // Close the note editor
  closeEditor(options = { clearDraft: false }) {
    const editor = document.getElementById('noteEditor');
    editor.classList.add('slide-out');
    
    setTimeout(() => {
      editor.style.display = 'none';
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
      await chrome.storage.local.set({ editorState: state });
    } catch (_) { }
  }

  // Save the current editor draft (title/content/tags) into storage
  async saveEditorDraft() {
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

      // Get caret position
      const { start, end } = contentInput ? this.getSelectionOffsets(contentInput) : { start: 0, end: 0 };
      
      const state = {
        open: true,
        noteDraft: { ...this.currentNote },
        caretStart: start,
        caretEnd: end
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
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

// Export for use in other modules
window.EditorManager = EditorManager;
