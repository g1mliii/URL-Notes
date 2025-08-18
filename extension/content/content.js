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
    return true;
  });

  // Notify background script that content script is ready
  chrome.runtime.sendMessage({
    action: 'contentScriptReady',
    pageInfo: getCurrentPageInfo()
  }).catch(() => {
    // Ignore errors if background script isn't ready
  });

  // Monitor for URL changes (for SPAs)
  let currentUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      chrome.runtime.sendMessage({
        action: 'urlChanged',
        pageInfo: getCurrentPageInfo()
      }).catch(() => {
        // Ignore errors if background script isn't ready
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

})();
