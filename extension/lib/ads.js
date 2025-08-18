// URL Notes Extension - CodeFuel Ads Integration
// Handles ad loading and display for free tier users

class AdManager {
  constructor() {
    this.adContainer = null;
    this.adLoaded = false;
    this.adConfig = {
      publisherId: 'YOUR_CODEFUEL_PUBLISHER_ID', // Replace with actual ID
      adUnitId: 'url-notes-popup-banner',
      maxAdsPerHour: 5,
      cooldownMs: 12 * 60 * 1000, // 12 minutes between ads
    };
    this.lastAdTime = 0;
    this.adsShownThisHour = 0;
    this.hourlyResetTime = Date.now() + (60 * 60 * 1000);
  }

  // Initialize ad system
  async init() {
    this.adContainer = document.getElementById('adContainer');
    if (!this.adContainer) {
      console.warn('Ad container not found');
      return;
    }

    // Check if user should see ads
    const shouldShowAds = await this.shouldShowAds();
    if (!shouldShowAds) {
      this.hideAdContainer();
      return;
    }

    // Load CodeFuel SDK
    await this.loadCodeFuelSDK();
    
    // Show first ad after a delay
    setTimeout(() => this.showAd(), 2000);
  }

  // Check if user should see ads (free tier, ads enabled)
  async shouldShowAds() {
    try {
      const result = await chrome.storage.local.get(['settings', 'userTier']);
      const settings = result.settings || {};
      const userTier = result.userTier || 'free';

      return userTier === 'free' && settings.showAds !== false;
    } catch (error) {
      console.error('Error checking ad settings:', error);
      return true; // Default to showing ads
    }
  }

  // Load CodeFuel SDK dynamically
  async loadCodeFuelSDK() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.CodeFuel) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.codefuel.com/js/cf-sdk.js'; // Replace with actual CodeFuel SDK URL
      script.async = true;
      script.onload = () => {
        console.log('CodeFuel SDK loaded');
        resolve();
      };
      script.onerror = () => {
        console.error('Failed to load CodeFuel SDK');
        reject(new Error('CodeFuel SDK load failed'));
      };
      
      document.head.appendChild(script);
    });
  }

  // Show an ad
  async showAd() {
    if (!await this.canShowAd()) {
      return;
    }

    try {
      // Reset hourly counter if needed
      if (Date.now() > this.hourlyResetTime) {
        this.adsShownThisHour = 0;
        this.hourlyResetTime = Date.now() + (60 * 60 * 1000);
      }

      // Show ad container
      this.adContainer.style.display = 'block';
      
      // Load ad content
      await this.loadAd();
      
      // Update tracking
      this.lastAdTime = Date.now();
      this.adsShownThisHour++;
      
      // Track ad impression
      this.trackAdImpression();
      
    } catch (error) {
      console.error('Error showing ad:', error);
      this.showFallbackAd();
    }
  }

  // Check if we can show an ad
  async canShowAd() {
    const now = Date.now();
    
    // Check cooldown
    if (now - this.lastAdTime < this.adConfig.cooldownMs) {
      return false;
    }

    // Check hourly limit
    if (this.adsShownThisHour >= this.adConfig.maxAdsPerHour) {
      return false;
    }

    // Check user preferences
    return await this.shouldShowAds();
  }

  // Load actual ad content
  async loadAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    // CodeFuel integration (replace with actual implementation)
    if (window.CodeFuel) {
      window.CodeFuel.display({
        containerId: 'adContent',
        publisherId: this.adConfig.publisherId,
        adUnitId: this.adConfig.adUnitId,
        size: '300x50',
        targeting: await this.getTargetingData()
      });
    } else {
      // Fallback if SDK not loaded
      this.showFallbackAd();
    }
  }

  // Get targeting data for contextual ads
  async getTargetingData() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return {};

      const url = new URL(tab.url);
      return {
        domain: url.hostname,
        category: this.categorizeWebsite(url.hostname),
        language: navigator.language || 'en',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting targeting data:', error);
      return {};
    }
  }

  // Categorize website for better ad targeting
  categorizeWebsite(domain) {
    const categories = {
      'github.com': 'technology',
      'stackoverflow.com': 'technology',
      'reddit.com': 'social',
      'youtube.com': 'entertainment',
      'netflix.com': 'entertainment',
      'amazon.com': 'shopping',
      'ebay.com': 'shopping',
      'news.ycombinator.com': 'technology',
      'medium.com': 'content',
      'dev.to': 'technology'
    };

    // Check for exact matches
    if (categories[domain]) {
      return categories[domain];
    }

    // Check for partial matches
    if (domain.includes('shop') || domain.includes('store')) return 'shopping';
    if (domain.includes('news')) return 'news';
    if (domain.includes('blog')) return 'content';
    if (domain.includes('tech') || domain.includes('dev')) return 'technology';

    return 'general';
  }

  // Show fallback ad when CodeFuel fails
  showFallbackAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.innerHTML = `
      <div class="fallback-ad">
        <div class="ad-text">
          <strong>Upgrade to Premium</strong>
          <p>Remove ads and sync across devices</p>
        </div>
        <button class="upgrade-btn" onclick="window.adManager.openUpgrade()">
          Upgrade Now
        </button>
      </div>
    `;

    // Add fallback ad styles
    const style = document.createElement('style');
    style.textContent = `
      .fallback-ad {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--bg-tertiary);
        border-radius: 6px;
        border: 1px solid var(--border-color);
      }
      .ad-text {
        flex: 1;
      }
      .ad-text strong {
        color: var(--text-primary);
        font-size: 12px;
      }
      .ad-text p {
        color: var(--text-secondary);
        font-size: 11px;
        margin: 2px 0 0 0;
      }
      .upgrade-btn {
        background: var(--accent-primary);
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .upgrade-btn:hover {
        background: var(--accent-secondary);
      }
    `;
    document.head.appendChild(style);
  }

  // Hide ad container
  hideAdContainer() {
    if (this.adContainer) {
      this.adContainer.style.display = 'none';
    }
  }

  // Track ad impression for analytics
  trackAdImpression() {
    try {
      // Send impression data to analytics
      chrome.runtime.sendMessage({
        action: 'trackAdImpression',
        data: {
          timestamp: Date.now(),
          adUnit: this.adConfig.adUnitId,
          domain: window.location.hostname
        }
      });
    } catch (error) {
      console.error('Error tracking ad impression:', error);
    }
  }

  // Handle upgrade button click
  openUpgrade() {
    chrome.tabs.create({
      url: 'https://urlnotes.app/upgrade' // Replace with actual upgrade URL
    });
  }

  // Handle ad click
  onAdClick() {
    this.trackAdClick();
  }

  // Track ad click
  trackAdClick() {
    try {
      chrome.runtime.sendMessage({
        action: 'trackAdClick',
        data: {
          timestamp: Date.now(),
          adUnit: this.adConfig.adUnitId
        }
      });
    } catch (error) {
      console.error('Error tracking ad click:', error);
    }
  }

  // Refresh ad (called when popup is reopened)
  refreshAd() {
    if (this.canShowAd()) {
      setTimeout(() => this.showAd(), 1000);
    }
  }

  // Clean up
  destroy() {
    this.hideAdContainer();
  }
}

// Export singleton instance
window.adManager = new AdManager();
