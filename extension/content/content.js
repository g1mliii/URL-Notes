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
        return false;
      }

      if (request.action === 'ping') {
        sendResponse({ status: 'ready', timestamp: Date.now() });
        return false; 
      }

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

      if (request.action === 'toggleMultiHighlight') {
        try {
          toggleMultiHighlightMode();
          const response = { enabled: multiHighlightMode };
          sendResponse(response);
        } catch (error) {
          sendResponse({ enabled: false, error: error.message });
        }
        return true; 
      }

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
        return false; 
      }

      if (request.action === 'extractPageContent') {
        try {
          const content = extractPageContent();
          sendResponse({ success: true, content });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true; 
      }

      sendResponse({ error: 'Unknown action' });
      return false;
    } catch (error) {
      sendResponse({ error: error.message });
      return false;
    }
  });


  function toggleMultiHighlightMode() {
    multiHighlightMode = !multiHighlightMode;

    if (multiHighlightMode) {
      enableMultiHighlightMode();
    } else {
      disableMultiHighlightMode();
    }

    updateExtensionBadge();
  }

  function enableMultiHighlightMode() {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseover', handleParagraphHover);
    document.addEventListener('mouseout', handleParagraphOut);
    document.addEventListener('click', handleParagraphClick);
    document.body.style.cursor = 'crosshair';
    document.body.classList.add('url-notes-multi-highlight-mode');

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

    addMultiHighlightIndicator();
    showHighlightToolbar();
  }

  function disableMultiHighlightMode() {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mouseover', handleParagraphHover);
    document.removeEventListener('mouseout', handleParagraphOut);
    document.removeEventListener('click', handleParagraphClick);
    document.body.style.cursor = '';
    document.body.classList.remove('url-notes-multi-highlight-mode');
    removeMultiHighlightIndicator();
    hideHighlightToolbar();
  }

  function handleMouseDown(e) {
    if (!multiHighlightMode || e.button !== 0) return; 

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      selectionStart = {
        node: range.startContainer,
        offset: range.startOffset
      };
      isSelecting = true;
    }

    paragraphClickTimeout = setTimeout(() => {
      paragraphClickTimeout = null;
    }, 200);
  }


  function handleMouseUp(e) {
    if (!multiHighlightMode) return;

    if (isSelecting) {
      isSelecting = false;

      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 0) {
          try {
            const contents = range.cloneContents();
            if (!contents.textContent || contents.textContent.trim().length === 0) {
              return;
            }

            if (!range.startContainer || !range.endContainer) {
              return;
            }

            const rangeContainer = range.commonAncestorContainer;
            const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED'];

            if (rangeContainer.nodeType === Node.ELEMENT_NODE) {
              const hasProblematicElements = skipTags.some(tag =>
                rangeContainer.tagName === tag || rangeContainer.querySelector(tag)
              );
              if (hasProblematicElements) {
                return;
              }
            }

            if (selectedText.length < 2) {
              return;
            }

            addHighlight(range, selectedText);
          } catch (error) {
          }
        }
      }

      selectionStart = null;
    }
  }

  function handleKeyDown(e) {
    if (!multiHighlightMode) return;

    if (e.key === 'Escape') {
      toggleMultiHighlightMode();
      e.preventDefault();
    }

    if (e.ctrlKey && e.key === 'Enter') {
      addAllHighlightsToNote();
      e.preventDefault();
    }

    if (e.ctrlKey && e.shiftKey && e.key === 'H') {
      toggleMultiHighlightMode();
      e.preventDefault();
    }
  }


  function handleParagraphHover(e) {
    if (!multiHighlightMode) return;
    if (isSelecting) return;

    const target = e.target;

    const paragraph = findParagraphElement(target);

    if (paragraph && paragraph !== hoveredParagraph) {
      
      if (hoveredParagraph) {
        hoveredParagraph.classList.remove('url-notes-paragraph-hover');
        removeTooltip();
      }

      hoveredParagraph = paragraph;
      hoveredParagraph.classList.add('url-notes-paragraph-hover');

      showTooltip(e.clientX, e.clientY);
    }
  }

  // Handle paragraph mouse out
  function handleParagraphOut(e) {
    if (!multiHighlightMode) return;

    const target = e.target;

    if (hoveredParagraph && !hoveredParagraph.contains(e.relatedTarget)) {
      hoveredParagraph.classList.remove('url-notes-paragraph-hover');
      hoveredParagraph = null;
      removeTooltip();
    }
  }


  function showTooltip(x, y) {
    removeTooltip();

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

  function removeTooltip() {
    const tooltip = document.getElementById('url-notes-paragraph-tooltip');
    if (tooltip && tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
  }

  function handleParagraphClick(e) {
    if (!multiHighlightMode) return;

    if (!e.shiftKey) return;

    const paragraph = findParagraphElement(e.target);
    if (!paragraph) return;
    e.preventDefault();
    e.stopPropagation();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }

    const existingHighlights = paragraph.querySelectorAll('mark[data-url-notes-highlight]');

    if (existingHighlights.length > 0) {
      const paragraphText = getParagraphText(paragraph);
      const highlightedText = Array.from(existingHighlights)
        .map(mark => mark.textContent || '')
        .join(' ')
        .trim();

      // If highlighted text is at least 80% of paragraph text, allow deselection
      const coverageRatio = highlightedText.length / paragraphText.length;

      if (coverageRatio >= 0.8) {
        existingHighlights.forEach(mark => {
          const highlightId = mark.getAttribute('data-highlight-id');
          if (highlightId) {
            const index = highlights.findIndex(h => h.id === parseFloat(highlightId));
            if (index !== -1) {
              removeHighlight(index);
            }
          }
        });

        paragraph.style.transition = 'background 0.3s ease';
        paragraph.style.background = 'rgba(239, 68, 68, 0.2)';
        setTimeout(() => {
          paragraph.style.background = '';
        }, 300);

        return;
      }
    }

    const paragraphText = getParagraphText(paragraph);

    if (paragraphText && paragraphText.length > 0) {
      
      try {
        const range = createTextOnlyRange(paragraph);
        if (!range) return;
        addHighlight(range, paragraphText);
        paragraph.classList.add('url-notes-paragraph-captured');
        setTimeout(() => {
          paragraph.classList.remove('url-notes-paragraph-captured');
        }, 300);
      } catch (error) {
      }
    }
  }

  function findParagraphElement(element) {
    if (!element || element === document.body) return null;
    const paragraphTags = ['P', 'ARTICLE', 'BLOCKQUOTE', 'PRE', 'LI', 'TD', 'TH'];
    const containerTags = ['DIV', 'SECTION']; 
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'NAV', 'HEADER', 'FOOTER', 'ASIDE'];
    const skipClassPatterns = ['sidebar', 'nav', 'menu', 'header', 'footer', 'toolbar', 'widget', 'ad', 'banner', 'popup', 'modal', 'infobox'];
    let current = element;

    while (current && current !== document.body) {
      if (skipTags.includes(current.tagName)) {
        return null;
      }
      const className = (current.className || '').toLowerCase();
      if (skipClassPatterns.some(pattern => className.includes(pattern))) {
        current = current.parentElement;
        continue;
      }

      if (paragraphTags.includes(current.tagName)) {
        const text = current.textContent?.trim() || '';
        if (text.length >= 50) {
          return current;
        }
      }

      if (containerTags.includes(current.tagName)) {
        const text = current.textContent?.trim() || '';

        if (text.length >= 100) {
          const childContainers = current.querySelectorAll('div, section').length;
          const textDensity = text.length / Math.max(1, childContainers);
          if (textDensity >= 50) {
            return current;
          }
        }
      }

      current = current.parentElement;
    }

    return null;
  }

  function getParagraphText(paragraph) {
    if (!paragraph) return '';
    const clone = paragraph.cloneNode(true);
    const elementsToRemove = clone.querySelectorAll('style, script, noscript, svg, canvas');
    elementsToRemove.forEach(el => el.remove());
    const text = clone.textContent || '';
    return text.trim().replace(/\s+/g, ' ');
  }

  function createTextOnlyRange(paragraph) {
    if (!paragraph) return null;

    const range = document.createRange();
    const walker = document.createTreeWalker(
      paragraph,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
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

  function wrapTextNodesInRange(range, highlightId) {
    const marks = [];
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

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

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
        mark.addEventListener('click', () => {
          const index = highlights.findIndex(h => h.id === highlightId);
          if (index !== -1) {
            removeHighlight(index);
          }
        });
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(textNode);
        nodeRange.surroundContents(mark);
        marks.push(mark);
      } catch (error) {
      }
    });

    return marks;
  }


  function addHighlight(range, text) {
    if (text.length < 3) return; 
    const existingIndex = highlights.findIndex(h => {
      if (h.text !== text) return false;
      try {
        const hRange = h.range;
        if (!hRange || !range) return false;

        if (hRange.startContainer === range.startContainer &&
          hRange.startOffset === range.startOffset &&
          hRange.endContainer === range.endContainer &&
          hRange.endOffset === range.endOffset) {
          return true;
        }
        const hStart = hRange.startOffset;
        const hEnd = hRange.endOffset;
        const newStart = range.startOffset;
        const newEnd = range.endOffset;

        if (hRange.startContainer === range.startContainer &&
          hRange.endContainer === range.endContainer) {
          const overlap = Math.min(hEnd, newEnd) - Math.max(hStart, newStart);
          if (overlap > 0) {
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

      let parent = startNode.parentNode;
      while (parent && parent !== document.body) {
        if (parent.hasAttribute && parent.hasAttribute('data-url-notes-highlight')) {
          return;
        }
        parent = parent.parentNode;
      }

      const existingHighlights = document.querySelectorAll('[data-url-notes-highlight]');
      for (const existing of existingHighlights) {
        try {
          const existingRect = existing.getBoundingClientRect();
          const selectionRect = range.getBoundingClientRect();

          if (Math.abs(existingRect.left - selectionRect.left) < 5 &&
            Math.abs(existingRect.top - selectionRect.top) < 5) {
            return;
          }
        } catch (error) {
        }
      }
    } catch (error) {
      return;
    }

    const highlight = {
      id: Date.now() + Math.random(),
      text: text,
      range: range.cloneRange(),
      element: null,
      timestamp: Date.now()
    };

    let highlightElement = null;

    try {
      if (!range || range.collapsed) {
        return;
      }

      // Try to wrap the range contents, but handle cases where it might fail
      try {
        const mark = document.createElement('mark');
        mark.setAttribute('data-url-notes-highlight', '');
        mark.setAttribute('data-highlight-id', highlight.id);
        mark.style.backgroundColor = '#ffeb3b';
        mark.style.padding = '2px 4px';
        mark.style.borderRadius = '3px';
        mark.style.boxShadow = '0 0 0 2px rgba(255,235,59,0.35)';
        mark.style.cursor = 'pointer';

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
          range.surroundContents(mark);
          highlightElement = mark;
        } else {
          throw new Error('Range crosses element boundaries');
        }

      } catch (wrapError) {
        try {
          const marks = wrapTextNodesInRange(range, highlight.id);

          if (marks && marks.length > 0) {          
            highlightElement = marks[0];
            highlight.elements = marks;
          } else {
            return; 
          }
        } catch (walkError) {
          return; 
        }
      }

      if (highlightElement) {
        highlight.element = highlightElement;
        highlights.push(highlight);
        updateHighlightToolbar();
      }

    } catch (error) {
    }
  }


  function removeHighlight(index) {
    if (index < 0 || index >= highlights.length) return;

    const highlight = highlights[index];
    const elementsToRemove = highlight.elements || (highlight.element ? [highlight.element] : []);

    elementsToRemove.forEach(element => {
      if (element && element.parentNode) {
        const parent = element.parentNode;
        element.classList.add('removing');

        setTimeout(() => {
          if (element && element.parentNode) {
            while (element.firstChild) {
              parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
            parent.normalize();
          }
        }, 300); 
      }
    });

    highlights.splice(index, 1);

    updateHighlightToolbarWithAnimation();
  }


  function clearAllHighlights() {
    const count = highlights.length;
    highlights.forEach(highlight => {
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

  function hideHighlightToolbar() {
    if (highlightToolbar && highlightToolbar.parentNode) {
      highlightToolbar.parentNode.removeChild(highlightToolbar);
      highlightToolbar = null;
    }
  }

  function updateHighlightToolbar() {
    if (!highlightToolbar) return;

    const count = highlights.length;
    const safeCount = Math.max(0, Math.min(1000, parseInt(count) || 0)); 
    highlightToolbar.textContent = '';
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
    const countDiv = document.createElement('div');
    countDiv.style.cssText = 'margin-bottom: 12px; color: #bdc3c7;';
    countDiv.textContent = `${safeCount} highlight${safeCount !== 1 ? 's' : ''} selected`;
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

    highlightToolbar.appendChild(headerDiv);
    highlightToolbar.appendChild(countDiv);
    highlightToolbar.appendChild(buttonsDiv);
    highlightToolbar.appendChild(instructionsDiv);
    const exitBtn = highlightToolbar.querySelector('#exit-highlight-mode');
    const addBtn = highlightToolbar.querySelector('#add-highlights-to-note');
    const clearBtn = highlightToolbar.querySelector('#clear-all-highlights');

    exitBtn.addEventListener('click', toggleMultiHighlightMode);
    addBtn.addEventListener('click', () => {
      addAllHighlightsToNote();
    });
    clearBtn.addEventListener('click', clearAllHighlights);

    if (count === 0) {
      addBtn.disabled = true;
      clearBtn.disabled = true;
    }
  }


  function updateHighlightToolbarWithAnimation() {
    updateHighlightToolbar();

    if (highlightToolbar) {
      const countElement = highlightToolbar.querySelector('div[style*="margin-bottom: 12px"]');
      if (countElement) {
        countElement.classList.add('highlight-count', 'updating');
        setTimeout(() => {
          countElement.classList.remove('updating');
        }, 400);
      }
    }
  }


  function addAllHighlightsToNote() {

    if (highlights.length === 0) {
      return;
    }

    const pageInfo = getCurrentPageInfo();
    const highlightData = highlights.map(h => ({
      text: h.text,
      timestamp: h.timestamp
    }));

    chrome.runtime.sendMessage({ action: 'ping' }, (pingResponse) => {
      if (chrome.runtime.lastError) {
        return;
      }

      const messageTimeout = setTimeout(() => {
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
          clearAllHighlights();
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
        }
      });
    } else {
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        text: '',
        color: ''
      }, () => {
        if (chrome.runtime.lastError) {  
        }
      });
    }
  }


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


  function removeMultiHighlightIndicator() {
    const indicator = document.getElementById('multi-highlight-indicator');
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }

  function safeSendMessage(message) {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return;
      const maybePromise = chrome.runtime.sendMessage(message);
      // In MV3 this returns a promise; attach a no-op catch
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(() => { });
      }
    } catch (_) {
    }
  }

  // Notify background script that content script is ready
  safeSendMessage({
    action: 'contentScriptReady',
    pageInfo: getCurrentPageInfo()
  });

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

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

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

    attempts.forEach((ms) => setTimeout(() => { if (!done) tryNow(); }, ms));
    const hlObserver = new MutationObserver(() => { tryNow(); });
    try {
      hlObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch { }
    setTimeout(() => { if (hlObserver) hlObserver.disconnect(); }, attempts[attempts.length - 1] + 500);
  }

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

    if (tokens.length >= 2) {
      out.add(tokens.slice(0, 2).join(' ')); 
      out.add(tokens.slice(0, 3).join(' ')); 
      if (tokens.length >= 4) {
        out.add(tokens.slice(0, 4).join(' ')); 
      }
    }

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
      .replace(/[\u2010-\u2015]/g, '-')        
      .replace(/[\u2018\u2019\u201B\u2032]/g, "'") 
      .replace(/[\u201C\u201D\u201F\u2033]/g, '"')  
      .replace(/\u00A0/g, ' ') 
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
          mark.setAttribute('tabindex', '-1');
          mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          try { mark.focus({ preventScroll: true }); } catch { }
          mark.animate([
            { boxShadow: '0 0 0 0 rgba(255,235,59,0.8)' },
            { boxShadow: '0 0 0 8px rgba(255,235,59,0)' }
          ], { duration: 600 });
          return true;
        } catch (e) {
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

  function extractPageContent() {
    const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement, .social-share, .comments');
    const tempDoc = document.cloneNode(true);
    tempDoc.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement, .social-share, .comments').forEach(el => el.remove());
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

    if (!mainContent) {
      mainContent = tempDoc.body || tempDoc.documentElement;
    }

    let text = mainContent.textContent || mainContent.innerText || '';
    text = text
      .replace(/\s+/g, ' ') 
      .replace(/\n\s*\n/g, '\n') 
      .trim();

    if (text.length > 8000) {
      text = text.substring(0, 8000) + '...';
    }

    return text;
  }

  function extractTextFragment(href) {
    try {
      const u = new URL(href, window.location.origin);
      const hash = u.hash || '';
      const marker = ':~:text=';
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

      return fragments[fragments.length - 1];

    } catch (error) {
      return '';
    }
  }

})();
