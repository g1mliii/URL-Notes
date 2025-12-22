// XSS-safe DOM manipulation utility
class SafeDOM {
  constructor() {
    this.xssPrevention = window.xssPrevention;
  }

  setInnerHTML(element, html, useRichText = false) {
    if (!element) {
      return;
    }

    if (this.xssPrevention) {
      this.xssPrevention.safeSetInnerHTML(element, html, useRichText);
    } else {
      element.textContent = this.stripHTML(html);
    }
  }

  insertHTML(html, useRichText = false) {
    if (this.xssPrevention) {
      this.xssPrevention.safeInsertHTML(html, useRichText);
    } else {
      document.execCommand('insertText', false, this.stripHTML(html));
    }
  }

  appendHTML(element, html, useRichText = false) {
    if (!element) {
      return;
    }

    if (this.xssPrevention) {
      this.xssPrevention.safeAppendHTML(element, html, useRichText);
    } else {
      const textNode = document.createTextNode(this.stripHTML(html));
      element.appendChild(textNode);
    }
  }

  createElement(tagName, textContent = '', attributes = {}) {
    if (this.xssPrevention) {
      return this.xssPrevention.createSafeElement(tagName, textContent, attributes);
    } else {
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

  stripHTML(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  validateInput(input, maxLength = 10000) {
    if (this.xssPrevention) {
      return this.xssPrevention.validateInput(input, maxLength);
    } else {
      if (typeof input !== 'string') return '';
      return input.substring(0, maxLength);
    }
  }

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

  clearContent(element) {
    if (!element) return;

    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  replaceContent(element, content, contentType = 'text') {
    if (!element) return;

    this.clearContent(element);
    this.setContent(element, content, contentType);
  }
}

window.safeDOM = new SafeDOM();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SafeDOM;
}