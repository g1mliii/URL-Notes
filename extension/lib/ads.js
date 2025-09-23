// URL Notes Extension - Static Ads Integration
// Handles ad loading and display for free tier users

class AdManager {
  constructor() {
    this.adContainer = null;
    this.adLoaded = false;
    this.adConfig = {
      maxAdsPerHour: 5,
      cooldownMs: 12 * 60 * 1000, // 12 minutes between ads
      displayDurationMs: 6 * 1000, // 6 seconds display time
      nextAdDelayMs: 30 * 1000, // 30 seconds until next ad
    };
    this.lastAdTime = 0;
    this.adsShownThisHour = 0;
    this.hourlyResetTime = Date.now() + (60 * 60 * 1000);
    this.currentAdTimeout = null;
    this.nextAdTimeout = null;
    this.storageKey = 'adTrackingData';
  }

  // Load ad tracking data from storage
  async loadAdTrackingData() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey];

      if (data) {
        this.lastAdTime = data.lastAdTime || 0;
        this.adsShownThisHour = data.adsShownThisHour || 0;
        this.hourlyResetTime = data.hourlyResetTime || (Date.now() + (60 * 60 * 1000));

        // Check if we need to reset the hourly counter
        const now = Date.now();
        if (now > this.hourlyResetTime) {
          this.adsShownThisHour = 0;
          this.hourlyResetTime = now + (60 * 60 * 1000);
          await this.saveAdTrackingData();
        }
      }
    } catch (error) {
      console.warn('Failed to load ad tracking data:', error);
    }
  }

  // Save ad tracking data to storage
  async saveAdTrackingData() {
    try {
      const data = {
        lastAdTime: this.lastAdTime,
        adsShownThisHour: this.adsShownThisHour,
        hourlyResetTime: this.hourlyResetTime,
        updatedAt: Date.now()
      };

      await chrome.storage.local.set({ [this.storageKey]: data });
    } catch (error) {
      console.warn('Failed to save ad tracking data:', error);
    }
  }

  // Initialize ad system
  async init() {
    this.adContainer = document.getElementById('adContainer');
    if (!this.adContainer) {
      return;
    }

    // Load persistent ad tracking data first
    await this.loadAdTrackingData();

    // Check if user should see ads
    const shouldShowAds = await this.shouldShowAds();
    if (!shouldShowAds) {
      this.hideAdContainer();
      return;
    }

    // Show first ad after a delay
    setTimeout(() => this.showAd(), 3000); // 3 seconds initial delay
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
      return true; // Default to showing ads for free users
    }
  }



  // Show an ad
  async showAd() {
    if (!await this.canShowAd()) {
      return;
    }

    try {
      // Reset hourly counter if needed
      const now = Date.now();
      if (now > this.hourlyResetTime) {
        this.adsShownThisHour = 0;
        this.hourlyResetTime = now + (60 * 60 * 1000);
      }

      // Show ad container with animation
      if (this.adContainer) {
        this.adContainer.style.display = 'block';
        this.adContainer.classList.add('show');
      }

      // Load ad content
      await this.loadAd();

      // Update tracking
      this.lastAdTime = now;
      this.adsShownThisHour++;

      // Save tracking data to persistent storage
      await this.saveAdTrackingData();

      // Schedule ad to hide after display duration
      this.scheduleAdHide();

    } catch (error) {
      this.showFallbackAd();
      // Still update tracking and save for fallback ads
      const now = Date.now();
      this.lastAdTime = now;
      this.adsShownThisHour++;
      await this.saveAdTrackingData();
      // Still schedule hide even for fallback ads
      this.scheduleAdHide();
    }
  }

  // Check if we can show an ad
  async canShowAd() {
    const now = Date.now();

    // Check if we need to reset the hourly counter
    if (now > this.hourlyResetTime) {
      this.adsShownThisHour = 0;
      this.hourlyResetTime = now + (60 * 60 * 1000);
      await this.saveAdTrackingData();
    }

    // Check minimum cooldown (display duration + next ad delay)
    const minCooldown = this.adConfig.displayDurationMs + this.adConfig.nextAdDelayMs;
    if (now - this.lastAdTime < minCooldown) {
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

    // Use our static ad system (NordVPN + upgrade ads)
    this.showFallbackAd();
  }



  // Show fallback ad
  showFallbackAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    // Rotate between four ads: Upgrade (50%), NordVPN (16.7%), Vrbo (16.7%), New Banner (16.6%)
    const random = Math.random();
    let adType;

    if (random < 0.50) {
      adType = 'upgrade';
      this.showUpgradeAd();
    } else if (random < 0.667) {
      adType = 'nordvpn';
      this.showNordVPNAd();
    } else if (random < 0.834) {
      adType = 'vrbo';
      this.showVrboAd();
    } else {
      adType = 'newbanner';
      this.showNewBannerAd();
    }
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

  // Show new banner affiliate ad
  showNewBannerAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.innerHTML = `
      <div class="newbanner-ad" id="newBannerAdBanner">
        <img src="../assets/15575447-1729241297568.png" 
             alt="Special Offer - Click to Learn More" 
             class="newbanner-banner"
             loading="lazy">
      </div>
    `;

    // Add click event listener (CSP compliant)
    const newBannerAd = document.getElementById('newBannerAdBanner');
    if (newBannerAd) {
      newBannerAd.addEventListener('click', () => {
        this.openNewBanner();
      });
    }

    this.addNewBannerStyles();
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

  // Add new banner ad styles
  addNewBannerStyles() {
    if (document.getElementById('newbanner-ad-styles')) return;

    const style = document.createElement('style');
    style.id = 'newbanner-ad-styles';
    style.textContent = `
      .newbanner-ad {
        display: block;
        width: 100%;
        cursor: pointer;
        border-radius: 6px;
        overflow: hidden;
        transition: all 0.2s ease;
        border: 1px solid rgba(34, 197, 94, 0.2);
        box-shadow: 0 2px 8px rgba(34, 197, 94, 0.1);
      }
      .newbanner-ad:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
        border-color: rgba(34, 197, 94, 0.4);
      }
      .newbanner-banner {
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

  // Schedule ad to hide after display duration
  scheduleAdHide() {
    // Clear any existing timeout
    if (this.currentAdTimeout) {
      clearTimeout(this.currentAdTimeout);
    }



    // Schedule ad to hide after display duration
    this.currentAdTimeout = setTimeout(() => {

      this.hideAdContainer();
      // Schedule next ad
      this.scheduleNextAd();
    }, this.adConfig.displayDurationMs);
  }

  // Schedule next ad to show
  scheduleNextAd() {
    // Clear any existing timeout
    if (this.nextAdTimeout) {
      clearTimeout(this.nextAdTimeout);
    }


    // Schedule next ad after delay
    this.nextAdTimeout = setTimeout(async () => {

      // Check if we can still show ads
      if (await this.canShowAd()) {
        this.showAd();
      } else {

      }
    }, this.adConfig.nextAdDelayMs);
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
          domain: window.location?.hostname || 'unknown'
        }
      }).catch(() => {
        // Silently ignore messaging errors
      });
    } catch (error) {
      // Silently ignore tracking errors to prevent breaking ad display
    }
  }

  // Handle upgrade button click
  openUpgrade() {
    // Check if user is authenticated to determine redirect destination
    let targetUrl = 'https://anchored.site'; // Default to main page

    try {
      // If user is authenticated, redirect to account page for subscription management
      if (window.supabaseClient && window.supabaseClient.isAuthenticated()) {
        targetUrl = 'https://anchored.site/account';
      }
    } catch (error) {
      // Fall back to main page if there's an error
    }

    chrome.tabs.create({
      url: targetUrl
    });
  }

  // Handle NordVPN affiliate click
  openNordVPN() {
    chrome.tabs.create({
      url: 'https://go.nordvpn.net/aff_c?offer_id=15&aff_id=130711&url_id=902'
    });
  }

  // Handle Vrbo affiliate click
  openVrbo() {
    chrome.tabs.create({
      url: 'https://www.jdoqocy.com/click-101532226-13820699'
    });
  }

  // Handle new banner affiliate click
  openNewBanner() {
    chrome.tabs.create({
      url: 'https://www.tkqlhce.com/click-101532226-15575456'
    });
  }

  // Handle ad click
  onAdClick(adType = 'unknown') {
    // No tracking needed for static ads
  }

  // Track ad click
  trackAdClick(adType = 'unknown') {
    try {
      // Send click data to analytics (optional - won't break if background script isn't ready)
      chrome.runtime.sendMessage({
        action: 'trackAdClick',
        data: {
          timestamp: Date.now(),
          adType: adType
        }
      }).catch(() => {
        // Silently ignore messaging errors
      });
    } catch (error) {
      // Silently ignore tracking errors to prevent breaking ad functionality
    }
  }

  // Refresh ad (called when popup is reopened)
  async refreshAd() {
    // Clear any existing timeouts to avoid conflicts
    if (this.currentAdTimeout) {
      clearTimeout(this.currentAdTimeout);
      this.currentAdTimeout = null;
    }
    if (this.nextAdTimeout) {
      clearTimeout(this.nextAdTimeout);
      this.nextAdTimeout = null;
    }

    // Load current tracking data
    await this.loadAdTrackingData();

    // Check if we can show an ad
    if (await this.canShowAd()) {
      setTimeout(() => this.showAd(), 1000);
    }
  }

  // Clean up
  destroy() {
    // Clear any scheduled timeouts
    if (this.currentAdTimeout) {
      clearTimeout(this.currentAdTimeout);
      this.currentAdTimeout = null;
    }
    if (this.nextAdTimeout) {
      clearTimeout(this.nextAdTimeout);
      this.nextAdTimeout = null;
    }
    this.hideAdContainer();
  }
}

// Export singleton instance
window.adManager = new AdManager();
