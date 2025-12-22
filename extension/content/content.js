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
  let hoveredParagraph = null;
  let paragraphClickTimeout = null;

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
    document.addEventListener('mouseover', handleParagraphHover);
    document.addEventListener('mouseout', handleParagraphOut);
    document.addEventListener('click', handleParagraphClick);

    // Add visual indicator with GPU acceleration
    document.body.style.cursor = 'crosshair';
    document.body.classList.add('url-notes-multi-highlight-mode');

    // Inject body GPU acceleration styles if not already present
    if (!document.getElementById('url-notes-body-style')) {
      const bodyStyle = document.createElement('style');
      bodyStyle.id = 'url-notes-body-style';
      bodyStyle.textContent = `
        body.url-notes-multi-highlight-mode {
          will-change: cursor;
          cursor: crosshair !important;
        }
        
        /* GPU optimization for selection interactions */
        .url-notes-selection-feedback {
          will-change: transform, opacity;
          transform: translateZ(0);
          backface-visibility: hidden;
          transition: all 0.15s ease;
          pointer-events: none;
        }
        
        /* Paragraph hover effect - dotted outline like Obsidian */
        .url-notes-paragraph-hover {
          outline: 2px dashed rgba(59, 130, 246, 0.6) !important;
          outline-offset: 2px !important;
          background: rgba(59, 130, 246, 0.05) !important;
          transition: outline 0.15s ease, background 0.15s ease !important;
          border-radius: 4px !important;
        }
        
        /* Paragraph captured animation */
        @keyframes paragraph-capture {
          0% { background: rgba(34, 197, 94, 0.2); }
          100% { background: rgba(34, 197, 94, 0); }
        }
        
        .url-notes-paragraph-captured {
          animation: paragraph-capture 0.3s ease !important;
        }
      `;
      document.head.appendChild(bodyStyle);
    }

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
    document.removeEventListener('mouseover', handleParagraphHover);
    document.removeEventListener('mouseout', handleParagraphOut);
    document.removeEventListener('click', handleParagraphClick);

    // Remove visual indicator and GPU acceleration class
    document.body.style.cursor = '';
    document.body.classList.remove('url-notes-multi-highlight-mode');

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

    // Start timer to detect if this is a click (not drag)
    paragraphClickTimeout = setTimeout(() => {
      paragraphClickTimeout = null;
    }, 200);
  }

  // Handle mouse up for text selection
  function handleMouseUp(e) {
    if (!multiHighlightMode) return;

    // If user dragged to select text, handle it
    if (isSelecting) {
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

  // Handle paragraph hover - show dotted outline and tooltip
  function handleParagraphHover(e) {
    if (!multiHighlightMode) return;

    // Don't show hover if user is actively selecting text
    if (isSelecting) return;

    const target = e.target;

    // Find the closest paragraph-like element
    const paragraph = findParagraphElement(target);

    if (paragraph && paragraph !== hoveredParagraph) {
      // Remove hover from previous paragraph
      if (hoveredParagraph) {
        hoveredParagraph.classList.remove('url-notes-paragraph-hover');
        removeTooltip();
      }

      // Add hover to new paragraph
      hoveredParagraph = paragraph;
      hoveredParagraph.classList.add('url-notes-paragraph-hover');

      // Show tooltip
      showTooltip(e.clientX, e.clientY);
    }
  }

  // Handle paragraph mouse out
  function handleParagraphOut(e) {
    if (!multiHighlightMode) return;

    const target = e.target;

    // Only remove hover if we're leaving the hovered paragraph
    if (hoveredParagraph && !hoveredParagraph.contains(e.relatedTarget)) {
      hoveredParagraph.classList.remove('url-notes-paragraph-hover');
      hoveredParagraph = null;
      removeTooltip();
    }
  }

  // Show tooltip near cursor
  function showTooltip(x, y) {
    removeTooltip(); // Remove any existing tooltip

    const tooltip = document.createElement('div');
    tooltip.id = 'url-notes-paragraph-tooltip';
    if (!hoveredParagraph) return;

    tooltip.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
        <path d="M9 3v18M15 3v18"/>
      </svg>
      Shift+Click to select
    `;

    // Get paragraph position
    const rect = hoveredParagraph.getBoundingClientRect();

    tooltip.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top - 32}px;
      background: rgba(59, 130, 246, 0.95);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 10001;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 2px 12px rgba(59, 130, 246, 0.4);
      animation: tooltip-fade-in 0.2s ease;
      display: flex;
      align-items: center;
    `;

    // Add animation styles if not already present
    if (!document.getElementById('url-notes-tooltip-style')) {
      const style = document.createElement('style');
      style.id = 'url-notes-tooltip-style';
      style.textContent = `
        @keyframes tooltip-fade-in {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(tooltip);
  }

  // Remove tooltip
  function removeTooltip() {
    const tooltip = document.getElementById('url-notes-paragraph-tooltip');
    if (tooltip && tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
  }

  // Handle paragraph click - capture whole paragraph or remove if already highlighted (Shift+Click)
  function handleParagraphClick(e) {
    if (!multiHighlightMode) return;

    // Only trigger on Shift+Click
    if (!e.shiftKey) return;

    const paragraph = findParagraphElement(e.target);
    if (!paragraph) return;

    // Prevent default shift+click behavior (text selection extension)
    e.preventDefault();
    e.stopPropagation();

    // Clear any existing selection that shift+click might have created
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }

    // Check if paragraph was fully highlighted via click (not partial manual selection)
    const existingHighlights = paragraph.querySelectorAll('mark[data-url-notes-highlight]');

    if (existingHighlights.length > 0) {
      // Only allow deselection if the entire paragraph is highlighted
      // Check if highlights cover most of the paragraph text
      const paragraphText = getParagraphText(paragraph);
      const highlightedText = Array.from(existingHighlights)
        .map(mark => mark.textContent || '')
        .join(' ')
        .trim();

      // If highlighted text is at least 80% of paragraph text, allow deselection
      const coverageRatio = highlightedText.length / paragraphText.length;

      if (coverageRatio >= 0.8) {
        // Remove all highlights in this paragraph
        existingHighlights.forEach(mark => {
          const highlightId = mark.getAttribute('data-highlight-id');
          if (highlightId) {
            const index = highlights.findIndex(h => h.id === parseFloat(highlightId));
            if (index !== -1) {
              removeHighlight(index);
            }
          }
        });

        // Visual feedback for removal
        paragraph.style.transition = 'background 0.3s ease';
        paragraph.style.background = 'rgba(239, 68, 68, 0.2)';
        setTimeout(() => {
          paragraph.style.background = '';
        }, 300);

        return;
      }
      // If less than 80% is highlighted, don't deselect (user made partial selection)
    }

    // Get the text content of the paragraph (XSS-safe)
    const paragraphText = getParagraphText(paragraph);

    if (paragraphText && paragraphText.length > 0) {
      // Create a range for only the text nodes in the paragraph (skip style/script tags)
      try {
        const range = createTextOnlyRange(paragraph);
        if (!range) return;

        addHighlight(range, paragraphText);

        // Visual feedback
        paragraph.classList.add('url-notes-paragraph-captured');
        setTimeout(() => {
          paragraph.classList.remove('url-notes-paragraph-captured');
        }, 300);
      } catch (error) {
        // Silently handle capture errors
      }
    }
  }

  // Find the closest paragraph-like element (XSS-safe)
  function findParagraphElement(element) {
    if (!element || element === document.body) return null;

    // Paragraph-like elements (prioritize semantic text containers)
    const paragraphTags = ['P', 'ARTICLE', 'BLOCKQUOTE', 'PRE', 'LI', 'TD', 'TH'];
    const containerTags = ['DIV', 'SECTION']; // Only use these if they have substantial text

    // Skip problematic elements and UI components
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'NAV', 'HEADER', 'FOOTER', 'ASIDE'];

    // Skip common sidebar/UI class patterns
    const skipClassPatterns = ['sidebar', 'nav', 'menu', 'header', 'footer', 'toolbar', 'widget', 'ad', 'banner', 'popup', 'modal', 'infobox'];

    let current = element;

    while (current && current !== document.body) {
      // Skip if it's a problematic element
      if (skipTags.includes(current.tagName)) {
        return null;
      }

      // Skip elements with UI-related classes
      const className = (current.className || '').toLowerCase();
      if (skipClassPatterns.some(pattern => className.includes(pattern))) {
        current = current.parentElement;
        continue;
      }

      // Check if it's a paragraph-like element with meaningful text
      if (paragraphTags.includes(current.tagName)) {
        const text = current.textContent?.trim() || '';

        // Must have at least 50 characters to be considered a real paragraph
        if (text.length >= 50) {
          return current;
        }
      }

      // For DIV/SECTION, require more substantial text content
      if (containerTags.includes(current.tagName)) {
        const text = current.textContent?.trim() || '';

        // Must have at least 100 characters and not be too nested with other containers
        if (text.length >= 100) {
          // Check if this container has mostly text vs nested containers
          const childContainers = current.querySelectorAll('div, section').length;
          const textDensity = text.length / Math.max(1, childContainers);

          // If text density is high enough, consider it a paragraph
          if (textDensity >= 50) {
            return current;
          }
        }
      }

      current = current.parentElement;
    }

    return null;
  }

  // Get paragraph text safely (XSS-safe)
  function getParagraphText(paragraph) {
    if (!paragraph) return '';

    // Clone the paragraph to avoid modifying the original
    const clone = paragraph.cloneNode(true);

    // Remove style, script, and other non-content elements
    const elementsToRemove = clone.querySelectorAll('style, script, noscript, svg, canvas');
    elementsToRemove.forEach(el => el.remove());

    // Use textContent to safely extract text (auto-escapes HTML)
    const text = clone.textContent || '';

    // Trim and normalize whitespace
    return text.trim().replace(/\s+/g, ' ');
  }

  // Create a range that only includes text nodes, skipping style/script tags
  function createTextOnlyRange(paragraph) {
    if (!paragraph) return null;

    const range = document.createRange();

    // Find first and last text nodes, skipping style/script elements
    const walker = document.createTreeWalker(
      paragraph,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip empty text nodes
          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip text nodes inside style, script, etc.
          let parent = node.parentElement;
          while (parent && parent !== paragraph) {
            const tag = parent.tagName;
            if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'NOSCRIPT' || tag === 'SVG' || tag === 'CANVAS') {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const firstTextNode = walker.nextNode();
    if (!firstTextNode) return null;

    // Find last text node
    let lastTextNode = firstTextNode;
    let node;
    while (node = walker.nextNode()) {
      lastTextNode = node;
    }

    try {
      range.setStart(firstTextNode, 0);
      range.setEnd(lastTextNode, lastTextNode.length);
      return range;
    } catch (error) {
      return null;
    }
  }

  // Walk through range and wrap each text node individually (for complex ranges)
  function wrapTextNodesInRange(range, highlightId) {
    const marks = [];

    // Create a tree walker to find all text nodes in the range
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip empty text nodes
          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          // Check if this text node intersects with our range
          if (!range.intersectsNode(node)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip text nodes inside script, style, etc.
          let parent = node.parentElement;
          while (parent) {
            const tag = parent.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    // Collect all text nodes first (to avoid modifying while iterating)
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Wrap each text node
    textNodes.forEach(textNode => {
      try {
        const mark = document.createElement('mark');
        mark.setAttribute('data-url-notes-highlight', '');
        mark.setAttribute('data-highlight-id', highlightId);
        mark.style.backgroundColor = '#ffeb3b';
        mark.style.padding = '2px 4px';
        mark.style.borderRadius = '3px';
        mark.style.boxShadow = '0 0 0 2px rgba(255,235,59,0.35)';
        mark.style.cursor = 'pointer';

        // Add click to remove functionality
        mark.addEventListener('click', () => {
          const index = highlights.findIndex(h => h.id === highlightId);
          if (index !== -1) {
            removeHighlight(index);
          }
        });

        // Create a range for this specific text node
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(textNode);

        // Wrap this text node
        nodeRange.surroundContents(mark);
        marks.push(mark);
      } catch (error) {
        // Skip nodes that can't be wrapped (e.g., already inside a mark)
      }
    });

    return marks;
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
        // Standard wrap failed, trying walk-and-wrap approach for complex ranges
        try {
          const marks = wrapTextNodesInRange(range, highlight.id);

          if (marks && marks.length > 0) {
            // Store first mark as the primary element
            highlightElement = marks[0];
            // Store all marks for proper cleanup
            highlight.elements = marks;
          } else {
            return; // Couldn't wrap any nodes
          }
        } catch (walkError) {
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

  // Remove a highlight with smooth GPU-accelerated animation
  function removeHighlight(index) {
    if (index < 0 || index >= highlights.length) return;

    const highlight = highlights[index];

    // Handle multiple elements (from walk-and-wrap) or single element
    const elementsToRemove = highlight.elements || (highlight.element ? [highlight.element] : []);

    elementsToRemove.forEach(element => {
      if (element && element.parentNode) {
        const parent = element.parentNode;

        // Add removal animation class for smooth GPU-accelerated exit
        element.classList.add('removing');

        // Wait for animation to complete before removing element
        setTimeout(() => {
          if (element && element.parentNode) {
            while (element.firstChild) {
              parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
            parent.normalize();
          }
        }, 300); // Match animation duration
      }
    });

    // Remove from array immediately (don't wait for animation)
    highlights.splice(index, 1);

    // Update toolbar with count animation
    updateHighlightToolbarWithAnimation();
  }

  // Clear all highlights
  function clearAllHighlights() {
    const count = highlights.length;
    highlights.forEach(highlight => {
      // Handle multiple elements (from walk-and-wrap) or single element
      const elementsToRemove = highlight.elements || (highlight.element ? [highlight.element] : []);

      elementsToRemove.forEach(element => {
        if (element && element.parentNode) {
          const parent = element.parentNode;
          while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }
          parent.removeChild(element);
          parent.normalize();
        }
      });
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
      -webkit-backdrop-filter: blur(10px);
      
      /* GPU acceleration for smooth toolbar interactions */
      will-change: transform, opacity;
      transform: translateZ(0);
      backface-visibility: hidden;
      contain: layout style paint;
      
      /* Smooth entrance animation */
      animation: toolbar-slide-in 0.3s ease-out;
    `;

    // Inject toolbar-specific GPU acceleration styles
    if (!document.getElementById('url-notes-toolbar-style')) {
      const toolbarStyle = document.createElement('style');
      toolbarStyle.id = 'url-notes-toolbar-style';
      toolbarStyle.textContent = `
        @keyframes toolbar-slide-in {
          from {
            transform: translateX(100%) translateZ(0);
            opacity: 0;
          }
          to {
            transform: translateX(0) translateZ(0);
            opacity: 1;
          }
        }

        #url-notes-highlight-toolbar button {
          will-change: transform, background-color, box-shadow;
          transform: translateZ(0);
          backface-visibility: hidden;
          transition: all 0.2s ease;
        }

        #url-notes-highlight-toolbar button:hover:not(:disabled) {
          transform: translateZ(0) translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        #url-notes-highlight-toolbar button:active:not(:disabled) {
          transform: translateZ(0) translateY(0);
        }

        @media (hover: none) and (pointer: coarse) {
          #url-notes-highlight-toolbar button {
            min-height: 44px;
            padding: 12px 16px;
            touch-action: manipulation;
          }
        }

        /* GPU acceleration for toolbar count updates */
        #url-notes-highlight-toolbar .highlight-count {
          will-change: transform;
          transform: translateZ(0);
          transition: all 0.2s ease;
        }

        .highlight-count.updating {
          animation: count-update 0.4s ease-out;
        }

        @keyframes count-update {
          0% { transform: translateZ(0) scale(1); }
          50% { transform: translateZ(0) scale(1.2); }
          100% { transform: translateZ(0) scale(1); }
        }
      `;
      document.head.appendChild(toolbarStyle);
    }

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

    // Create toolbar content safely using DOM methods (content script doesn't have access to safeDOM)
    const safeCount = Math.max(0, Math.min(1000, parseInt(count) || 0)); // Limit count to reasonable range

    // Clear existing content
    highlightToolbar.textContent = '';

    // Create header div
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'margin-bottom: 8px; font-weight: 600; display: flex; align-items: center; gap: 8px;';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = '📝 Multi-Highlight Mode';
    headerDiv.appendChild(titleSpan);

    const exitButton = document.createElement('button');
    exitButton.id = 'exit-highlight-mode';
    exitButton.style.cssText = 'background: #e74c3c; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;';
    exitButton.textContent = 'Exit';
    headerDiv.appendChild(exitButton);

    // Create count div
    const countDiv = document.createElement('div');
    countDiv.style.cssText = 'margin-bottom: 12px; color: #bdc3c7;';
    countDiv.textContent = `${safeCount} highlight${safeCount !== 1 ? 's' : ''} selected`;

    // Create buttons div
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = 'display: flex; gap: 8px;';

    const addButton = document.createElement('button');
    addButton.id = 'add-highlights-to-note';
    addButton.style.cssText = `background: #3498db; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; flex: 1; ${safeCount === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}`;
    addButton.textContent = 'Add to Note';
    buttonsDiv.appendChild(addButton);

    const clearButton = document.createElement('button');
    clearButton.id = 'clear-all-highlights';
    clearButton.style.cssText = `background: #95a5a6; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; ${safeCount === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}`;
    clearButton.textContent = 'Clear All';
    buttonsDiv.appendChild(clearButton);

    // Create instructions div
    const instructionsDiv = document.createElement('div');
    instructionsDiv.style.cssText = 'margin-top: 8px; font-size: 12px; color: #bdc3c7;';

    const instructions = [
      '• Drag to highlight text',
      '• Shift+Click to select paragraph',
      '• Click highlight to remove',
      '• Ctrl+Enter to add all to note',
      '• Escape to exit mode'
    ];

    instructions.forEach(text => {
      const instructionDiv = document.createElement('div');
      instructionDiv.textContent = text;
      instructionsDiv.appendChild(instructionDiv);
    });

    // Append all elements to toolbar
    highlightToolbar.appendChild(headerDiv);
    highlightToolbar.appendChild(countDiv);
    highlightToolbar.appendChild(buttonsDiv);
    highlightToolbar.appendChild(instructionsDiv);

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

  // Update toolbar content with count animation
  function updateHighlightToolbarWithAnimation() {
    updateHighlightToolbar();

    // Add animation to count display
    if (highlightToolbar) {
      const countElement = highlightToolbar.querySelector('div[style*="margin-bottom: 12px"]');
      if (countElement) {
        countElement.classList.add('highlight-count', 'updating');

        // Remove animation class after animation completes
        setTimeout(() => {
          countElement.classList.remove('updating');
        }, 400);
      }
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
      
      /* GPU acceleration for smooth animation */
      will-change: opacity, transform;
      transform: translateZ(0);
      backface-visibility: hidden;
      
      /* Enhanced animation with GPU optimization */
      animation: multi-highlight-pulse 2s ease-in-out infinite;
    `;

    // Add GPU-accelerated CSS animation
    if (!document.getElementById('url-notes-indicator-style')) {
      const style = document.createElement('style');
      style.id = 'url-notes-indicator-style';
      style.textContent = `
        @keyframes multi-highlight-pulse {
          0%, 100% { 
            opacity: 0.8;
            transform: translateZ(0) scaleX(1);
          }
          50% { 
            opacity: 1;
            transform: translateZ(0) scaleX(1.02);
          }
        }

        /* Reduce motion for accessibility */
        @media (prefers-reduced-motion: reduce) {
          #multi-highlight-indicator {
            animation: none !important;
            transform: translateZ(0) !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

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

    // Inject GPU-accelerated CSS for multi-highlight functionality
    const style = document.createElement('style');
    style.id = 'url-notes-highlight-style';
    style.textContent = `
      /* GPU-accelerated highlight elements */
      mark[data-url-notes-highlight] {
        background: #ffeb3b99;
        padding: 0 .1em;
        border-radius: 2px;
        box-shadow: 0 0 0 2px rgba(255,235,59,0.35);
        
        /* GPU acceleration for smooth highlight interactions */
        will-change: background-color, box-shadow, transform;
        transform: translateZ(0);
        backface-visibility: hidden;
        
        /* Smooth transitions for hover effects */
        transition: all 0.2s ease;
        cursor: pointer;
      }

      /* Enhanced hover effects for highlights */
      mark[data-url-notes-highlight]:hover {
        background: #ffeb3bcc;
        box-shadow: 0 0 0 3px rgba(255,235,59,0.5);
        transform: translateZ(0) scale(1.02);
      }

      /* Active state for highlights */
      mark[data-url-notes-highlight]:active {
        transform: translateZ(0) scale(0.98);
      }

      /* GPU optimization for highlight removal animation */
      mark[data-url-notes-highlight].removing {
        will-change: transform, opacity;
        animation: highlight-remove 0.3s ease-out forwards;
      }

      @keyframes highlight-remove {
        0% {
          transform: translateZ(0) scale(1);
          opacity: 1;
        }
        50% {
          transform: translateZ(0) scale(1.1);
          opacity: 0.5;
        }
        100% {
          transform: translateZ(0) scale(0.8);
          opacity: 0;
        }
      }

      /* Mobile touch optimization */
      @media (hover: none) and (pointer: coarse) {
        mark[data-url-notes-highlight] {
          padding: 2px 4px;
          min-height: 44px;
          display: inline-block;
          -webkit-overflow-scrolling: touch;
          touch-action: manipulation;
        }
      }

      /* Reduce motion for accessibility */
      @media (prefers-reduced-motion: reduce) {
        mark[data-url-notes-highlight],
        mark[data-url-notes-highlight]:hover {
          animation: none !important;
          transition: none !important;
          transform: none !important;
        }
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
