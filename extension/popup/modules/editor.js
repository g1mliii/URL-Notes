/**
 * Editor Module - Handles note editing, content management, and editor UI
 */
class EditorManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.currentNote = null;

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

      // Populate content with XSS protection
      if (contentInput) {
        const safeContent = this.buildContentHtml(this.currentNote.content || '');
        if (window.safeDOM) {
          window.safeDOM.setInnerHTML(contentInput, safeContent, true);
        } else {
          // Fallback for safety
          contentInput.textContent = this.currentNote.content || '';
        }
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
        if (window.urlNotesApp && window.urlNotesApp.saveEditorDraft) {
          window.urlNotesApp.saveEditorDraft();
        }
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

      let text = content || '';

      // Convert formatting markers to HTML (process outermost first to handle nesting)
      // Bold: **text** -> <b>text</b> (process first - outermost)
      text = text.replace(/\*\*([^*]*(?:\*(?!\*)[^*]*)*)\*\*/g, '<b>$1</b>');

      // Italics: *text* -> <i>text</i> (avoid conflict with bold)
      text = text.replace(/\*([^*]+)\*/g, '<i>$1</i>');

      // Underline: __text__ -> <u>text</u>
      text = text.replace(/__([^_]*(?:_(?!_)[^_]*)*?)__/g, '<u>$1</u>');

      // Strikethrough: ~~text~~ -> <s>text</s> (process last - innermost)
      text = text.replace(/~~([^~]*(?:~(?!~)[^~]*)*?)~~/g, '<s>$1</s>');

      // Color: {color:#ff0000}text{/color} -> <span style="color:#ff0000">text</span>
      text = text.replace(/\{color:([^}]+)\}([^{]*)\{\/color\}/g, '<span style="color:$1">$2</span>');

      // Citation: {citation}text{/citation} -> <span style="font-style: italic; color: var(--text-secondary)">text</span>
      text = text.replace(/\{citation\}([^{]*)\{\/citation\}/g, '<span style="font-style: italic; color: var(--text-secondary)">$1</span>');

      const lines = text.split(/\r?\n/);
      const mdLink = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
      const htmlLines = lines.map(line => {
        let out = '';
        let lastIndex = 0;
        let match;
        while ((match = mdLink.exec(line)) !== null) {
          // Don't escape the part that might contain our HTML tags
          const beforeLink = line.slice(lastIndex, match.index);
          out += this.escapeHtmlExceptTags(beforeLink);
          const text = escapeHtml(match[1]);
          const href = match[2];
          out += `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
          lastIndex = mdLink.lastIndex;
        }
        const afterLink = line.slice(lastIndex);
        out += this.escapeHtmlExceptTags(afterLink);
        return out;
      });
      return htmlLines.join('<br>');
    } catch (e) {
      return (content || '').replace(/\n/g, '<br>');
    }
  }

  // Helper method to escape HTML but preserve our formatting tags
  escapeHtmlExceptTags(text) {
    // First escape all HTML
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Then unescape our allowed formatting tags
    escaped = escaped
      .replace(/&lt;(\/?(?:b|i|u|s|span[^&]*))&gt;/gi, '<$1>')
      .replace(/&lt;span style=&quot;([^&]*)&quot;&gt;/gi, '<span style="$1">');

    return escaped;
  }

  // Convert limited HTML back to markdown-like plain text for storage
  htmlToMarkdown(html) {
    const tmp = document.createElement('div');
    // Use safe DOM manipulation
    if (window.safeDOM) {
      window.safeDOM.setInnerHTML(tmp, html || '', true);
    } else {
      tmp.innerHTML = html || '';
    }
    // Remove disallowed tags by unwrapping while preserving line breaks.
    // For block elements, insert <br> boundaries to reflect visual line breaks.
    const allowed = new Set(['A', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN']);
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

    // Convert formatting tags to markdown-style markers
    // Process innermost tags first to preserve nested formatting
    // We need to process in reverse document order to handle nested tags correctly

    // Strikethrough tags (process first - innermost)
    tmp.querySelectorAll('s, strike').forEach(el => {
      const innerHTML = el.innerHTML;
      const md = document.createElement('span');
      // Use safe DOM manipulation
      if (window.safeDOM) {
        window.safeDOM.setInnerHTML(md, `~~${innerHTML}~~`, true);
      } else {
        md.innerHTML = `~~${innerHTML}~~`;
      }
      // Replace with the content, not a text node, to preserve nested HTML
      while (md.firstChild) {
        el.parentNode.insertBefore(md.firstChild, el);
      }
      el.remove();
    });

    // Underline tags
    tmp.querySelectorAll('u').forEach(el => {
      const innerHTML = el.innerHTML;
      const md = document.createElement('span');
      // Use safe DOM manipulation
      if (window.safeDOM) {
        window.safeDOM.setInnerHTML(md, `__${innerHTML}__`, true);
      } else {
        md.innerHTML = `__${innerHTML}__`;
      }
      while (md.firstChild) {
        el.parentNode.insertBefore(md.firstChild, el);
      }
      el.remove();
    });

    // Italics tags
    tmp.querySelectorAll('i, em').forEach(el => {
      const innerHTML = el.innerHTML;
      const md = document.createElement('span');
      // Use safe DOM manipulation
      if (window.safeDOM) {
        window.safeDOM.setInnerHTML(md, `*${innerHTML}*`, true);
      } else {
        md.innerHTML = `*${innerHTML}*`;
      }
      while (md.firstChild) {
        el.parentNode.insertBefore(md.firstChild, el);
      }
      el.remove();
    });

    // Bold tags (process last - outermost)
    tmp.querySelectorAll('b, strong').forEach(el => {
      const innerHTML = el.innerHTML;
      const md = document.createElement('span');
      // Use safe DOM manipulation
      if (window.safeDOM) {
        window.safeDOM.setInnerHTML(md, `**${innerHTML}**`, true);
      } else {
        md.innerHTML = `**${innerHTML}**`;
      }
      while (md.firstChild) {
        el.parentNode.insertBefore(md.firstChild, el);
      }
      el.remove();
    });

    // Citation spans (preserve with special formatting) - process BEFORE color spans
    tmp.querySelectorAll('span[style*="font-style: italic"][style*="color"]').forEach(el => {
      const text = el.textContent;
      // Check if this looks like a citation (italic + secondary color)
      const style = el.getAttribute('style');
      if (style.includes('font-style: italic') && style.includes('var(--text-secondary)')) {
        // Mark as citation with special syntax
        const md = document.createTextNode(`{citation}${text}{/citation}`);
        el.replaceWith(md);
      } else {
        // Just unwrap if not a citation
        el.replaceWith(document.createTextNode(text));
      }
    });

    // Color spans (process AFTER citation spans to avoid conflicts)
    tmp.querySelectorAll('span[style*="color"]').forEach(el => {
      const text = el.textContent;
      const style = el.getAttribute('style');
      const colorMatch = style.match(/color:\s*([^;]+)/);
      if (colorMatch) {
        const color = colorMatch[1].trim();
        const md = document.createTextNode(`{color:${color}}${text}{/color}`);
        el.replaceWith(md);
      } else {
        // If no color found, just unwrap
        el.replaceWith(document.createTextNode(text));
      }
    });

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
    // Use safe DOM manipulation for decoding
    if (window.safeDOM) {
      window.safeDOM.setInnerHTML(decode, text, false);
    } else {
      decode.innerHTML = text;
    }
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
    } catch (_) { }
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
      // Use safe HTML insertion
      if (window.safeDOM) {
        window.safeDOM.insertHTML(html, true);
      } else {
        this.insertHtmlAtCaret(html);
      }
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
    // Use safe DOM insertion if available
    if (window.safeDOM) {
      window.safeDOM.insertHTML(html, true);
      return;
    }

    // Fallback implementation with basic sanitization
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
      e.stopPropagation(); // Prevent contenteditable from handling the click
      const href = target.getAttribute('href');
      const text = target.textContent || '';
      // Need to call the main app's openLinkAndHighlight method
      if (window.urlNotesApp && window.urlNotesApp.openLinkAndHighlight) {
        window.urlNotesApp.openLinkAndHighlight(href, text);
      }
      return false; // Additional prevention of event propagation
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
    } catch (_) { }
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
    } catch (_) { }
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
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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

  // Generate citation in specified format
  generateCitation(format) {
    // Try to get current note from multiple sources
    let note = this.currentNote;

    // If no current note in editor, try to get it from the main popup instance
    if (!note && window.urlNotesApp && window.urlNotesApp.currentNote) {
      note = window.urlNotesApp.currentNote;
    }

    // If still no note, try to get it from the current site context
    if (!note && window.urlNotesApp && window.urlNotesApp.currentSite) {
      const currentSite = window.urlNotesApp.currentSite;
      note = {
        title: 'Untitled Note',
        url: currentSite.url || '',
        pageTitle: currentSite.title || 'Unknown Page',
        domain: currentSite.domain || 'Unknown Domain',
        createdAt: new Date().toISOString()
      };
    }

    // Last resort: try to get site info from DOM elements
    if (!note) {
      const domainEl = document.getElementById('siteDomain');
      const urlEl = document.getElementById('siteUrl');
      if (domainEl && urlEl) {
        const domain = domainEl.textContent || 'Unknown Domain';
        const url = urlEl.textContent || '';
        note = {
          title: 'Untitled Note',
          url: url,
          pageTitle: document.title || 'Unknown Page',
          domain: domain,
          createdAt: new Date().toISOString()
        };
      }
    }

    if (!note) {
      console.warn('No current note or site context available for citation generation');
      return '';
    }



    // Get note properties with fallbacks
    const title = note.title || 'Untitled Note';
    const url = note.url || '';
    const pageTitle = note.pageTitle || note.title || 'Unknown Page';
    const domain = note.domain || 'Unknown Domain';

    // Handle date creation with fallbacks
    let createdAt;
    try {
      createdAt = note.createdAt ? new Date(note.createdAt) : new Date();
      if (isNaN(createdAt.getTime())) {
        createdAt = new Date();
      }
    } catch (error) {
      console.warn('Invalid date, using current date:', error);
      createdAt = new Date();
    }

    const year = createdAt.getFullYear();
    const month = createdAt.getMonth();
    const day = createdAt.getDate();

    // Format date components
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[month];

    // Generate citation based on format
    let citation = '';
    switch (format) {
      case 'apa':
        // APA 7th Edition format
        citation = `${pageTitle ? `${pageTitle}. ` : ''}(${year}, ${monthName} ${day}). ${title}. Retrieved from ${url}`;
        break;

      case 'mla':
        // MLA 9th Edition format  
        citation = `"${pageTitle}." ${domain}, ${day} ${monthName} ${year}, ${url}.`;
        break;

      case 'chicago':
        // Chicago Manual of Style format
        citation = `"${pageTitle}." ${domain}. Accessed ${monthName} ${day}, ${year}. ${url}.`;
        break;

      case 'harvard':
        // Harvard referencing format
        citation = `${pageTitle} (${year}) ${domain}, viewed ${day} ${monthName} ${year}, <${url}>.`;
        break;

      case 'ieee':
        // IEEE format
        citation = `"${pageTitle}," ${domain}, ${monthName} ${day}, ${year}. [Online]. Available: ${url}`;
        break;

      default:
        citation = `${pageTitle} - ${url} (accessed ${monthName} ${day}, ${year})`;
    }


    return citation;
  }

  // Handle citation button click
  toggleCitationDropdown() {
    const dropdown = document.getElementById('citationDropdown');
    if (!dropdown) return;

    const isVisible = dropdown.style.display !== 'none' && dropdown.classList.contains('show');

    if (isVisible) {
      this.hideCitationDropdown();
    } else {
      this.showCitationDropdown();
    }
  }

  // Show citation dropdown
  showCitationDropdown() {
    const dropdown = document.getElementById('citationDropdown');
    const citationBtn = document.getElementById('citationBtn');
    if (!dropdown || !citationBtn) return;

    // Hide other dropdowns first
    const colorWheelPopup = document.getElementById('colorWheelPopup');
    if (colorWheelPopup) colorWheelPopup.style.display = 'none';

    // Move popup to body to escape editor stacking context (same as color picker)
    if (dropdown.parentNode !== document.body) {
      document.body.appendChild(dropdown);
    }

    // Position the popup relative to the button (same logic as color picker)
    const buttonRect = citationBtn.getBoundingClientRect();
    const popupWidth = 180;
    const popupHeight = 200;

    // Calculate position (below and to the right of button, but keep on screen)
    let left = buttonRect.left;
    let top = buttonRect.bottom + 5;

    // Adjust if popup would go off screen
    if (left + popupWidth > window.innerWidth) {
      left = buttonRect.right - popupWidth;
    }
    if (top + popupHeight > window.innerHeight) {
      top = buttonRect.top - popupHeight - 5;
    }

    // Ensure minimum distance from edges
    left = Math.max(10, left);
    top = Math.max(10, top);

    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
    dropdown.style.display = 'block';
    dropdown.classList.add('show');

    // Add overlay to close when clicking outside
    const overlay = document.createElement('div');
    overlay.className = 'citation-dropdown-overlay';
    overlay.onclick = () => this.hideCitationDropdown();
    document.body.appendChild(overlay);
  }

  // Hide citation dropdown
  hideCitationDropdown() {
    const dropdown = document.getElementById('citationDropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
      dropdown.classList.remove('show');

      // Move dropdown back to its original container if it was moved to body
      const originalContainer = document.querySelector('.citation-container');
      if (originalContainer && dropdown.parentNode === document.body) {
        originalContainer.appendChild(dropdown);
      }
    }

    // Remove overlay
    const overlay = document.querySelector('.citation-dropdown-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // Handle citation format selection
  async handleCitationFormat(format) {
    try {


      // Try to get current note from multiple sources
      let note = this.currentNote;
      if (!note && window.urlNotesApp && window.urlNotesApp.currentNote) {
        note = window.urlNotesApp.currentNote;
      }
      if (!note && window.urlNotesApp && window.urlNotesApp.currentSite) {
        note = window.urlNotesApp.currentSite;
      }



      const citation = this.generateCitation(format);

      if (!citation) {
        console.error('Citation generation failed - empty result');
        this.showToast('Unable to generate citation - no note data available', 'error');
        return;
      }

      // Insert citation into editor
      this.insertCitationIntoEditor(citation);

      // Copy to clipboard
      await this.copyCitationToClipboard(citation);

      // Hide dropdown
      this.hideCitationDropdown();

      // Show success toast
      const formatNames = {
        'apa': 'APA',
        'mla': 'MLA',
        'chicago': 'Chicago',
        'harvard': 'Harvard',
        'ieee': 'IEEE'
      };

      this.showToast(`${formatNames[format]} citation added to note and copied to clipboard`, 'success');

    } catch (error) {
      console.error('Error handling citation:', error);
      this.showToast('Failed to generate citation', 'error');
    }
  }

  // Insert citation into the editor at cursor position
  insertCitationIntoEditor(citation) {
    const contentInput = document.getElementById('noteContentInput');
    if (!contentInput) return;

    contentInput.focus();

    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
      // No selection, append to end
      const brElement = document.createElement('br');
      contentInput.appendChild(brElement);

      const citationElement = document.createElement('span');
      citationElement.textContent = citation;
      citationElement.style.fontStyle = 'italic';
      citationElement.style.color = 'var(--text-secondary)';
      contentInput.appendChild(citationElement);

      // Move cursor after citation
      const range = document.createRange();
      range.setStartAfter(citationElement);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Insert at current cursor position
      const range = selection.getRangeAt(0);

      // Create citation element
      const citationElement = document.createElement('span');
      citationElement.textContent = citation;
      citationElement.style.fontStyle = 'italic';
      citationElement.style.color = 'var(--text-secondary)';

      // Insert citation at current position
      range.insertNode(citationElement);

      // Add line break after citation
      const brElement = document.createElement('br');
      range.setStartAfter(citationElement);
      range.insertNode(brElement);

      // Move cursor after the line break
      range.setStartAfter(brElement);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Update character count
    this.updateCharCount();
  }

  // Copy citation to clipboard
  async copyCitationToClipboard(citation) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(citation);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = citation;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Don't throw error as citation was still inserted
    }
  }

  // Show toast notification (utility function)
  showToast(message, type = 'info') {
    try {
      // Try to use existing toast functionality
      if (window.urlNotesApp && window.urlNotesApp.showToast) {
        window.urlNotesApp.showToast(message, type);
        return;
      }

      // Fallback toast implementation
      let toast = document.getElementById('toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
      }

      toast.textContent = message;
      toast.className = `toast ${type} show`;

      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);

    } catch (error) {
      console.error('Error showing toast:', error);
    }
  }

  // Initialize formatting toolbar event listeners
  initializeFormattingControls() {
    // Bold button
    const boldBtn = document.getElementById('boldBtn');
    if (boldBtn) {
      boldBtn.addEventListener('click', () => this.toggleFormat('bold'));
    }

    // Italics button
    const italicsBtn = document.getElementById('italicsBtn');
    if (italicsBtn) {
      italicsBtn.addEventListener('click', () => this.toggleFormat('italic'));
    }

    // Underline button  
    const underlineBtn = document.getElementById('underlineBtn');
    if (underlineBtn) {
      underlineBtn.addEventListener('click', () => this.toggleFormat('underline'));
    }

    // Strikethrough button
    const strikethroughBtn = document.getElementById('strikethroughBtn');
    if (strikethroughBtn) {
      strikethroughBtn.addEventListener('click', () => this.toggleFormat('strikeThrough'));
    }

    // List button (handled by main popup.js but we ensure it exists)
    const listBtn = document.getElementById('listBtn');
    if (listBtn && !listBtn.onclick) {
      // Backup handler in case main popup.js hasn't set it up yet
      listBtn.addEventListener('click', () => this.createList());
    }

    // Color button
    const colorBtn = document.getElementById('colorBtn');
    let colorWheelPopup = document.getElementById('colorWheelPopup');
    if (colorBtn && colorWheelPopup) {
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = colorWheelPopup.style.display !== 'none';

        if (isVisible) {
          colorWheelPopup.style.display = 'none';
        } else {
          // Move popup to body to escape editor stacking context
          if (colorWheelPopup.parentNode !== document.body) {
            document.body.appendChild(colorWheelPopup);
          }

          // Position the popup relative to the button
          const buttonRect = colorBtn.getBoundingClientRect();
          const popupWidth = 140;
          const popupHeight = 80;

          // Calculate position (below and to the right of button, but keep on screen)
          let left = buttonRect.left;
          let top = buttonRect.bottom + 5;

          // Adjust if popup would go off screen
          if (left + popupWidth > window.innerWidth) {
            left = buttonRect.right - popupWidth;
          }
          if (top + popupHeight > window.innerHeight) {
            top = buttonRect.top - popupHeight - 5;
          }

          // Ensure minimum distance from edges
          left = Math.max(10, left);
          top = Math.max(10, top);

          colorWheelPopup.style.left = `${left}px`;
          colorWheelPopup.style.top = `${top}px`;
          colorWheelPopup.style.display = 'block';
        }
      });

      // No color presets - removed for simplified interface

      // Custom color picker
      const customColorInput = document.getElementById('customColorInput');
      if (customColorInput) {
        customColorInput.addEventListener('change', (e) => {
          this.applyColor(e.target.value);
          colorWheelPopup.style.display = 'none';
        });
      }
    }

    // Close color picker when clicking outside
    document.addEventListener('click', (e) => {
      if (colorWheelPopup && !e.target.closest('.color-picker-container')) {
        colorWheelPopup.style.display = 'none';
      }

      // Close citation dropdown when clicking outside
      if (citationDropdown && !e.target.closest('.citation-container')) {
        this.hideCitationDropdown();
      }
    });

    // Close color picker when editor is closed
    window.addEventListener('pagehide', () => {
      if (colorWheelPopup) {
        colorWheelPopup.style.display = 'none';
      }

      // Close citation dropdown when editor is closed
      if (citationDropdown) {
        this.hideCitationDropdown();
      }
    });

    // Citation button and dropdown
    const citationBtn = document.getElementById('citationBtn');
    const citationDropdown = document.getElementById('citationDropdown');

    if (citationBtn) {
      citationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCitationDropdown();
      });
    }

    if (citationDropdown) {
      // Handle citation format button clicks
      citationDropdown.addEventListener('click', (e) => {
        const formatBtn = e.target.closest('.citation-format-btn');
        if (formatBtn) {
          e.stopPropagation();
          const format = formatBtn.dataset.format;
          this.handleCitationFormat(format);
        }
      });
    }

    // Update button states on selection change
    const contentInput = document.getElementById('noteContentInput');
    if (contentInput) {
      contentInput.addEventListener('selectionchange', () => this.updateFormatButtonStates());
      contentInput.addEventListener('keyup', () => this.updateFormatButtonStates());
      contentInput.addEventListener('mouseup', () => this.updateFormatButtonStates());
    }
  }

  // Toggle formatting (bold, underline, strikethrough)
  toggleFormat(command) {
    const contentInput = document.getElementById('noteContentInput');
    if (!contentInput) return;

    contentInput.focus();

    try {
      document.execCommand(command, false, null);
      this.updateFormatButtonStates();
    } catch (error) {
      console.error(`Error applying ${command}:`, error);
    }
  }

  // Apply color to selected text
  applyColor(color) {
    const contentInput = document.getElementById('noteContentInput');
    if (!contentInput) return;

    contentInput.focus();

    try {
      document.execCommand('foreColor', false, color);

      // Update color indicator
      const colorIndicator = document.getElementById('colorIndicator');
      if (colorIndicator) {
        colorIndicator.style.backgroundColor = color;
      }

      this.updateFormatButtonStates();
    } catch (error) {
      console.error('Error applying color:', error);
    }
  }

  // Update button active states based on current selection
  updateFormatButtonStates() {
    try {
      const boldBtn = document.getElementById('boldBtn');
      const italicsBtn = document.getElementById('italicsBtn');
      const underlineBtn = document.getElementById('underlineBtn');
      const strikethroughBtn = document.getElementById('strikethroughBtn');

      if (boldBtn) {
        boldBtn.classList.toggle('active', document.queryCommandState('bold'));
      }
      if (italicsBtn) {
        italicsBtn.classList.toggle('active', document.queryCommandState('italic'));
      }
      if (underlineBtn) {
        underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
      }
      if (strikethroughBtn) {
        strikethroughBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));
      }
    } catch (error) {
      // Some browsers may not support queryCommandState for all commands
    }
  }
}

// Export for use in other modules
window.EditorManager = EditorManager;
