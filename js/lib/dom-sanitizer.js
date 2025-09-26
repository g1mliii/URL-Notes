// DOM Sanitizer - XSS Prevention Library for Web Application
// Uses DOMPurify for content sanitization

class DOMSanitizer {
  constructor() {
    this.purify = null;
    this.isInitialized = false;
    this.initPromise = null;
    
    // Configuration for different content types
    this.configs = {
      // Basic rich text for note content (allows common formatting)
      richText: {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
        ADD_ATTR: ['target', 'rel'],
        ADD_TAGS: [],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        SANITIZE_DOM: true
      },
      
      // Plain text only (strips all HTML)
      plainText: {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
      },
      
      // Safe HTML for UI elements (very restrictive)
      safeHtml: {
        ALLOWED_TAGS: ['span', 'div', 'p', 'strong', 'em', 'br'],
        ALLOWED_ATTR: ['class', 'id'],
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'a'],
        FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
      }
    };
  }

  async init() {
    if (this.isInitialized) {
      return this.purify;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadDOMPurify();
    return this.initPromise;
  }

  async loadDOMPurify() {
    try {
      // Load DOMPurify from CDN for web application
      if (typeof window !== 'undefined' && !window.DOMPurify) {
        // Create script element to load DOMPurify
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js';
        script.crossOrigin = 'anonymous';
        
        // Wait for script to load
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (window.DOMPurify) {
        this.purify = window.DOMPurify;
        this.isInitialized = true;
        return this.purify;
      } else {
        throw new Error('DOMPurify failed to load');
      }
    } catch (error) {
      console.error('Failed to load DOMPurify:', error);
      // Fallback to basic HTML escaping
      this.purify = this.createFallbackSanitizer();
      this.isInitialized = true;
      return this.purify;
    }
  }

  createFallbackSanitizer() {
    // Fallback sanitizer using basic HTML escaping
    return {
      sanitize: (dirty, config) => {
        if (!dirty) return '';
        
        // Basic HTML escaping
        const div = document.createElement('div');
        div.textContent = dirty;
        return div.innerHTML;
      }
    };
  }

  // Sanitize rich text content (for note content)
  async sanitizeRichText(content) {
    if (!content) return '';
    
    const purify = await this.init();
    return purify.sanitize(content, this.configs.richText);
  }

  // Sanitize to plain text only
  async sanitizePlainText(content) {
    if (!content) return '';
    
    const purify = await this.init();
    return purify.sanitize(content, this.configs.plainText);
  }

  // Sanitize safe HTML for UI elements
  async sanitizeSafeHtml(content) {
    if (!content) return '';
    
    const purify = await this.init();
    return purify.sanitize(content, this.configs.safeHtml);
  }

  // Safe innerHTML replacement
  async safeSetInnerHTML(element, content, type = 'richText') {
    if (!element || !content) {
      if (element) element.innerHTML = '';
      return;
    }

    let sanitized;
    switch (type) {
      case 'plainText':
        sanitized = await this.sanitizePlainText(content);
        break;
      case 'safeHtml':
        sanitized = await this.sanitizeSafeHtml(content);
        break;
      case 'richText':
      default:
        sanitized = await this.sanitizeRichText(content);
        break;
    }

    element.innerHTML = sanitized;
  }

  // Safe textContent replacement (for when you want to preserve text only)
  safeSetTextContent(element, content) {
    if (!element) return;
    element.textContent = content || '';
  }

  // Validate and sanitize user input
  async validateInput(input, type = 'richText') {
    if (!input) return '';

    // Basic validation
    if (typeof input !== 'string') {
      input = String(input);
    }

    // Length limits
    const maxLengths = {
      title: 500,
      content: 50000,
      tag: 100,
      url: 2000,
      plainText: 10000
    };

    const maxLength = maxLengths[type] || maxLengths.content;
    if (input.length > maxLength) {
      input = input.substring(0, maxLength);
    }

    // Sanitize based on type
    switch (type) {
      case 'title':
      case 'tag':
        return await this.sanitizePlainText(input);
      case 'url':
        // Basic URL validation and sanitization
        try {
          const url = new URL(input);
          return url.toString();
        } catch {
          return await this.sanitizePlainText(input);
        }
      case 'content':
        return await this.sanitizeRichText(input);
      default:
        return await this.sanitizeRichText(input);
    }
  }

  // Create safe DOM elements
  createSafeElement(tagName, attributes = {}, textContent = '') {
    const element = document.createElement(tagName);
    
    // Whitelist of safe attributes
    const safeAttributes = ['class', 'id', 'data-note-id', 'data-export-id', 'href', 'target', 'rel', 'type', 'value', 'placeholder', 'disabled', 'checked'];
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (safeAttributes.includes(key)) {
        element.setAttribute(key, value);
      }
    });

    if (textContent) {
      element.textContent = textContent;
    }

    return element;
  }

  // Safe event listener attachment
  safeAddEventListener(element, event, handler, options = {}) {
    if (!element || !event || !handler) return;
    
    // Whitelist of safe events
    const safeEvents = ['click', 'change', 'input', 'submit', 'keydown', 'keyup', 'focus', 'blur', 'load', 'error'];
    
    if (safeEvents.includes(event)) {
      element.addEventListener(event, handler, options);
    }
  }
}

// Create global instance
window.domSanitizer = new DOMSanitizer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DOMSanitizer;
}