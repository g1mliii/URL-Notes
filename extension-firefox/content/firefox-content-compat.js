// Firefox-Specific Content Script Compatibility Layer
// This file provides Firefox-specific adaptations for content script functionality

(function() {
  'use strict';

  // Firefox CSP (Content Security Policy) compatibility
  // Firefox has stricter CSP enforcement, so we need to ensure all injected styles are CSP-compliant

  // Override style injection to use CSP-safe methods
  const originalCreateElement = document.createElement.bind(document);
  
  // Firefox keyboard shortcut handling
  // Firefox may handle some keyboard shortcuts differently than Chrome
  const firefoxKeyboardHandler = {
    // Map of Firefox-specific key codes
    keyMap: {
      'Esc': 'Escape',
      'Del': 'Delete',
      'Left': 'ArrowLeft',
      'Right': 'ArrowRight',
      'Up': 'ArrowUp',
      'Down': 'ArrowDown'
    },

    // Normalize keyboard events for Firefox
    normalizeKey: function(event) {
      let key = event.key;
      
      // Handle Firefox-specific key names
      if (this.keyMap[key]) {
        key = this.keyMap[key];
      }

      return key;
    },

    // Check if keyboard shortcut should be handled
    shouldHandle: function(event) {
      // Firefox may have different default shortcuts
      // Ensure our shortcuts don't conflict with Firefox defaults
      
      // Allow Ctrl+Shift+H for multi-highlight (not a Firefox default)
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

  // Firefox DOM manipulation compatibility
  const firefoxDOMCompat = {
    // Firefox may handle Range operations differently
    createSafeRange: function(selection) {
      try {
        if (!selection || selection.rangeCount === 0) {
          return null;
        }

        const range = selection.getRangeAt(0);
        
        // Firefox validation: ensure range is valid
        if (!range.startContainer || !range.endContainer) {
          return null;
        }

        // Clone range to avoid modifying original
        return range.cloneRange();
      } catch (error) {
        return null;
      }
    },

    // Firefox-safe element insertion
    safeInsertNode: function(node, range) {
      try {
        // Firefox may throw errors on certain insertions
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

    // Firefox-safe element wrapping
    safeWrapRange: function(element, range) {
      try {
        // Firefox has stricter requirements for surroundContents
        // Check if range can be safely wrapped
        if (!range || range.collapsed) {
          return false;
        }

        // Validate range boundaries
        const startNode = range.startContainer;
        const endNode = range.endContainer;

        // Firefox requires same parent for surroundContents
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

  // Firefox selection handling
  const firefoxSelectionCompat = {
    // Get selection with Firefox-specific handling
    getSelection: function() {
      try {
        const selection = window.getSelection();
        
        // Firefox may return null in some contexts
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

    // Get selected text with Firefox normalization
    getSelectedText: function() {
      const selection = this.getSelection();
      if (!selection) {
        return '';
      }

      const text = selection.toString().trim();
      
      // Firefox may include extra whitespace
      return text.replace(/\s+/g, ' ');
    }
  };

  // Firefox event handling compatibility
  const firefoxEventCompat = {
    // Add event listener with Firefox-specific options
    addEventListener: function(element, event, handler, options) {
      // Firefox supports passive listeners for better performance
      const firefoxOptions = {
        ...options,
        passive: false // We need to preventDefault in some cases
      };

      element.addEventListener(event, handler, firefoxOptions);
    },

    // Remove event listener
    removeEventListener: function(element, event, handler) {
      element.removeEventListener(event, handler);
    }
  };

  // Firefox animation compatibility
  const firefoxAnimationCompat = {
    // Request animation frame with Firefox optimization
    requestAnimationFrame: function(callback) {
      // Firefox supports requestAnimationFrame
      return window.requestAnimationFrame(callback);
    },

    // Cancel animation frame
    cancelAnimationFrame: function(id) {
      window.cancelAnimationFrame(id);
    }
  };

  // Firefox storage compatibility
  const firefoxStorageCompat = {
    // Check if storage is available
    isStorageAvailable: function() {
      try {
        // Firefox may have different storage availability
        return typeof browser !== 'undefined' && 
               browser.storage && 
               browser.storage.local;
      } catch (error) {
        return false;
      }
    }
  };

  // Export Firefox compatibility utilities
  window.firefoxCompat = {
    keyboard: firefoxKeyboardHandler,
    dom: firefoxDOMCompat,
    selection: firefoxSelectionCompat,
    events: firefoxEventCompat,
    animation: firefoxAnimationCompat,
    storage: firefoxStorageCompat
  };

  // Firefox-specific initialization
  if (typeof browser !== 'undefined') {
    // We're running in Firefox
    
    // Add Firefox-specific class to body for CSS targeting
    if (document.body) {
      document.body.classList.add('firefox-extension');
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.body.classList.add('firefox-extension');
      });
    }
  }

})();
