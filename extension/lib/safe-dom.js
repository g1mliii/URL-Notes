/**
 * Safe DOM Manipulation Utility
 * Provides XSS-safe alternatives to innerHTML and other dangerous DOM methods
 */

class SafeDOM {
  constructor() {
    this.xssPrevention = window.xssPrevention;
  }

  /**
   * Safe alternative to element.innerHTML = html
   * @param {Element} element - Target element
   * @param {string} html - HTML content to set
   * @param {boolean} useRichText - Whether to allow rich text formatting
   */
  setInnerHTML(element, html, useRichText = false) {
    if (!element) {
      console.warn('SafeDOM.setInnerHTML: element is null or undefined');
      return;
    }

    if (this.xssPrevention) {
      this.xssPrevention.safeSetInnerHTML(element, html, useRichText);
    } else {
      // Fallback: use textContent for safety
      console.warn('XSS prevention not available, using textContent fallback');
      element.textContent = this.stripHTML(html);
    }
  }

  /**
   * Safe alternative to insertHTML command
   * @param {string} html - HTML content to insert
   * @param {boolean} useRichText - Whether to allow rich text formatting
   */
  insertHTML(html, useRichText = false) {
    if (this.xssPrevention) {
      this.xssPrevention.safeInsertHTML(html, useRichText);
    } else {
      // Fallback: insert as plain text
      console.warn('XSS prevention not available, inserting as plain text');
      document.execCommand('insertText', false, this.stripHTML(html));
    }
  }

  /**
   * Safe method to append HTML content
   * @param {Element} element - Target element
   * @param {string} html - HTML content to append
   * @param {boolean} useRichText - Whether to allow rich text formatting
   */
  appendHTML(element, html, useRichText = false) {
    if (!element) {
      console.warn('SafeDOM.appendHTML: element is null or undefined');
      return;
    }

    if (this.xssPrevention) {
      this.xssPrevention.safeAppendHTML(element, html, useRichText);
    } else {
      // Fallback: create text node
      console.warn('XSS prevention not available, appending as text');
      const textNode = document.createTextNode(this.stripHTML(html));
      element.appendChild(textNode);
    }
  }

  /**
   * Create a safe element with text content and attributes
   * @param {string} tagName - Element tag name
   * @param {string} textContent - Text content
   * @param {Object} attributes - Element attributes
   * @returns {Element} Created element
   */
  createElement(tagName, textContent = '', attributes = {}) {
    if (this.xssPrevention) {
      return this.xssPrevention.createSafeElement(tagName, textContent, attributes);
    } else {
      // Fallback implementation
      const element = document.createElement(tagName);
      if (textContent) {
        element.textContent = textContent;
      }
      
      // Only set safe attributes
      const safeAttributes = ['class', 'id', 'title', 'href', 'target', 'rel'];
      for (const [key, value] of Object.entries(attributes)) {
        if (safeAttributes.includes(key) && typeof value === 'string') {
          element.setAttribute(key, value);
        }
      }
      
      return element;
    }
  }

  /**
   * Strip HTML tags from content
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  stripHTML(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  /**
   * Validate and sanitize user input
   * @param {string} input - User input
   * @param {number} maxLength - Maximum length
   * @returns {string} Sanitized input
   */
  validateInput(input, maxLength = 10000) {
    if (this.xssPrevention) {
      return this.xssPrevention.validateInput(input, maxLength);
    } else {
      // Basic fallback validation
      if (typeof input !== 'string') return '';
      return input.substring(0, maxLength);
    }
  }

  /**
   * Safe method to update element content based on content type
   * @param {Element} element - Target element
   * @param {string} content - Content to set
   * @param {string} contentType - Type of content ('text', 'html', 'richtext')
   */
  setContent(element, content, contentType = 'text') {
    if (!element) return;

    switch (contentType) {
      case 'text':
        element.textContent = content;
        break;
      case 'html':
        this.setInnerHTML(element, content, false);
        break;
      case 'richtext':
        this.setInnerHTML(element, content, true);
        break;
      default:
        element.textContent = content;
    }
  }

  /**
   * Clear element content safely
   * @param {Element} element - Target element
   */
  clearContent(element) {
    if (!element) return;
    
    // Remove all child nodes
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Replace element content with new content
   * @param {Element} element - Target element
   * @param {string} content - New content
   * @param {string} contentType - Type of content
   */
  replaceContent(element, content, contentType = 'text') {
    if (!element) return;
    
    this.clearContent(element);
    this.setContent(element, content, contentType);
  }
}

// Create global instance
window.safeDOM = new SafeDOM();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SafeDOM;
}