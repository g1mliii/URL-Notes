// Edge-Specific Content Script Compatibility Layer
// This file provides Edge-specific adaptations for content script functionality

(function() {
  'use strict';

  // Edge CSP (Content Security Policy) compatibility
  // Edge (Chromium-based) has similar CSP to Chrome but may have subtle differences

  // Edge keyboard shortcut handling
  // Edge may handle some keyboard shortcuts differently than Chrome
  const edgeKeyboardHandler = {
    // Map of Edge-specific key codes (mostly same as Chrome)
    keyMap: {
      'Esc': 'Escape',
      'Del': 'Delete',
      'Left': 'ArrowLeft',
      'Right': 'ArrowRight',
      'Up': 'ArrowUp',
      'Down': 'ArrowDown'
    },

    // Normalize keyboard events for Edge
    normalizeKey: function(event) {
      let key = event.key;
      
      // Handle Edge-specific key names (if any)
      if (this.keyMap[key]) {
        key = this.keyMap[key];
      }

      return key;
    },

    // Check if keyboard shortcut should be handled
    shouldHandle: function(event) {
      // Edge may have different default shortcuts
      // Ensure our shortcuts don't conflict with Edge defaults
      
      // Allow Ctrl+Shift+H for multi-highlight
      if (event.ctrlKey && event.shiftKey && event.key === 'H') {
        return true;
      }

      // Allow Escape to exit modes
      if (event.key === 'Escape') {
        return true;
      }

      // Allow Ctrl+Enter for actions
      if (event.ctrlKey && event.key === 'Enter') {
        return true;
      }

      return false;
    }
  };

  // Edge DOM manipulation compatibility
  const edgeDOMCompat = {
    // Edge may handle Range operations similarly to Chrome
    createSafeRange: function(selection) {
      try {
        if (!selection || selection.rangeCount === 0) {
          return null;
        }

        const range = selection.getRangeAt(0);
        
        // Edge validation: ensure range is valid
        if (!range.startContainer || !range.endContainer) {
          return null;
        }

        // Clone range to avoid modifying original
        return range.cloneRange();
      } catch (error) {
        return null;
      }
    },

    // Edge-safe element insertion
    safeInsertNode: function(node, range) {
      try {
        // Edge may throw errors on certain insertions
        // Validate before inserting
        if (!node || !range) {
          return false;
        }

        // Check if range is collapsed
        if (range.collapsed) {
          range.insertNode(node);
          return true;
        }

        // For non-collapsed ranges, delete contents first
        range.deleteContents();
        range.insertNode(node);
        return true;
      } catch (error) {
        return false;
      }
    },

    // Edge-safe element wrapping
    safeWrapRange: function(element, range) {
      try {
        // Edge has similar requirements to Chrome for surroundContents
        // Check if range can be safely wrapped
        if (!range || range.collapsed) {
          return false;
        }

        // Validate range boundaries
        const startNode = range.startContainer;
        const endNode = range.endContainer;

        // Edge requires same parent for surroundContents
        if (startNode.parentNode !== endNode.parentNode) {
          return false;
        }

        // Attempt to wrap
        range.surroundContents(element);
        return true;
      } catch (error) {
        return false;
      }
    }
  };

  // Edge selection handling
  const edgeSelectionCompat = {
    // Get selection with Edge-specific handling
    getSelection: function() {
      try {
        const selection = window.getSelection();
        
        // Edge may return null in some contexts
        if (!selection) {
          return null;
        }

        // Validate selection
        if (selection.rangeCount === 0) {
          return null;
        }

        return selection;
      } catch (error) {
        return null;
      }
    },

    // Get selected text with Edge normalization
    getSelectedText: function() {
      const selection = this.getSelection();
      if (!selection) {
        return '';
      }

      const text = selection.toString().trim();
      
      // Edge may include extra whitespace
      return text.replace(/\s+/g, ' ');
    }
  };

  // Edge event handling compatibility
  const edgeEventCompat = {
    // Add event listener with Edge-specific options
    addEventListener: function(element, event, handler, options) {
      // Edge supports passive listeners for better performance
      const edgeOptions = {
        ...options,
        passive: false // We need to preventDefault in some cases
      };

      element.addEventListener(event, handler, edgeOptions);
    },

    // Remove event listener
    removeEventListener: function(element, event, handler) {
      element.removeEventListener(event, handler);
    }
  };

  // Edge animation compatibility
  const edgeAnimationCompat = {
    // Request animation frame with Edge optimization
    requestAnimationFrame: function(callback) {
      // Edge supports requestAnimationFrame (Chromium-based)
      return window.requestAnimationFrame(callback);
    },

    // Cancel animation frame
    cancelAnimationFrame: function(id) {
      window.cancelAnimationFrame(id);
    }
  };

  // Edge storage compatibility
  const edgeStorageCompat = {
    // Check if storage is available
    isStorageAvailable: function() {
      try {
        // Edge uses chrome.* API (Chromium-based)
        return typeof chrome !== 'undefined' && 
               chrome.storage && 
               chrome.storage.local;
      } catch (error) {
        return false;
      }
    }
  };

  // Edge-specific performance optimizations
  const edgePerformanceCompat = {
    // Use Edge-specific performance APIs if available
    mark: function(name) {
      if (window.performance && window.performance.mark) {
        window.performance.mark(name);
      }
    },

    measure: function(name, startMark, endMark) {
      if (window.performance && window.performance.measure) {
        try {
          window.performance.measure(name, startMark, endMark);
        } catch (error) {
          // Ignore measurement errors
        }
      }
    }
  };

  // Export Edge compatibility utilities
  window.edgeCompat = {
    keyboard: edgeKeyboardHandler,
    dom: edgeDOMCompat,
    selection: edgeSelectionCompat,
    events: edgeEventCompat,
    animation: edgeAnimationCompat,
    storage: edgeStorageCompat,
    performance: edgePerformanceCompat
  };

  // Edge-specific initialization
  if (typeof chrome !== 'undefined' && navigator.userAgent.includes('Edg')) {
    // We're running in Edge
    
    // Add Edge-specific class to body for CSS targeting
    if (document.body) {
      document.body.classList.add('edge-extension');
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.body.classList.add('edge-extension');
      });
    }
  }

})();
