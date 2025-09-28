// Utility Functions Module
// Contains helper functions used throughout the application

class Utils {
  // Generate a unique ID
  static generateId() {
    // Use crypto.randomUUID() if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback to UUID v4 format for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Helper to format dates
  static formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);

    // If within last 24 hours, show time
    if (diffHours < 24) {
      return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    // Otherwise show date
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  // Debounce utility
  static debounce(func, delay) {
    let timeout;
    const debounced = (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
    debounced.cancel = () => {
      clearTimeout(timeout);
    };
    return debounced;
  }

  // Show a toast notification with premium glassmorphism styling
  // Optimized for sync notifications as the benchmark for all toasts
  static showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Remove any existing type classes and animations
    toast.classList.remove('success', 'error', 'info', 'warning', 'show');

    // Add the appropriate type class
    toast.classList.add(type);

    // Clean icons without emojis for better consistency
    let icon = '•'; // Default info icon
    if (type === 'success') icon = '✓'; // Simple checkmark for success
    if (type === 'error') icon = '✗'; // Simple X for errors
    if (type === 'warning') icon = '!'; // Simple exclamation for warnings

    // Set content with icon and enhanced styling
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${Utils.escapeHtml(message)}</span>`;

    // Show toast with smooth animation
    toast.classList.add('show');

    // Auto-hide after 4 seconds for sync notifications (longer to read)
    const hideDelay = message.toLowerCase().includes('sync') ? 4000 : 3000;
    setTimeout(() => {
      toast.classList.remove('show');
    }, hideDelay);
  }

  // Check storage quota and update UI
  static async checkStorageQuota() {
    const usage = await navigator.storage.estimate();
    const quota = usage.quota;
    const usageInMB = (usage.usage / (1024 * 1024)).toFixed(2);
    const quotaInMB = (quota / (1024 * 1024)).toFixed(2);
    const percentage = ((usage.usage / quota) * 100).toFixed(1);

    const storageBar = document.getElementById('storageUsageBar');
    const storageText = document.getElementById('storageUsageText');

    if (storageBar && storageText) {
      storageBar.style.width = `${percentage}%`;
      storageText.textContent = `${usageInMB} MB / ${quotaInMB} MB (${percentage}%)`;

      if (percentage > 90) {
        storageBar.style.backgroundColor = 'var(--color-danger)';
      } else if (percentage > 70) {
        storageBar.style.backgroundColor = 'var(--color-warning)';
      } else {
        storageBar.style.backgroundColor = 'var(--accent-primary)';
      }
    }
  }

  // Sanitize HTML content to prevent XSS
  static sanitizeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  // Escape HTML entities
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Validate URL format
  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Extract domain from URL
  static extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (_) {
      return 'unknown';
    }
  }

  // Truncate text to specified length
  static truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Deep clone an object
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = Utils.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  // Check if element is in viewport
  static isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // Smooth scroll to element
  static scrollToElement(element, offset = 0) {
    if (!element) return;
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }

  // Get file extension from filename
  static getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }

  // Format file size in human readable format
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Wait for specified time (async delay)
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retry function with exponential backoff
  static async retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;

        const delay = baseDelay * Math.pow(2, attempt - 1);
        await Utils.delay(delay);
      }
    }
    throw lastError;
  }

  // Check if object is empty
  static isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    return Object.keys(obj).length === 0;
  }

  // Merge objects deeply
  static deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = Utils.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    return result;
  }
}

// Simple pub/sub event bus for cross-module communication
class EventBus {
  constructor() {
    this._events = {};
  }

  // Subscribe to an event
  on(event, handler) {
    if (!this._events[event]) this._events[event] = new Set();
    this._events[event].add(handler);
    return () => this.off(event, handler);
  }

  // Unsubscribe
  off(event, handler) {
    const set = this._events[event];
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) delete this._events[event];
  }

  // Emit an event with optional payload
  emit(event, payload) {
    const set = this._events[event];
    if (!set) return;
    for (const handler of Array.from(set)) {
      try { handler(payload); } catch (e) { /* handler error silently handled */ }
    }
  }
}

// Export to global scope
window.Utils = Utils;
window.EventBus = EventBus;
window.eventBus = window.eventBus || new EventBus();
