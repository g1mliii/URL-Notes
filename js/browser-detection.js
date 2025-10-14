/**
 * Browser Detection Module
 * Detects user's browser and provides appropriate extension store links
 */

(function() {
  'use strict';

  const BrowserDetection = {
    // Extension store URLs
    STORE_URLS: {
      chrome: 'https://chromewebstore.google.com/detail/anchored-%E2%80%93-notes-highligh/llkmfidpbpfgdgjlohgpomdjckcfkllg',
      firefox: 'https://addons.mozilla.org/firefox/addon/anchored-notes/', // TODO: Update with actual Firefox store URL
      edge: 'https://microsoftedge.microsoft.com/addons/detail/anchored-notes/', // TODO: Update with actual Edge store URL
      safari: null // Coming soon
    },

    /**
     * Detect the user's browser
     * @returns {Object} Browser info with name and version
     */
    detectBrowser: function() {
      const ua = navigator.userAgent;
      const vendor = navigator.vendor || '';

      // Edge (Chromium-based) - Must check before Chrome
      if (ua.indexOf('Edg/') > -1 || ua.indexOf('Edge/') > -1) {
        return {
          name: 'edge',
          displayName: 'Microsoft Edge',
          version: this._extractVersion(ua, /Edg\/(\d+)/)
        };
      }

      // Firefox
      if (ua.indexOf('Firefox') > -1 && ua.indexOf('Seamonkey') === -1) {
        return {
          name: 'firefox',
          displayName: 'Firefox',
          version: this._extractVersion(ua, /Firefox\/(\d+)/)
        };
      }

      // Safari - Must check before Chrome (Safari also contains Chrome in UA)
      if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1 && vendor.indexOf('Apple') > -1) {
        return {
          name: 'safari',
          displayName: 'Safari',
          version: this._extractVersion(ua, /Version\/(\d+)/)
        };
      }

      // Chrome (and Chromium-based browsers)
      if (ua.indexOf('Chrome') > -1 && vendor.indexOf('Google') > -1) {
        return {
          name: 'chrome',
          displayName: 'Chrome',
          version: this._extractVersion(ua, /Chrome\/(\d+)/)
        };
      }

      // Opera
      if (ua.indexOf('OPR') > -1 || ua.indexOf('Opera') > -1) {
        return {
          name: 'opera',
          displayName: 'Opera',
          version: this._extractVersion(ua, /OPR\/(\d+)/)
        };
      }

      // Brave (difficult to detect, falls back to Chrome)
      // Brave doesn't have unique UA string, treat as Chrome
      
      // Default fallback
      return {
        name: 'unknown',
        displayName: 'Unknown Browser',
        version: null
      };
    },

    /**
     * Extract version number from user agent string
     * @private
     */
    _extractVersion: function(ua, regex) {
      const match = ua.match(regex);
      return match ? parseInt(match[1], 10) : null;
    },

    /**
     * Get the appropriate extension store URL for the detected browser
     * @returns {string|null} Store URL or null if not available
     */
    getStoreUrl: function() {
      const browser = this.detectBrowser();
      
      // Map browser to store URL
      switch (browser.name) {
        case 'chrome':
        case 'opera':
        case 'brave':
          return this.STORE_URLS.chrome; // Chrome Web Store works for Chromium browsers
        
        case 'firefox':
          return this.STORE_URLS.firefox;
        
        case 'edge':
          return this.STORE_URLS.edge;
        
        case 'safari':
          return this.STORE_URLS.safari; // null - coming soon
        
        default:
          return this.STORE_URLS.chrome; // Fallback to Chrome Web Store
      }
    },

    /**
     * Get browser-specific messaging
     * @returns {Object} Message object with title and description
     */
    getBrowserMessage: function() {
      const browser = this.detectBrowser();
      
      switch (browser.name) {
        case 'chrome':
          return {
            title: 'Get Anchored for Chrome',
            description: 'Install from Chrome Web Store',
            available: true
          };
        
        case 'firefox':
          return {
            title: 'Get Anchored for Firefox',
            description: 'Install from Firefox Add-ons',
            available: true
          };
        
        case 'edge':
          return {
            title: 'Get Anchored for Edge',
            description: 'Install from Edge Add-ons',
            available: true
          };
        
        case 'safari':
          return {
            title: 'Coming Soon for Safari',
            description: 'Safari support is in development. Sign up to be notified when it\'s ready!',
            available: false
          };
        
        case 'opera':
          return {
            title: 'Get Anchored for Opera',
            description: 'Install from Chrome Web Store (compatible with Opera)',
            available: true
          };
        
        default:
          return {
            title: 'Get Anchored',
            description: 'Install from Chrome Web Store',
            available: true
          };
      }
    },

    /**
     * Update all extension links on the page
     */
    updateExtensionLinks: function() {
      const storeUrl = this.getStoreUrl();
      const message = this.getBrowserMessage();
      const browser = this.detectBrowser();

      // Update all links with class 'chrome-store-link'
      const links = document.querySelectorAll('.chrome-store-link, .btn-primary[href*="chromewebstore"]');
      
      links.forEach(link => {
        if (message.available && storeUrl) {
          link.href = storeUrl;
          
          // Update button text if it's a primary button
          if (link.classList.contains('btn-primary')) {
            const textNode = Array.from(link.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
              textNode.textContent = message.title;
            }
          }
        } else {
          // Safari - disable link and show coming soon message
          link.href = '#';
          link.style.cursor = 'not-allowed';
          link.style.opacity = '0.6';
          
          if (link.classList.contains('btn-primary')) {
            const textNode = Array.from(link.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
              textNode.textContent = message.title;
            }
          }
          
          // Add click handler to show message
          link.addEventListener('click', function(e) {
            e.preventDefault();
            alert(message.description);
          });
        }
      });

      // Update the description text below the CTA button
      const ctaDescription = document.querySelector('.chrome-store-cta p');
      if (ctaDescription && message.available) {
        const browserName = browser.displayName;
        const storeName = browser.name === 'firefox' ? 'Firefox Add-ons' : 
                         browser.name === 'edge' ? 'Edge Add-ons' : 
                         'Chrome Web Store';
        
        ctaDescription.innerHTML = `Available now on ${storeName} • This web app is for premium sync only`;
      }

      // Log detection for debugging
      console.log('Browser detected:', browser);
      console.log('Store URL:', storeUrl);
      console.log('Message:', message);
    },

    /**
     * Initialize browser detection on page load
     */
    init: function() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.updateExtensionLinks());
      } else {
        this.updateExtensionLinks();
      }
    }
  };

  // Export to global scope
  window.BrowserDetection = BrowserDetection;

  // Auto-initialize
  BrowserDetection.init();
})();
