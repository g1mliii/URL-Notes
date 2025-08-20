// URL Notes Extension - Content Script
// This script runs on every webpage to detect page information

(function() {
  'use strict';

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
    if (request.action === 'getPageInfo') {
      sendResponse(getCurrentPageInfo());
    }
    // Highlight requested text on the page
    if (request.action === 'highlightText') {
      const fragText = extractTextFragment(request.href || '');
      const text = (fragText || request.text || '').trim();
      if (text) scheduleHighlightAttempts(text);
      // No response needed
      return false;
    }
    return true;
  });

  // Safe message sender to avoid "Extension context invalidated" errors
  function safeSendMessage(message) {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return;
      const maybePromise = chrome.runtime.sendMessage(message);
      // In MV3 this returns a promise; attach a no-op catch
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(() => {});
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

  // Clean up observer when page unloads
  window.addEventListener('beforeunload', () => {
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
    try { clearUrlNotesHighlights(); } catch {}
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
    } catch {}
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
          try { mark.focus({ preventScroll: true }); } catch {}
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
          } catch {}
          return false;
        }
      }
    }
    return false;
  }

  // Parse :~:text= fragment per Text Fragments spec and return first part
  function extractTextFragment(href) {
    try {
      const u = new URL(href, window.location.origin);
      const hash = u.hash || '';
      const marker = ':~:text=';
      const idx = hash.indexOf(marker);
      if (idx === -1) return '';
      // Extract substring after ':~:text='
      let val = hash.substring(idx + marker.length);
      // Stop at next parameter separator (&) or end
      const amp = val.indexOf('&');
      if (amp >= 0) val = val.substring(0, amp);
      // The value may have comma-separated quotes; take first segment
      const first = (val || '').split(',')[0];
      return decodeURIComponent(first || '');
    } catch {
      return '';
    }
  }

})();
