// DOM Sanitizer - XSS Prevention Library for Web Application
// Uses DOMPurify for content sanitization

class DOMSanitizer {
  constructor() {
    this.purify = null;
    this.isInitialized = false;
    this.initPromise = null;

    // Configuration for different content types
    this.configs = {
      // Rich text for note content (preserves ALL extension formatting)
      richText: {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'span', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onmousedown', 'onmouseup'],
        ADD_ATTR: ['target', 'rel', 'style'],
        ADD_TAGS: ['span'],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        SANITIZE_DOM: true,
        // Allow safe CSS properties for colors and formatting
        ALLOWED_CSS: {
          'color': true,
          'font-style': true,
          'font-weight': true,
          'text-decoration': true,
          'cursor': true
        }
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

  // Synchronous initialization for when DOMPurify is already loaded
  initSync() {
    if (this.isInitialized) {
      return this.purify;
    }

    if (window.DOMPurify) {
      this.purify = window.DOMPurify;
      this.isInitialized = true;
      return this.purify;
    } else {
      // Use fallback sanitizer
      this.purify = this.createFallbackSanitizer();
      this.isInitialized = true;
      return this.purify;
    }
  }

  async loadDOMPurify() {
    try {
      // Check if DOMPurify is already available
      if (window.DOMPurify) {
        this.purify = window.DOMPurify;
        this.isInitialized = true;
        return this.purify;
      }

      // Try to load DOMPurify from local file
      if (typeof window !== 'undefined') {
        // Check if script is already loading/loaded
        const existingScript = document.querySelector('script[src*="purify.min.js"]');
        if (existingScript) {
          // Wait a bit for existing script to load
          await new Promise(resolve => setTimeout(resolve, 100));
          if (window.DOMPurify) {
            this.purify = window.DOMPurify;
            this.isInitialized = true;
            return this.purify;
          }
        }

        // Create new script element to load DOMPurify locally
        const script = document.createElement('script');
        script.src = 'js/lib/purify.min.js';
        script.async = false; // Ensure synchronous loading

        // Wait for script to load with timeout
        const loadPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('DOMPurify loading timeout'));
          }, 5000); // 5 second timeout

          script.onload = () => {
            clearTimeout(timeout);
            // Give DOMPurify a moment to initialize
            setTimeout(() => {
              if (window.DOMPurify) {
                resolve();
              } else {
                reject(new Error('DOMPurify not available after load'));
              }
            }, 50);
          };

          script.onerror = (error) => {
            clearTimeout(timeout);
            reject(error);
          };
        });

        document.head.appendChild(script);
        await loadPromise;
      }

      if (window.DOMPurify) {
        this.purify = window.DOMPurify;
        this.isInitialized = true;
        return this.purify;
      } else {
        throw new Error('DOMPurify not available after loading');
      }
    } catch (error) {
      // Fallback to basic HTML escaping
      this.purify = this.createFallbackSanitizer();
      this.isInitialized = true;
      return this.purify;
    }
  }

  createFallbackSanitizer() {
    // Enhanced fallback sanitizer using basic HTML escaping and filtering
    return {
      sanitize: (dirty, config) => {
        if (!dirty) return '';

        // For rich text, allow some basic safe tags
        if (config && config.ALLOWED_TAGS && config.ALLOWED_TAGS.length > 0) {
          // Create a temporary div to parse HTML
          const temp = document.createElement('div');
          temp.innerHTML = dirty;

          // Remove all script tags and event handlers
          const scripts = temp.querySelectorAll('script');
          scripts.forEach(script => script.remove());

          // Clean up attributes on all elements
          const allElements = temp.querySelectorAll('*');
          allElements.forEach(el => {
            const tagName = el.tagName.toLowerCase();
            
            // Remove event handler attributes and dangerous attributes
            const attributes = [...el.attributes];
            attributes.forEach(attr => {
              const attrName = attr.name.toLowerCase();
              
              // Remove event handlers
              if (attrName.startsWith('on')) {
                el.removeAttribute(attr.name);
                return;
              }
              
              // Remove javascript: URLs
              if (attr.value && attr.value.toLowerCase().includes('javascript:')) {
                el.removeAttribute(attr.name);
                return;
              }
              
              // For style attributes, only allow safe CSS properties
              if (attrName === 'style') {
                const safeStyles = [];
                const styles = attr.value.split(';');
                styles.forEach(style => {
                  const [prop, value] = style.split(':').map(s => s.trim());
                  if (prop && value) {
                    // Allow safe CSS properties for formatting
                    if (['color', 'font-style', 'font-weight', 'text-decoration', 'cursor'].includes(prop.toLowerCase())) {
                      safeStyles.push(`${prop}: ${value}`);
                    }
                  }
                });
                if (safeStyles.length > 0) {
                  el.setAttribute('style', safeStyles.join('; '));
                } else {
                  el.removeAttribute('style');
                }
                return;
              }
              
              // Keep only allowed attributes
              const allowedAttrs = ['href', 'target', 'rel', 'style', 'class'];
              if (!allowedAttrs.includes(attrName)) {
                el.removeAttribute(attr.name);
              }
            });
            
            // Remove disallowed tags but keep content
            if (!config.ALLOWED_TAGS.includes(tagName)) {
              // Replace with text content
              const textNode = document.createTextNode(el.textContent);
              el.parentNode.replaceChild(textNode, el);
            }
          });

          return temp.innerHTML;
        } else {
          // Plain text fallback - escape all HTML
          const div = document.createElement('div');
          div.textContent = dirty;
          return div.innerHTML;
        }
      }
    };
  }

  // Sanitize rich text content (for note content)
  async sanitizeRichText(content) {
    if (!content) return '';

    // Try synchronous initialization first
    let purify = this.initSync();
    if (!purify) {
      purify = await this.init();
    }
    return purify.sanitize(content, this.configs.richText);
  }

  // Sanitize to plain text only
  async sanitizePlainText(content) {
    if (!content) return '';

    // Try synchronous initialization first
    let purify = this.initSync();
    if (!purify) {
      purify = await this.init();
    }
    return purify.sanitize(content, this.configs.plainText);
  }

  // Sanitize safe HTML for UI elements
  async sanitizeSafeHtml(content) {
    if (!content) return '';

    // Try synchronous initialization first
    let purify = this.initSync();
    if (!purify) {
      purify = await this.init();
    }
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