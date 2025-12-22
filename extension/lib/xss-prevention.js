/**
 * XSS Prevention Utility for Anchored Extension
 * Provides safe DOM manipulation methods using DOMPurify
 */

if (typeof DOMPurify === 'undefined') {
  // DOMPurify should be loaded via script tag in popup.html
}

class XSSPrevention {
  constructor() {
    this.isReady = typeof DOMPurify !== 'undefined';
    
    if (this.isReady) {
      // Configure DOMPurify for rich text editing
      this.richTextConfig = {
        ALLOWED_TAGS: [
          'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'a', 'br', 'img', 'div'
        ],
        ALLOWED_ATTR: [
          'href', 'target', 'rel', 'style', 'src', 'alt', 'class', 'id', 'loading'
        ],
        ALLOWED_SCHEMES: ['http', 'https', 'mailto'],
        ALLOW_DATA_ATTR: false,
        SANITIZE_DOM: true,
        KEEP_CONTENT: true,
        // Allow specific style properties for color formatting
        ALLOWED_CSS_PROPERTIES: ['color'],
        // Custom hook to validate style attributes
        HOOKS: {
          beforeSanitizeAttributes: (node) => {
            if (node.hasAttribute('style')) {
              const style = node.getAttribute('style');
              // Only allow color styles that match our format
              if (!/^color:\s*[#a-zA-Z0-9\(\),\s\.]+$/.test(style)) {
                node.removeAttribute('style');
              }
            }
            // Ensure external links have proper attributes
            if (node.tagName === 'A' && node.hasAttribute('href')) {
              const href = node.getAttribute('href');
              if (href.startsWith('http://') || href.startsWith('https://')) {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
              }
            }
            // Allow safe image sources (extension assets and https)
            if (node.tagName === 'IMG' && node.hasAttribute('src')) {
              const src = node.getAttribute('src');
              // Allow extension assets and https images
              if (!src.startsWith('../assets/') && !src.startsWith('https://') && !src.startsWith('data:image/')) {
                node.removeAttribute('src');
              }
            }
          }
        }
      };

      // Basic config for simple content (no rich text)
      this.basicConfig = {
        ALLOWED_TAGS: ['br', 'img', 'div', 'button', 'strong', 'p'],
        ALLOWED_ATTR: ['src', 'alt', 'class', 'id', 'loading'],
        SANITIZE_DOM: true,
        KEEP_CONTENT: true,
        HOOKS: {
          beforeSanitizeAttributes: (node) => {
            // Allow safe image sources for ads
            if (node.tagName === 'IMG' && node.hasAttribute('src')) {
              const src = node.getAttribute('src');
              // Allow extension assets and https images
              if (!src.startsWith('../assets/') && !src.startsWith('https://') && !src.startsWith('data:image/')) {
                node.removeAttribute('src');
              }
            }
          }
        }
      };
    }
  }

  /**
   * Sanitize HTML content for rich text editor
   * Preserves formatting tags needed for the editor
   */
  sanitizeRichText(html) {
    if (!this.isReady) {
      return this.fallbackSanitize(html);
    }

    try {
      return DOMPurify.sanitize(html, this.richTextConfig);
    } catch (error) {
      return this.fallbackSanitize(html);
    }
  }

  /**
   * Sanitize HTML content for basic display (no rich text)
   * Only allows line breaks
   */
  sanitizeBasic(html) {
    if (!this.isReady) {
      return this.fallbackSanitize(html);
    }

    try {
      return DOMPurify.sanitize(html, this.basicConfig);
    } catch (error) {
      return this.fallbackSanitize(html);
    }
  }

  /**
   * Fallback sanitization when DOMPurify is not available
   * Strips all HTML tags except basic formatting
   */
  fallbackSanitize(html) {
    if (!html) return '';
    
    // Create a temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove script tags and their content
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove dangerous attributes
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      // Remove event handlers
      const attributes = [...el.attributes];
      attributes.forEach(attr => {
        if (attr.name.startsWith('on') || 
            attr.name === 'javascript:' ||
            attr.name === 'data-' ||
            (attr.name === 'style' && attr.value.includes('javascript:'))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    return temp.innerHTML;
  }

  /**
   * Safe method to set innerHTML with sanitization
   */
  safeSetInnerHTML(element, html, useRichText = false) {
    if (!element) return;
    
    const sanitized = useRichText ? 
      this.sanitizeRichText(html) : 
      this.sanitizeBasic(html);
    
    element.innerHTML = sanitized;
  }

  /**
   * Safe method to insert HTML at cursor position
   */
  safeInsertHTML(html, useRichText = false) {
    const sanitized = useRichText ? 
      this.sanitizeRichText(html) : 
      this.sanitizeBasic(html);
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      document.execCommand('insertHTML', false, sanitized);
      return;
    }
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(sanitized);
    range.insertNode(fragment);
  }

  /**
   * Validate and sanitize user input before processing
   */
  validateInput(input, maxLength = 10000) {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Truncate if too long
    if (input.length > maxLength) {
      input = input.substring(0, maxLength);
    }
    
    // Basic validation - reject if contains suspicious patterns
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /on\w+\s*=/gi
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(input)) {
        return '';
      }
    }
    
    return input;
  }

  /**
   * Create safe DOM elements with text content
   */
  createSafeElement(tagName, textContent = '', attributes = {}) {
    const element = document.createElement(tagName);
    
    // Set text content safely
    if (textContent) {
      element.textContent = textContent;
    }
    
    // Set safe attributes
    for (const [key, value] of Object.entries(attributes)) {
      // Only allow safe attributes
      const safeAttributes = ['class', 'id', 'title', 'href', 'target', 'rel', 'data-*'];
      const isSafe = safeAttributes.some(safe => 
        safe.endsWith('*') ? key.startsWith(safe.slice(0, -1)) : key === safe
      );
      
      if (isSafe && typeof value === 'string') {
        element.setAttribute(key, value);
      }
    }
    
    return element;
  }

  /**
   * Safe method to append HTML content to an element
   */
  safeAppendHTML(element, html, useRichText = false) {
    if (!element) return;
    
    const sanitized = useRichText ? 
      this.sanitizeRichText(html) : 
      this.sanitizeBasic(html);
    
    const temp = document.createElement('div');
    temp.innerHTML = sanitized;
    
    while (temp.firstChild) {
      element.appendChild(temp.firstChild);
    }
  }

  /**
   * Test XSS prevention with known malicious payloads
   */
  runSecurityTests() {
    if (!this.isReady) {
      return false;
    }

    const maliciousPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<div onclick="alert(\'XSS\')">Click me</div>',
      '<a href="javascript:alert(\'XSS\')">Link</a>',
      '<style>body{background:url("javascript:alert(\'XSS\')")}</style>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '"><script>alert("XSS")</script>',
      '\'-alert(String.fromCharCode(88,83,83))-\'',
      '<svg onload="alert(\'XSS\')">',
      '<object data="javascript:alert(\'XSS\')"></object>'
    ];

    let allTestsPassed = true;

    maliciousPayloads.forEach((payload, index) => {
      const sanitized = this.sanitizeRichText(payload);

      const hasDangerousContent =
        sanitized.includes('<script') ||
        sanitized.includes('javascript:') ||
        sanitized.includes('onerror=') ||
        sanitized.includes('onclick=') ||
        sanitized.includes('onload=') ||
        sanitized.includes('<iframe') ||
        sanitized.includes('<object');

      if (hasDangerousContent) {
        allTestsPassed = false;
      }
    });

    return allTestsPassed;
  }
}

// Create global instance
window.xssPrevention = new XSSPrevention();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = XSSPrevention;
}