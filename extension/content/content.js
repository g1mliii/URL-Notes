// URL Notes Extension - Content Script
// This script runs on every webpage to detect page information

(function () {
  'use strict';

  // Multi-highlight state
  let multiHighlightMode = false;
  let highlights = [];
  let highlightToolbar = null;
  let isSelecting = false;
  let selectionStart = null;

  // Get current page information
  function getCurrentPageInfo() {
    return {
      domain: window.location.hostname,
      url: window.location.href,
      title: document.title,
      favicon: getFaviconUrl()
    };
  }

  // Extract favicon URL
  function getFaviconUrl() {
    // Try to find favicon link elements
    const faviconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]'
    ];

    for (const selector of faviconSelectors) {
      const link = document.querySelector(selector);
      if (link && link.href) {
        return link.href;
      }
    }

    // Fallback to default favicon path
    return `${window.location.protocol}//${window.location.hostname}/favicon.ico`;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.action === 'getPageInfo') {
        const pageInfo = getCurrentPageInfo();
        sendResponse(pageInfo);
        return false; // No async response needed
      }

      // Check if content script is ready
      if (request.action === 'ping') {
        sendResponse({ status: 'ready', timestamp: Date.now() });
        return false; // No async response needed
      }

      // Highlight requested text on the page
      if (request.action === 'highlightText') {
        const fragText = extractTextFragment(request.href || '');
        const text = (fragText || request.text || '').trim();
        if (text) {
          scheduleHighlightAttempts(text);
          sendResponse({ success: true, text: text });
        } else {
          sendResponse({ success: false, error: 'No text to highlight' });
        }
        return false;
      }

      // Toggle multi-highlight mode
      if (request.action === 'toggleMultiHighlight') {
        try {
          toggleMultiHighlightMode();
          const response = { enabled: multiHighlightMode };
          sendResponse(response);
        } catch (error) {
          sendResponse({ enabled: false, error: error.message });
        }
        return true; // Keep message channel open for async response
      }

      // Get current multi-highlight state
      if (request.action === 'getMultiHighlightState') {
        try {
          const response = {
            enabled: multiHighlightMode,
            highlightCount: highlights.length
          };
          sendResponse(response);
        } catch (error) {
          sendResponse({ enabled: false, highlightCount: 0, error: error.message });
        }
        return false; // No async response needed
      }

      // Extract page content for AI summarization
      if (request.action === 'extractPageContent') {
        try {
          const content = extractPageContent();
          sendResponse({ success: true, content });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true; // Keep message channel open for async response
      }

      // Unknown action
      sendResponse({ error: 'Unknown action' });
      return false;
    } catch (error) {
      sendResponse({ error: error.message });
      return false;
    }
  });

  // Toggle multi-highlight mode
  function toggleMultiHighlightMode() {
    multiHighlightMode = !multiHighlightMode;

    if (multiHighlightMode) {
      enableMultiHighlightMode();
    } else {
      disableMultiHighlightMode();
    }

    // Update extension badge
    updateExtensionBadge();
  }

  // Enable multi-highlight mode
  function enableMultiHighlightMode() {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    // Add visual indicator
    document.body.style.cursor = 'crosshair';

    // Add visual overlay indicator
    addMultiHighlightIndicator();

    // Show floating toolbar
    showHighlightToolbar();
  }

  // Disable multi-highlight mode
  function disableMultiHighlightMode() {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleKeyDown);

    // Remove visual indicator
    document.body.style.cursor = '';

    // Remove visual overlay indicator
    removeMultiHighlightIndicator();

    // Hide floating toolbar
    hideHighlightToolbar();
  }

  // Handle mouse down for text selection
  function handleMouseDown(e) {
    if (!multiHighlightMode || e.button !== 0) return; // Only left click

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      selectionStart = {
        node: range.startContainer,
        offset: range.startOffset
      };
      isSelecting = true;
    }
  }

  // Handle mouse up for text selection
  function handleMouseUp(e) {
    if (!multiHighlightMode || !isSelecting) return;

    isSelecting = false;

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();

      if (selectedText && selectedText.length > 0) {
        // Validate range before proceeding
        try {
          // Check if range is valid and contains text nodes
          const contents = range.cloneContents();
          if (!contents.textContent || contents.textContent.trim().length === 0) {
            return;
          }

          // Check if range boundaries are valid
          if (!range.startContainer || !range.endContainer) {
            return;
          }

          // Allow cross-element selections but skip problematic elements
          // Only skip if selection includes script, style, or other non-content elements
          const rangeContainer = range.commonAncestorContainer;
          const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED'];

          // Check if the range contains any problematic elements
          if (rangeContainer.nodeType === Node.ELEMENT_NODE) {
            const hasProblematicElements = skipTags.some(tag =>
              rangeContainer.tagName === tag || rangeContainer.querySelector(tag)
            );
            if (hasProblematicElements) {
              return;
            }
          }

          // Additional safety check: ensure we have meaningful text content
          if (selectedText.length < 2) {
            return;
          }

          addHighlight(range, selectedText);
        } catch (error) {
          // Invalid range for highlighting - silently handled
        }
      }
    }

    selectionStart = null;
  }

  // Handle keyboard shortcuts
  function handleKeyDown(e) {
    if (!multiHighlightMode) return;

    // Escape to exit mode
    if (e.key === 'Escape') {
      toggleMultiHighlightMode();
      e.preventDefault();
    }

    // Ctrl+Enter to add all highlights to note
    if (e.ctrlKey && e.key === 'Enter') {
      addAllHighlightsToNote();
      e.preventDefault();
    }

    // Ctrl+Shift+H to toggle multi-highlight mode
    if (e.ctrlKey && e.shiftKey && e.key === 'H') {
      toggleMultiHighlightMode();
      e.preventDefault();
    }
  }

  // Add a new highlight
  function addHighlight(range, text) {
    if (text.length < 3) return; // Skip very short selections

    // Check if this exact text is already highlighted at the same location
    // We allow the same text to be highlighted multiple times if it's in different locations
    const existingIndex = highlights.findIndex(h => {
      // Check if text matches AND if the range overlaps significantly
      if (h.text !== text) return false;

      try {
        // Check if ranges overlap by comparing their boundaries
        const hRange = h.range;
        if (!hRange || !range) return false;

        // If ranges are at the same position, consider it a duplicate
        if (hRange.startContainer === range.startContainer &&
          hRange.startOffset === range.startOffset &&
          hRange.endContainer === range.endContainer &&
          hRange.endOffset === range.endOffset) {
          return true;
        }

        // If ranges overlap significantly, consider it a duplicate
        const hStart = hRange.startOffset;
        const hEnd = hRange.endOffset;
        const newStart = range.startOffset;
        const newEnd = range.endOffset;

        // Check if ranges overlap (simplified overlap detection)
        if (hRange.startContainer === range.startContainer &&
          hRange.endContainer === range.endContainer) {
          const overlap = Math.min(hEnd, newEnd) - Math.max(hStart, newStart);
          if (overlap > 0) {
            // If overlap is more than 50% of either range, consider it a duplicate
            const hLength = hEnd - hStart;
            const newLength = newEnd - newStart;
            if (overlap > hLength * 0.5 || overlap > newLength * 0.5) {
              return true;
            }
          }
        }

        return false;
      } catch (error) {
        return false;
      }
    });

    if (existingIndex !== -1) {
      return;
    }

    // Check if the range contains or is within existing highlights
    try {
      const startNode = range.startContainer;
      const endNode = range.endContainer;

      // Check if we're trying to highlight within an existing highlight
      if (startNode.nodeType === Node.ELEMENT_NODE &&
        startNode.hasAttribute('data-url-notes-highlight')) {
        return;
      }

      if (endNode.nodeType === Node.ELEMENT_NODE &&
        endNode.hasAttribute('data-url-notes-highlight')) {
        return;
      }

      // Check if any parent nodes are highlights
      let parent = startNode.parentNode;
      while (parent && parent !== document.body) {
        if (parent.hasAttribute && parent.hasAttribute('data-url-notes-highlight')) {
          return;
        }
        parent = parent.parentNode;
      }

      // Check if the selection is too close to existing highlights
      const existingHighlights = document.querySelectorAll('[data-url-notes-highlight]');
      for (const existing of existingHighlights) {
        try {
          const existingRect = existing.getBoundingClientRect();
          const selectionRect = range.getBoundingClientRect();

          // If highlights are very close to each other (within 5px), skip this one
          if (Math.abs(existingRect.left - selectionRect.left) < 5 &&
            Math.abs(existingRect.top - selectionRect.top) < 5) {
            return;
          }
        } catch (error) {
          // Ignore errors in proximity checking
        }
      }
    } catch (error) {
      return;
    }

    // Create highlight object
    const highlight = {
      id: Date.now() + Math.random(),
      text: text,
      range: range.cloneRange(),
      element: null,
      timestamp: Date.now()
    };

    // Create visual highlight element
    let highlightElement = null;

    try {
      // Check if range is valid and can be wrapped
      if (!range || range.collapsed) {
        return;
      }

      // Try to wrap the range contents, but handle cases where it might fail
      try {
        // First, try the standard approach with better range validation
        const mark = document.createElement('mark');
        mark.setAttribute('data-url-notes-highlight', '');
        mark.setAttribute('data-highlight-id', highlight.id);
        mark.style.backgroundColor = '#ffeb3b';
        mark.style.padding = '2px 4px';
        mark.style.borderRadius = '3px';
        mark.style.boxShadow = '0 0 0 2px rgba(255,235,59,0.35)';
        mark.style.cursor = 'pointer';

        // Add click to remove functionality
        mark.addEventListener('click', () => {
          const index = highlights.findIndex(h => h.id === highlight.id);
          if (index !== -1) {
            removeHighlight(index);
          }
        });

        // Validate range before attempting to wrap
        if (range.startContainer.nodeType === Node.TEXT_NODE &&
          range.endContainer.nodeType === Node.TEXT_NODE &&
          range.startContainer.parentNode === range.endContainer.parentNode) {
          // Simple case: same text node, can wrap safely
          range.surroundContents(mark);
          highlightElement = mark;
        } else {
          // Complex case: range crosses element boundaries
          throw new Error('Range crosses element boundaries');
        }

      } catch (wrapError) {
        // Standard wrap failed, trying alternative approach

        // For complex selections, use a simpler approach that doesn't manipulate the original content
        try {

          // Create a simple span element with the text content
          const span = document.createElement('span');
          span.setAttribute('data-url-notes-highlight', '');
          span.setAttribute('data-highlight-id', highlight.id);
          span.style.backgroundColor = '#ffeb3b';
          span.style.padding = '2px 4px';
          span.style.borderRadius = '3px';
          span.style.boxShadow = '0 0 0 2px rgba(255,235,59,0.35)';
          span.style.cursor = 'pointer';
          span.textContent = text;
          span.addEventListener('click', () => {
            const index = highlights.findIndex(h => h.id === highlight.id);
            if (index !== -1) {
              removeHighlight(index);
            }
          });

          // Insert the span at the start of the selection
          range.collapse(true);
          range.insertNode(span);

          highlightElement = span;

        } catch (simpleError) {
          return; // Give up on this highlight
        }
      }

      // If we successfully created a highlight element, add it to the highlights array
      if (highlightElement) {
        highlight.element = highlightElement;
        highlights.push(highlight);
        updateHighlightToolbar();
      }

    } catch (error) {
      // Don't add to highlights array if visual creation failed
    }
  }

  // Remove a highlight
  function removeHighlight(index) {
    if (index < 0 || index >= highlights.length) return;

    const highlight = highlights[index];

    // Remove visual element
    if (highlight.element && highlight.element.parentNode) {
      const parent = highlight.element.parentNode;
      while (highlight.element.firstChild) {
        parent.insertBefore(highlight.element.firstChild, highlight.element);
      }
      parent.removeChild(highlight.element);
      parent.normalize();
    }

    // Remove from array
    highlights.splice(index, 1);

    // Update toolbar
    updateHighlightToolbar();
  }

  // Clear all highlights
  function clearAllHighlights() {
    const count = highlights.length;
    highlights.forEach(highlight => {
      if (highlight.element && highlight.element.parentNode) {
        const parent = highlight.element.parentNode;
        while (highlight.element.firstChild) {
          parent.insertBefore(highlight.element.firstChild, highlight.element);
        }
        parent.removeChild(highlight.element);
        parent.normalize();
      }
    });

    highlights = [];
    updateHighlightToolbar();
  }

  // Show floating toolbar
  function showHighlightToolbar() {
    if (highlightToolbar) return;

    highlightToolbar = document.createElement('div');
    highlightToolbar.id = 'url-notes-highlight-toolbar';
    highlightToolbar.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2c3e50;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      min-width: 200px;
      backdrop-filter: blur(10px);
    `;

    updateHighlightToolbar();
    document.body.appendChild(highlightToolbar);
  }

  // Hide floating toolbar
  function hideHighlightToolbar() {
    if (highlightToolbar && highlightToolbar.parentNode) {
      highlightToolbar.parentNode.removeChild(highlightToolbar);
      highlightToolbar = null;
    }
  }

  // Update toolbar content
  function updateHighlightToolbar() {
    if (!highlightToolbar) return;

    const count = highlights.length;

    highlightToolbar.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
        <span>📝 Multi-Highlight Mode</span>
        <button id="exit-highlight-mode" style="background: #e74c3c; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Exit</button>
      </div>
      <div style="margin-bottom: 12px; color: #bdc3c7;">
        ${count} highlight${count !== 1 ? 's' : ''} selected
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="add-highlights-to-note" style="background: #3498db; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; flex: 1; ${count === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">Add to Note</button>
        <button id="clear-all-highlights" style="background: #95a5a6; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; ${count === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">Clear All</button>
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: #bdc3c7;">
        <div>• Click and drag to highlight text</div>
        <div>• Click highlight to remove</div>
        <div>• Ctrl+Enter to add all to note</div>
        <div>• Ctrl+Shift+H or Escape to exit mode</div>
      </div>
    `;

    // Add event listeners
    const exitBtn = highlightToolbar.querySelector('#exit-highlight-mode');
    const addBtn = highlightToolbar.querySelector('#add-highlights-to-note');
    const clearBtn = highlightToolbar.querySelector('#clear-all-highlights');

    exitBtn.addEventListener('click', toggleMultiHighlightMode);
    addBtn.addEventListener('click', () => {
      addAllHighlightsToNote();
    });
    clearBtn.addEventListener('click', clearAllHighlights);

    // Disable buttons if no highlights
    if (count === 0) {
      addBtn.disabled = true;
      clearBtn.disabled = true;
    }
  }

  // Add all highlights to a note
  function addAllHighlightsToNote() {

    if (highlights.length === 0) {
      return;
    }

    const pageInfo = getCurrentPageInfo();
    const highlightData = highlights.map(h => ({
      text: h.text,
      timestamp: h.timestamp
    }));

    // Send message to background script to create note

    // First check if background script is responsive
    chrome.runtime.sendMessage({ action: 'ping' }, (pingResponse) => {
      if (chrome.runtime.lastError) {
        return;
      }

      // Add a timeout to the message sending
      const messageTimeout = setTimeout(() => {
        // Message timeout - background script may not be responding
      }, 5000);

      chrome.runtime.sendMessage({
        action: 'addHighlightsToNote',
        pageInfo: pageInfo,
        highlights: highlightData
      }, (response) => {
        clearTimeout(messageTimeout);

        // Handle response using callback to avoid message channel issues
        if (chrome.runtime.lastError) {
          return;
        }

        if (response && response.success) {
          // Clear highlights after adding to note
          clearAllHighlights();
          // Exit multi-highlight mode
          toggleMultiHighlightMode();
        }
      });
    });
  }

  // Update extension badge
  function updateExtensionBadge() {
    if (multiHighlightMode) {
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        text: highlights.length.toString(),
        color: '#3498db'
      }, () => {
        if (chrome.runtime.lastError) {
          // Badge update error - silently handled
        }
      });
    } else {
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        text: '',
        color: ''
      }, () => {
        if (chrome.runtime.lastError) {
          // Badge update error - silently handled
        }
      });
    }
  }

  // Add visual indicator overlay
  function addMultiHighlightIndicator() {
    if (document.getElementById('multi-highlight-indicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'multi-highlight-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #3b82f6, #10b981, #f59e0b, #ef4444);
      z-index: 9999;
      animation: multi-highlight-pulse 2s ease-in-out infinite;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes multi-highlight-pulse {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(indicator);
  }

  // Remove visual indicator overlay
  function removeMultiHighlightIndicator() {
    const indicator = document.getElementById('multi-highlight-indicator');
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }

  // Safe message sender to avoid "Extension context invalidated" errors
  function safeSendMessage(message) {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return;
      const maybePromise = chrome.runtime.sendMessage(message);
      // In MV3 this returns a promise; attach a no-op catch
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(() => { });
      }
    } catch (_) {
      // Swallow errors when context is gone (navigation/reload)
    }
  }

  // Notify background script that content script is ready
  safeSendMessage({
    action: 'contentScriptReady',
    pageInfo: getCurrentPageInfo()
  });

  // Also notify that we're ready for multi-highlight messages

  // Monitor for URL changes (for SPAs)
  let currentUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      safeSendMessage({
        action: 'urlChanged',
        pageInfo: getCurrentPageInfo()
      });
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Clean up observer when page hides (better for back/forward cache)
  window.addEventListener('pagehide', () => {
    observer.disconnect();
  });

  // ===== Highlight helpers =====
  function clearUrlNotesHighlights() {
    const marks = document.querySelectorAll('mark[data-url-notes-highlight]');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
    const styleTag = document.getElementById('url-notes-highlight-style');
    if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
  }

  function injectHighlightStyle() {
    if (document.getElementById('url-notes-highlight-style')) return;
    const style = document.createElement('style');
    style.id = 'url-notes-highlight-style';
    style.textContent = `
      mark[data-url-notes-highlight] {
        background: #ffeb3b99;
        padding: 0 .1em;
        border-radius: 2px;
        box-shadow: 0 0 0 2px rgba(255,235,59,0.35);
      }
    `;
    document.documentElement.appendChild(style);
  }

  // Try to highlight text with retries to handle late-loading content (SPAs, async renders)
  function scheduleHighlightAttempts(text) {
    try { clearUrlNotesHighlights(); } catch { }
    const candidates = buildCandidateTexts(text);
    const attempts = [0, 150, 350, 700, 1200, 2000, 3000];
    let done = false;

    const tryNow = () => {
      if (done) return true;
      for (const cand of candidates) {
        if (highlightFirstOccurrence(cand) || highlightFirstOccurrence(cand, true)) {
          done = true;
          if (observer) observer.disconnect();
          return true;
        }
      }
      return false;
    };

    // Timed attempts
    attempts.forEach((ms) => setTimeout(() => { if (!done) tryNow(); }, ms));

    // Mutation-driven attempts for dynamic pages (e.g., YouTube SPA)
    const hlObserver = new MutationObserver(() => { tryNow(); });
    try {
      hlObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch { }
    // Stop observing after the last attempt window
    setTimeout(() => { if (hlObserver) hlObserver.disconnect(); }, attempts[attempts.length - 1] + 500);
  }

  // Build slight variations of the text to increase chances of a match
  function buildCandidateTexts(text) {
    const t = (text || '').trim();
    const out = new Set();
    const base = t;
    const stripOuter = base.replace(/^['"“”‘’\[\(]+|['"“”‘’\]\)]+$/g, '');
    const collapsed = stripOuter.replace(/\s+/g, ' ');
    out.add(base);
    out.add(stripOuter);
    out.add(collapsed);
    if (collapsed.length > 140) out.add(collapsed.slice(0, 120));
    // Token-based variations: drop first/last 1-2 tokens to handle mid-word or context
    const tokens = collapsed.split(/\s+/);
    if (tokens.length >= 3) {
      out.add(tokens.join(' '));
      out.add(tokens.slice(1).join(' '));
      out.add(tokens.slice(0, -1).join(' '));
    }
    if (tokens.length >= 5) {
      out.add(tokens.slice(2).join(' '));
      out.add(tokens.slice(0, -2).join(' '));
    }
    // If first token is very short (likely a truncated word), drop it
    if (tokens[0] && tokens[0].length <= 2) {
      out.add(tokens.slice(1).join(' '));
    }

    // Add partial matches for short text (like "Also present was a 38")
    if (tokens.length >= 2) {
      // Try different combinations for short phrases
      out.add(tokens.slice(0, 2).join(' ')); // First 2 words
      out.add(tokens.slice(0, 3).join(' ')); // First 3 words
      if (tokens.length >= 4) {
        out.add(tokens.slice(0, 4).join(' ')); // First 4 words
      }
    }

    // Add variations without numbers (in case numbers are formatted differently)
    const withoutNumbers = collapsed.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    if (withoutNumbers && withoutNumbers !== collapsed) {
      out.add(withoutNumbers);
    }

    return Array.from(out).filter(Boolean);
  }

  function highlightFirstOccurrence(query, caseInsensitive = false) {
    injectHighlightStyle();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        // Skip in script/style/noscript and hidden containers
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style && (style.visibility === 'hidden' || style.display === 'none')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const normalize = (s) => (s || '')
      .replace(/[\u2010-\u2015]/g, '-')        // various dashes to hyphen
      .replace(/[\u2018\u2019\u201B\u2032]/g, "'") // curly/single quotes to '
      .replace(/[\u201C\u201D\u201F\u2033]/g, '"')  // curly/double quotes to "
      .replace(/\u00A0/g, ' ')                  // NBSP to space
      .replace(/\s+/g, ' ');
    const needle = normalize(caseInsensitive ? query.toLowerCase() : query);
    let node;
    while ((node = walker.nextNode())) {
      const raw = caseInsensitive ? node.nodeValue.toLowerCase() : node.nodeValue;
      const hay = normalize(raw);
      const idx = hay.indexOf(needle);
      if (idx !== -1) {
        try {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + query.length);
          const mark = document.createElement('mark');
          mark.setAttribute('data-url-notes-highlight', '');
          range.surroundContents(mark);
          // Make focusable briefly for reliable centering in nested scroll containers
          mark.setAttribute('tabindex', '-1');
          // Scroll and focus to improve visibility
          mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          try { mark.focus({ preventScroll: true }); } catch { }
          // Flash effect
          mark.animate([
            { boxShadow: '0 0 0 0 rgba(255,235,59,0.8)' },
            { boxShadow: '0 0 0 8px rgba(255,235,59,0)' }
          ], { duration: 600 });
          return true;
        } catch (e) {
          // If surround fails due to split nodes, fallback to simpler selection
          try {
            const sel = window.getSelection();
            sel.removeAllRanges();
            const range2 = document.createRange();
            range2.setStart(node, idx);
            range2.setEnd(node, idx + query.length);
            sel.addRange(range2);
            document.execCommand('hiliteColor', false, '#ffeb3b');
          } catch { }
          return false;
        }
      }
    }
    return false;
  }

  // Extract meaningful page content for AI summarization
  function extractPageContent() {
    // Remove script and style elements
    const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement, .social-share, .comments');
    const tempDoc = document.cloneNode(true);

    // Remove unwanted elements from the clone
    tempDoc.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement, .social-share, .comments').forEach(el => el.remove());

    // Try to find main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '#content',
      '#main'
    ];

    let mainContent = null;
    for (const selector of contentSelectors) {
      const element = tempDoc.querySelector(selector);
      if (element && element.textContent.trim().length > 200) {
        mainContent = element;
        break;
      }
    }

    // Fallback to body if no main content found
    if (!mainContent) {
      mainContent = tempDoc.body || tempDoc.documentElement;
    }

    // Extract text content
    let text = mainContent.textContent || mainContent.innerText || '';

    // Clean up the text
    text = text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    // Limit content length (approximately 8000 characters for reasonable API usage)
    if (text.length > 8000) {
      text = text.substring(0, 8000) + '...';
    }

    return text;
  }

  // Parse :~:text= fragment per Text Fragments spec and return first part
  function extractTextFragment(href) {
    try {
      const u = new URL(href, window.location.origin);
      const hash = u.hash || '';
      const marker = ':~:text=';

      // Handle multiple text fragments by finding all occurrences
      const fragments = [];
      let searchStart = 0;
      let idx;

      while ((idx = hash.indexOf(marker, searchStart)) !== -1) {
        // Extract substring after ':~:text='
        let val = hash.substring(idx + marker.length);
        // Stop at next text fragment or parameter separator
        const nextFragment = val.indexOf('#:~:text=');
        const amp = val.indexOf('&');

        let endIdx = val.length;
        if (nextFragment !== -1) endIdx = Math.min(endIdx, nextFragment);
        if (amp !== -1) endIdx = Math.min(endIdx, amp);

        val = val.substring(0, endIdx);

        // The value may have comma-separated quotes; take first segment
        const first = (val || '').split(',')[0];
        if (first) {
          fragments.push(decodeURIComponent(first));
        }

        searchStart = idx + marker.length;
      }

      if (fragments.length === 0) {
        return '';
      }

      // Use the last (most specific) fragment
      return fragments[fragments.length - 1];

    } catch (error) {
      return '';
    }
  }

})();
