// URL Notes Extension - Static Ads Integration
// Handles ad loading and display for free tier users

class AdManager {
  constructor() {
    this.adContainer = null;
    this.adLoaded = false;
    this.adConfig = {
      maxAdsPerHour: 5,
      cooldownMs: 12 * 60 * 1000,
      displayDurationMs: 6 * 1000, 
      nextAdDelayMs: 30 * 1000, 
    };
    this.lastAdTime = 0;
    this.adsShownThisHour = 0;
    this.hourlyResetTime = Date.now() + (60 * 60 * 1000);
    this.currentAdTimeout = null;
    this.nextAdTimeout = null;
    this.storageKey = 'adTrackingData';
  }

  async loadAdTrackingData() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey];

      if (data) {
        this.lastAdTime = data.lastAdTime || 0;
        this.adsShownThisHour = data.adsShownThisHour || 0;
        this.hourlyResetTime = data.hourlyResetTime || (Date.now() + (60 * 60 * 1000));

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


  async init() {
    this.adContainer = document.getElementById('adContainer');
    if (!this.adContainer) {
      return;
    }

    // Load persistent ad tracking data first
    await this.loadAdTrackingData();

    const shouldShowAds = await this.shouldShowAds();
    if (!shouldShowAds) {
      this.hideAdContainer();
      return;
    }

    setTimeout(() => this.showAd(), 3000);
  }

  // Check if user should see ads (free tier, ads enabled, reached engagement tier)
  async shouldShowAds() {
    try {
    
      const result = await chrome.storage.local.get([
        'settings', 
        'userTier', 
        'premiumStatus', 
        'lastPremiumCheck',
        'userEngagement_noteCount'
      ]);
      const settings = result.settings || {};

     
      let isPremium = false;
      if (result.premiumStatus && result.lastPremiumCheck) {
        const cacheAge = Date.now() - result.lastPremiumCheck;
        const cacheValid = cacheAge < (24 * 60 * 60 * 1000); 

        if (cacheValid) {
          isPremium = result.premiumStatus.tier === 'premium' || result.premiumStatus.tier === 'pro';
        }
      }

      
      if (!result.premiumStatus) {
        const userTier = result.userTier || 'free';
        isPremium = userTier === 'premium' || userTier === 'pro';
      }

      
      const noteCount = result.userEngagement_noteCount || 0;
      const hasReachedEngagementTier = noteCount >= 3;

      // Only show ads to free users who:
      // 1. Haven't disabled ads
      // 2. Have reached the first engagement tier (3+ notes)
      return !isPremium && settings.showAds !== false && hasReachedEngagementTier;
    } catch (error) {
      return false; // Default to NOT showing ads if there's an error
    }
  }


  async showAd() {
    if (!await this.canShowAd()) {
      return;
    }

    try {
      const now = Date.now();
      if (now > this.hourlyResetTime) {
        this.adsShownThisHour = 0;
        this.hourlyResetTime = now + (60 * 60 * 1000);
      }

      if (this.adContainer) {
        this.adContainer.style.display = 'block';
        this.adContainer.classList.add('show');
      }

      await this.loadAd();
      this.lastAdTime = now;
      this.adsShownThisHour++;
      await this.saveAdTrackingData();
      this.scheduleAdHide();

    } catch (error) {
      this.showFallbackAd();
      const now = Date.now();
      this.lastAdTime = now;
      this.adsShownThisHour++;
      await this.saveAdTrackingData();
      this.scheduleAdHide();
    }
  }


  async canShowAd() {
    const now = Date.now();
    if (now > this.hourlyResetTime) {
      this.adsShownThisHour = 0;
      this.hourlyResetTime = now + (60 * 60 * 1000);
      await this.saveAdTrackingData();
    }

    const minCooldown = this.adConfig.displayDurationMs + this.adConfig.nextAdDelayMs;
    if (now - this.lastAdTime < minCooldown) {
      return false;
    }

    if (this.adsShownThisHour >= this.adConfig.maxAdsPerHour) {
      return false;
    }

    return await this.shouldShowAds();
  }

  async loadAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    this.showFallbackAd();
  }


  showFallbackAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

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

  showNordVPNAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.textContent = '';
    
    const adDiv = document.createElement('div');
    adDiv.className = 'nordvpn-ad';
    adDiv.id = 'nordvpnAdBanner';
    
    const img = document.createElement('img');
    img.src = '../assets/affiliate-sales-campaign-nordvpn.png';
    img.alt = 'NordVPN - Secure Your Browsing';
    img.className = 'nordvpn-banner';
    img.loading = 'lazy';
    
    adDiv.appendChild(img);
    adContent.appendChild(adDiv);

    const nordvpnAd = document.getElementById('nordvpnAdBanner');
    if (nordvpnAd) {
      nordvpnAd.addEventListener('click', () => {
        this.openNordVPN();
      });
    }

    this.addNordVPNStyles();
  }

  showVrboAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.textContent = '';
    
    const adDiv = document.createElement('div');
    adDiv.className = 'vrbo-ad';
    adDiv.id = 'vrboAdBanner';
    
    const img = document.createElement('img');
    img.src = '../assets/vrbo.gif';
    img.alt = 'Vrbo - Book Your Perfect Vacation Rental';
    img.className = 'vrbo-banner';
    img.loading = 'lazy';
    
    adDiv.appendChild(img);
    adContent.appendChild(adDiv);
    const vrboAd = document.getElementById('vrboAdBanner');
    if (vrboAd) {
      vrboAd.addEventListener('click', () => {
        this.openVrbo();
      });
    }

    this.addVrboStyles();
  }


  showNewBannerAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.textContent = '';

    const adDiv = document.createElement('div');
    adDiv.className = 'newbanner-ad';
    adDiv.id = 'newBannerAdBanner';
    
    const img = document.createElement('img');
    img.src = '../assets/15575447-1729241297568.png';
    img.alt = 'Special Offer - Click to Learn More';
    img.className = 'newbanner-banner';
    img.loading = 'lazy';
    
    adDiv.appendChild(img);
    adContent.appendChild(adDiv);

    const newBannerAd = document.getElementById('newBannerAdBanner');
    if (newBannerAd) {
      newBannerAd.addEventListener('click', () => {
        this.openNewBanner();
      });
    }

    this.addNewBannerStyles();
  }


  showUpgradeAd() {
    const adContent = document.getElementById('adContent');
    if (!adContent) return;

    adContent.textContent = '';
    
    const adDiv = document.createElement('div');
    adDiv.className = 'fallback-ad';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'ad-text';
    
    const strong = document.createElement('strong');
    strong.textContent = 'Upgrade to Premium';
    
    const p = document.createElement('p');
    p.textContent = 'Remove ads and sync across devices';
    
    textDiv.appendChild(strong);
    textDiv.appendChild(p);
    
    const button = document.createElement('button');
    button.className = 'upgrade-btn';
    button.id = 'upgradeAdButton';
    button.textContent = 'Upgrade Now';
    
    adDiv.appendChild(textDiv);
    adDiv.appendChild(button);
    adContent.appendChild(adDiv);

    const upgradeBtn = document.getElementById('upgradeAdButton');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        this.openUpgrade();
      });
    }

    this.addFallbackStyles();
  }


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


  scheduleAdHide() {
    if (this.currentAdTimeout) {
      clearTimeout(this.currentAdTimeout);
    }

    this.currentAdTimeout = setTimeout(() => {

      this.hideAdContainer();
      // Schedule next ad
      this.scheduleNextAd();
    }, this.adConfig.displayDurationMs);
  }


  scheduleNextAd() {
    if (this.nextAdTimeout) {
      clearTimeout(this.nextAdTimeout);
    }



    this.nextAdTimeout = setTimeout(async () => {
      if (await this.canShowAd()) {
        this.showAd();
      } else {

      }
    }, this.adConfig.nextAdDelayMs);
  }


  hideAdContainer() {
    if (this.adContainer) {
      this.adContainer.classList.remove('show');
      setTimeout(() => {
        this.adContainer.style.display = 'none';
      }, 300);
    }
  }


  trackAdImpression() {
    try {
      chrome.runtime.sendMessage({
        action: 'trackAdImpression',
        data: {
          timestamp: Date.now(),
          domain: window.location?.hostname || 'unknown'
        }
      }).catch(() => {
      });
    } catch (error) {
    }
  }


  openUpgrade() {
    let targetUrl = 'https://anchored.site'; // Default to main page

    try {
      // If user is authenticated, redirect to account page for subscription management
      if (window.supabaseClient && window.supabaseClient.isAuthenticated()) {
        targetUrl = 'https://anchored.site/account';
      }
    } catch (error) {
    }

    chrome.tabs.create({
      url: targetUrl
    });
  }


  openNordVPN() {
    chrome.tabs.create({
      url: 'https://go.nordvpn.net/aff_c?offer_id=15&aff_id=130711&url_id=902'
    });
  }

  openVrbo() {
    chrome.tabs.create({
      url: 'https://www.jdoqocy.com/click-101532226-13820699'
    });
  }

  openNewBanner() {
    chrome.tabs.create({
      url: 'https://www.tkqlhce.com/click-101532226-15575456'
    });
  }

  onAdClick(adType = 'unknown') {

  }


  trackAdClick(adType = 'unknown') {
    try {
      chrome.runtime.sendMessage({
        action: 'trackAdClick',
        data: {
          timestamp: Date.now(),
          adType: adType
        }
      }).catch(() => {
      });
    } catch (error) {
    }
  }


  async refreshAd() {
    if (this.currentAdTimeout) {
      clearTimeout(this.currentAdTimeout);
      this.currentAdTimeout = null;
    }
    if (this.nextAdTimeout) {
      clearTimeout(this.nextAdTimeout);
      this.nextAdTimeout = null;
    }

    await this.loadAdTrackingData();

    if (await this.canShowAd()) {
      setTimeout(() => this.showAd(), 1000);
    }
  }


  destroy() {

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

window.adManager = new AdManager();
