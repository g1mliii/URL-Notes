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
      // Check cached premium status first to avoid API calls
      const result = await chrome.storage.local.get(['settings', 'userTier', 'premiumStatus', 'lastPremiumCheck']);
      const settings = result.settings || {};

      // Check cached premium status
      let isPremium = false;
      if (result.premiumStatus && result.lastPremiumCheck) {
        const cacheAge = Date.now() - result.lastPremiumCheck;
        const cacheValid = cacheAge < (24 * 60 * 60 * 1000); // 24 hours

        if (cacheValid) {
          isPremium = result.premiumStatus.tier === 'premium' || result.premiumStatus.tier === 'pro';
        }
      }

      // Fallback to userTier if no cached premium status
      if (!result.premiumStatus) {
        const userTier = result.userTier || 'free';
        isPremium = userTier === 'premium' || userTier === 'pro';
      }

      // Only show ads to free users who haven't disabled them
      return !isPremium && settings.showAds !== false;
    } catch (error) {
      console.error('Error checking ad settings:', error);
      return true; // Default to showing ads for free users
    }
  }

  // Load CodeFuel SDK dynamically (currently disabled)
  async loadCodeFuelSDK() {
    return new Promise((resolve) => {
      // Skip CodeFuel SDK loading for now to prevent CSP errors
      // This will be enabled when CodeFuel is properly configured
      console.log('CodeFuel SDK loading skipped - using fallback ads');
      window.__cf_sdk_failed = true;
      resolve();
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

      // Show ad container with animation
      if (this.adContainer) {
        this.adContainer.style.display = 'block';
        this.adContainer.classList.add('show');
      }

      // Load ad content
      await this.loadAd();

      // Update tracking
      this.lastAdTime = Date.now();
      this.adsShownThisHour++;

      // Track ad impression - disabled (using NordVPN analytics)
      // this.trackAdImpression();

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

    // For now, skip CodeFuel integration and go directly to fallback
    // This prevents errors when CodeFuel isn't implemented
    try {
      // CodeFuel integration (disabled until properly configured)
      if (window.CodeFuel && this.adConfig.publisherId !== 'YOUR_CODEFUEL_PUBLISHER_ID') {
        window.CodeFuel.display({
          containerId: 'adContent',
          publisherId: this.adConfig.publisherId,
          adUnitId: this.adConfig.adUnitId,
          size: '300x50',
          targeting: await this.getTargetingData()
        });
      } else {
        // Use our custom ad system (NordVPN + upgrade ads)
        this.showFallbackAd();
      }
    } catch (error) {
      console.warn('Error loading external ads, using fallback:', error);
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

    // Rotate between three ads: NordVPN (50%), Vrbo (30%), Upgrade (20%)
    const random = Math.random();
    let adType;
    
    if (random < 0.5) {
      adType = 'nordvpn';
      this.showNordVPNAd();
    } else if (random < 0.8) {
      adType = 'vrbo';
      this.showVrboAd();
    } else {
      adType = 'upgrade';
      this.showUpgradeAd();
    }

    console.log('Showing ad type:', adType);
  }

  // Show NordVPN affiliate ad
  showNordVPNAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.innerHTML = `
      <div class="nordvpn-ad" id="nordvpnAdBanner">
        <img src="../assets/affiliate-sales-campaign-nordvpn.png" 
             alt="NordVPN - Secure Your Browsing" 
             class="nordvpn-banner"
             loading="lazy">
      </div>
    `;

    // Add click event listener (CSP compliant)
    const nordvpnAd = document.getElementById('nordvpnAdBanner');
    if (nordvpnAd) {
      nordvpnAd.addEventListener('click', () => {
        this.openNordVPN();
      });
    }

    this.addNordVPNStyles();
  }

  // Show Vrbo affiliate ad
  showVrboAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.innerHTML = `
      <div class="vrbo-ad" id="vrboAdBanner">
        <img src="../assets/vrbo.gif" 
             alt="Vrbo - Book Your Perfect Vacation Rental" 
             class="vrbo-banner"
             loading="lazy">
      </div>
    `;

    // Add click event listener (CSP compliant)
    const vrboAd = document.getElementById('vrboAdBanner');
    if (vrboAd) {
      vrboAd.addEventListener('click', () => {
        this.openVrbo();
      });
    }

    this.addVrboStyles();
  }

  // Show upgrade ad
  showUpgradeAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.innerHTML = `
      <div class="fallback-ad">
        <div class="ad-text">
          <strong>Upgrade to Premium</strong>
          <p>Remove ads and sync across devices</p>
        </div>
        <button class="upgrade-btn" id="upgradeAdButton">
          Upgrade Now
        </button>
      </div>
    `;

    // Add click event listener (CSP compliant)
    const upgradeBtn = document.getElementById('upgradeAdButton');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        this.openUpgrade();
      });
    }

    this.addFallbackStyles();
  }

  // Add NordVPN ad styles
  addNordVPNStyles() {
    if (document.getElementById('nordvpn-ad-styles')) return;

    const style = document.createElement('style');
    style.id = 'nordvpn-ad-styles';
    style.textContent = `
      .nordvpn-ad {
        display: block;
        width: 100%;
        cursor: pointer;
        border-radius: 6px;
        overflow: hidden;
        transition: all 0.2s ease;
        border: 1px solid rgba(70, 135, 255, 0.2);
        box-shadow: 0 2px 8px rgba(70, 135, 255, 0.1);
      }
      .nordvpn-ad:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(70, 135, 255, 0.2);
        border-color: rgba(70, 135, 255, 0.4);
      }
      .nordvpn-banner {
        width: 100%;
        height: auto;
        display: block;
        max-height: 58px;
        object-fit: contain;
        object-position: center;
        background: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  // Add Vrbo ad styles
  addVrboStyles() {
    if (document.getElementById('vrbo-ad-styles')) return;

    const style = document.createElement('style');
    style.id = 'vrbo-ad-styles';
    style.textContent = `
      .vrbo-ad {
        display: block;
        width: 100%;
        cursor: pointer;
        border-radius: 6px;
        overflow: hidden;
        transition: all 0.2s ease;
        border: 1px solid rgba(255, 140, 0, 0.2);
        box-shadow: 0 2px 8px rgba(255, 140, 0, 0.1);
      }
      .vrbo-ad:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 140, 0, 0.2);
        border-color: rgba(255, 140, 0, 0.4);
      }
      .vrbo-banner {
        width: 100%;
        height: auto;
        display: block;
        max-height: 58px;
        object-fit: contain;
        object-position: center;
        background: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  // Add fallback ad styles
  addFallbackStyles() {
    if (document.getElementById('fallback-ad-styles')) return;

    const style = document.createElement('style');
    style.id = 'fallback-ad-styles';
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
      .fallback-ad .ad-text {
        flex: 1;
      }
      .fallback-ad .ad-text strong {
        color: var(--text-primary);
        font-size: 12px;
      }
      .fallback-ad .ad-text p {
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
      this.adContainer.classList.remove('show');
      // Hide after animation completes
      setTimeout(() => {
        this.adContainer.style.display = 'none';
      }, 300);
    }
  }

  // Track ad impression for analytics
  trackAdImpression() {
    try {
      // Send impression data to analytics (optional - won't break if background script isn't ready)
      chrome.runtime.sendMessage({
        action: 'trackAdImpression',
        data: {
          timestamp: Date.now(),
          adUnit: this.adConfig.adUnitId,
          domain: window.location?.hostname || 'unknown'
        }
      }).catch(() => {
        // Silently ignore messaging errors
      });
    } catch (error) {
      // Silently ignore tracking errors to prevent breaking ad display
      console.warn('Ad impression tracking failed:', error);
    }
  }

  // Handle upgrade button click
  openUpgrade() {
    chrome.tabs.create({
      url: 'https://anchored.site' // TODO: Change to direct premium signup when subscription service is implemented
    });
    // this.trackAdClick('upgrade'); // Disabled - using NordVPN analytics
  }

  // Handle NordVPN affiliate click
  openNordVPN() {
    chrome.tabs.create({
      url: 'https://go.nordvpn.net/aff_c?offer_id=15&aff_id=130711&url_id=902'
    });
    // this.trackAdClick('nordvpn'); // Disabled - using NordVPN analytics
  }

  // Handle Vrbo affiliate click
  openVrbo() {
    chrome.tabs.create({
      url: 'https://www.jdoqocy.com/click-101532226-13820699'
    });
    // this.trackAdClick('vrbo'); // Disabled - using affiliate analytics
  }

  // Handle ad click
  onAdClick(adType = 'unknown') {
    // this.trackAdClick(adType); // Disabled - using NordVPN analytics
  }

  // Track ad click
  trackAdClick(adType = 'unknown') {
    try {
      // Send click data to analytics (optional - won't break if background script isn't ready)
      chrome.runtime.sendMessage({
        action: 'trackAdClick',
        data: {
          timestamp: Date.now(),
          adUnit: this.adConfig.adUnitId,
          adType: adType
        }
      }).catch(() => {
        // Silently ignore messaging errors
      });
    } catch (error) {
      // Silently ignore tracking errors to prevent breaking ad functionality
      console.warn('Ad click tracking failed:', error);
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
