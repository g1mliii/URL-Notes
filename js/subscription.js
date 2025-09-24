// Subscription Management Module
class SubscriptionManager {
  constructor() {
    this.api = null;
    this.currentSubscription = null;
    this.init();
  }

  async init() {
    // Wait for API to be available with timeout
    let attempts = 0;
    while (!window.api && attempts < 20) { // Reduced from infinite polling
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.api) {
      this.api = window.api;
      
      // Check if user just returned from Stripe checkout
      const pendingCheckout = localStorage.getItem('pending_stripe_checkout');
      const checkoutTime = localStorage.getItem('checkout_initiated_at');
      
      if (pendingCheckout === 'true' && checkoutTime) {
        const timeSinceCheckout = Date.now() - parseInt(checkoutTime);
        // If checkout was initiated within last 10 minutes, force sync
        if (timeSinceCheckout < 10 * 60 * 1000) {
          console.log('🔄 Detected return from Stripe checkout - forcing subscription sync');
          
          // Clear the flags
          localStorage.removeItem('pending_stripe_checkout');
          localStorage.removeItem('checkout_initiated_at');
          
          // Force refresh subscription status
          await this.loadSubscriptionStatus(true);
          return;
        } else {
          // Old checkout flag, clear it
          localStorage.removeItem('pending_stripe_checkout');
          localStorage.removeItem('checkout_initiated_at');
        }
      }
      
      // Check if subscription data is already cached in app
      if (window.app?.subscriptionData) {
        this.currentSubscription = window.app.subscriptionData;
        this.updateSubscriptionUI();
      } else {
        // Only load if not cached
        await this.loadSubscriptionStatus();
      }
    }
  }

  async loadSubscriptionStatus(forceRefresh = false) {
    try {
      // Use centralized subscription data from app if available and recent
      if (!forceRefresh && window.app?.subscriptionData) {
        const cacheTime = localStorage.getItem('subscriptionCacheTime');
        if (cacheTime) {
          const age = Date.now() - parseInt(cacheTime);
          if (age < 5 * 60 * 1000) { // 5 minutes cache
            this.currentSubscription = window.app.subscriptionData;
            this.updateSubscriptionUI();
            this.updateDataSourceIndicator('cached', new Date(parseInt(cacheTime)));
            return; // Skip API call - use centralized data
          }
        }
      }

      // Check localStorage cache as fallback
      if (!forceRefresh) {
        const cachedData = localStorage.getItem('cachedSubscription');
        const cacheTime = localStorage.getItem('subscriptionCacheTime');
        
        if (cachedData && cacheTime) {
          const age = Date.now() - parseInt(cacheTime);
          if (age < 5 * 60 * 1000) { // 5 minutes cache
            this.currentSubscription = JSON.parse(cachedData);
            this.updateSubscriptionUI();
            this.updateDataSourceIndicator('cached', new Date(parseInt(cacheTime)));
            
            // Store in app for other modules to avoid duplicate calls
            if (window.app) {
              window.app.subscriptionData = this.currentSubscription;
            }
            
            window.eventBus.emit('subscription:updated', this.currentSubscription);
            return;
          }
        }
      }

      // Only make API call if no valid cache exists
      const response = await this.api.callFunction('subscription-api', {
        action: 'get_subscription_status'
      });

      if (response.error) {
        return;
      }

      this.currentSubscription = response;
      
      // Update all caches atomically
      localStorage.setItem('cachedSubscription', JSON.stringify(response));
      localStorage.setItem('subscriptionCacheTime', Date.now().toString());
      
      // Store in app for other modules
      if (window.app) {
        window.app.subscriptionData = response;
      }
      
      this.updateSubscriptionUI();
      this.updateDataSourceIndicator('fresh', new Date());
      
      // Emit to other modules
      window.eventBus.emit('subscription:updated', response);
    } catch (error) {
      // Error loading subscription status
    }
  }

  updateSubscriptionUI() {
    const statusBadge = document.getElementById('statusBadge');
    const statusDescription = document.getElementById('statusDescription');
    const statusExpiry = document.getElementById('statusExpiry');
    const expiryDate = document.getElementById('expiryDate');
    const upgradeBtn = document.getElementById('upgradeBtn');
    const manageSubscriptionBtn = document.getElementById('manageSubscriptionBtn');
    const viewBillingBtn = document.getElementById('viewBillingBtn');
    const subscriptionDetails = document.getElementById('subscriptionDetails');

    if (!this.currentSubscription) return;

    const isPremium = this.currentSubscription.subscription_tier === 'premium';

    // Update status badge
    if (statusBadge) {
      statusBadge.textContent = isPremium ? 'Premium' : 'Free';
      statusBadge.className = `status-badge ${isPremium ? 'premium' : 'free'}`;
    }

    // Update status description
    if (statusDescription) {
      if (isPremium) {
        statusDescription.textContent = 'You have access to all premium features';
      } else {
        statusDescription.textContent = 'You\'re on the free plan';
      }
    }

    // Handle expiry date
    if (statusExpiry && expiryDate) {
      if (this.currentSubscription.subscription_expires_at) {
        const expiry = new Date(this.currentSubscription.subscription_expires_at);
        expiryDate.textContent = expiry.toLocaleDateString();
        statusExpiry.classList.remove('hidden');
      } else {
        statusExpiry.classList.add('hidden');
      }
    }

    // Show/hide detailed subscription information
    if (subscriptionDetails) {
      if (isPremium && this.currentSubscription.has_stripe_customer) {
        subscriptionDetails.classList.remove('hidden');
        this.updateDetailedSubscriptionInfo();
      } else {
        subscriptionDetails.classList.add('hidden');
      }
    }

    // Show/hide buttons based on subscription status
    if (upgradeBtn && manageSubscriptionBtn) {
      if (isPremium && this.currentSubscription.has_stripe_customer) {
        upgradeBtn.classList.add('hidden');
        manageSubscriptionBtn.classList.remove('hidden');
      } else {
        upgradeBtn.classList.remove('hidden');
        manageSubscriptionBtn.classList.add('hidden');
      }
    }
  }

  async updateDetailedSubscriptionInfo() {
    // Update subscription status text
    const statusText = document.getElementById('subscriptionStatusText');
    if (statusText) {
      statusText.textContent = 'Active';
    }

    // Update next billing date (approximate - 30 days from now for active subscriptions)
    const nextBillingDate = document.getElementById('nextBillingDate');
    if (nextBillingDate) {
      if (this.currentSubscription.subscription_expires_at) {
        // If there's an expiry date, subscription is ending
        const expiry = new Date(this.currentSubscription.subscription_expires_at);
        nextBillingDate.textContent = `Ends ${expiry.toLocaleDateString()}`;
      } else {
        // Active subscription - estimate next billing
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        nextBillingDate.textContent = nextBilling.toLocaleDateString();
      }
    }

    // Load AI usage information
    await this.loadAIUsageInfo();
  }

  async loadAIUsageInfo() {
    try {
      const aiUsageInfo = document.getElementById('aiUsageInfo');
      if (!aiUsageInfo) return;

      // Use AI usage data from subscription status if available
      if (this.currentSubscription?.ai_usage) {
        const usage = this.currentSubscription.ai_usage;
        const remaining = usage.remainingCalls || 0;
        const limit = usage.monthlyLimit || 30;
        const used = limit - remaining;
        
        aiUsageInfo.textContent = `${used}/${limit} used this month`;
        
        // Add visual indicator for usage level
        const usagePercent = (used / limit) * 100;
        if (usagePercent >= 90) {
          aiUsageInfo.style.color = 'var(--error-color)';
        } else if (usagePercent >= 70) {
          aiUsageInfo.style.color = 'var(--warning-color)';
        } else {
          aiUsageInfo.style.color = 'var(--text-primary)';
        }
        return;
      }

      // Fallback: Get AI usage from the API directly
      const response = await this.api.rpc('check_ai_usage', {
        p_user_id: this.api.currentUser?.id,
        p_feature_name: 'overall'
      });

      if (response.data) {
        const usage = response.data;
        const remaining = usage.remainingCalls || 0;
        const limit = usage.monthlyLimit || 30;
        const used = limit - remaining;
        
        aiUsageInfo.textContent = `${used}/${limit} used this month`;
        
        // Add visual indicator for usage level
        const usagePercent = (used / limit) * 100;
        if (usagePercent >= 90) {
          aiUsageInfo.style.color = 'var(--error-color)';
        } else if (usagePercent >= 70) {
          aiUsageInfo.style.color = 'var(--warning-color)';
        } else {
          aiUsageInfo.style.color = 'var(--text-primary)';
        }
      } else {
        aiUsageInfo.textContent = 'Unable to load usage info';
      }
    } catch (error) {
      // Error loading AI usage info
      const aiUsageInfo = document.getElementById('aiUsageInfo');
      if (aiUsageInfo) {
        aiUsageInfo.textContent = 'Error loading usage';
      }
    }
  }

  async createCheckoutSession() {
    try {
      // Show loading state
      const upgradeBtn = document.getElementById('upgradeBtn');
      if (upgradeBtn) {
        upgradeBtn.disabled = true;
        upgradeBtn.textContent = 'Processing...';
      }

      // Set flag to force sync when user returns from Stripe
      localStorage.setItem('pending_stripe_checkout', 'true');
      localStorage.setItem('checkout_initiated_at', Date.now().toString());
      
      console.log('🚀 User initiated Stripe checkout - setting sync flag');

      const response = await this.api.callFunction('subscription-api', {
        action: 'create_checkout_session',
        origin: window.location.origin
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Redirect to Stripe Checkout
      window.location.href = response.url;
    } catch (error) {
      // Error creating checkout session
      this.showError('Failed to start subscription process. Please try again.');
      
      // Clear checkout flags since we're not going to Stripe
      localStorage.removeItem('pending_stripe_checkout');
      localStorage.removeItem('checkout_initiated_at');
      
      // Reset button state
      const upgradeBtn = document.getElementById('upgradeBtn');
      if (upgradeBtn) {
        upgradeBtn.disabled = false;
        upgradeBtn.textContent = 'Upgrade to Premium';
      }
    }
  }

  async createPortalSession() {
    try {
      // Show loading state
      const manageBtn = document.getElementById('manageSubscriptionBtn');
      if (manageBtn) {
        manageBtn.disabled = true;
        manageBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right: 8px;">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          Opening Billing Portal...
        `;
      }

      const response = await this.api.callFunction('subscription-api', {
        action: 'create_portal_session',
        origin: window.location.origin
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Add a small delay to ensure loading state is visible
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to Stripe Customer Portal
      window.location.href = response.url;
      
      // Don't reset button state here since we're redirecting
      
    } catch (error) {
      // Error creating portal session
      
      // Show specific error message if it's the "no Stripe subscription" issue
      if (error.message.includes('No Stripe subscription found')) {
        this.showError('This account has premium status but no Stripe subscription. Please create a new subscription or contact support.');
      } else {
        this.showError('Failed to open subscription management. Please try again.');
      }
      
      // Reset button state only on actual error
      const manageBtn = document.getElementById('manageSubscriptionBtn');
      if (manageBtn) {
        manageBtn.disabled = false;
        manageBtn.textContent = 'Manage Subscription';
      }
    }
  }

  showError(message) {
    // Create or update error message element
    let errorElement = document.getElementById('subscriptionError');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'subscriptionError';
      errorElement.className = 'error-message';
      
      const subscriptionSection = document.querySelector('.subscription-info');
      if (subscriptionSection) {
        subscriptionSection.appendChild(errorElement);
      }
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }

  showSuccess(message) {
    // Create or update success message element
    let successElement = document.getElementById('subscriptionSuccess');
    if (!successElement) {
      successElement = document.createElement('div');
      successElement.id = 'subscriptionSuccess';
      successElement.className = 'success-message';
      
      const subscriptionSection = document.querySelector('.subscription-info');
      if (subscriptionSection) {
        subscriptionSection.appendChild(successElement);
      }
    }
    
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    // Hide success after 5 seconds
    setTimeout(() => {
      successElement.style.display = 'none';
    }, 5000);
  }

  updateDataSourceIndicator(source, timestamp) {
    const indicator = document.getElementById('subscriptionDataSource');
    if (!indicator) return;

    const timeStr = timestamp.toLocaleTimeString();
    
    if (source === 'cached') {
      indicator.textContent = `Using cached data (last updated: ${timeStr})`;
      indicator.style.color = '#888';
    } else if (source === 'fresh') {
      indicator.textContent = `Fresh data from server (updated: ${timeStr})`;
      indicator.style.color = '#28a745';
      
      // Fade back to normal color after 3 seconds
      setTimeout(() => {
        indicator.style.color = '#888';
      }, 3000);
    }
  }

  updateSyncButtonState(lastSyncTime, cooldownMs) {
    const syncBtn = document.getElementById('syncSubscriptionBtn');
    const indicator = document.getElementById('subscriptionDataSource');
    
    if (!syncBtn || !lastSyncTime) return;

    const now = Date.now();
    const timeSinceSync = now - lastSyncTime;
    
    if (timeSinceSync < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceSync) / 1000);
      syncBtn.disabled = true;
      syncBtn.textContent = `Sync Available in ${remainingSeconds}s`;
      
      // Update every second until cooldown is over
      const updateInterval = setInterval(() => {
        const currentRemaining = Math.ceil((cooldownMs - (Date.now() - lastSyncTime)) / 1000);
        if (currentRemaining <= 0) {
          syncBtn.disabled = false;
          syncBtn.textContent = 'Sync Subscription Status';
          clearInterval(updateInterval);
        } else {
          syncBtn.textContent = `Sync Available in ${currentRemaining}s`;
        }
      }, 1000);
    }
  }

  // Handle successful checkout return
  handleCheckoutSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');

    if (success === 'true') {
      this.showSuccess('Welcome to Anchored Premium! Your subscription is now active.');
      
      console.log('🎉 Stripe checkout success detected - forcing subscription sync');
      
      // Reload subscription status (force refresh after checkout success)
      setTimeout(async () => {
        await this.loadSubscriptionStatus(true); // Force refresh after successful checkout
        
        // Ensure the update propagates to all pages
        if (this.currentSubscription) {
          console.log('📡 Emitting subscription update after Stripe success');
          window.eventBus.emit('subscription:updated', this.currentSubscription);
          
          // Update app-level cache for cross-page sharing
          if (window.app) {
            window.app.subscriptionData = this.currentSubscription;
          }
        }
      }, 2000);
      
      // Clean up URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (canceled === 'true') {
      this.showError('Subscription upgrade was canceled. You can try again anytime.');
      
      // Clean up URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }
}

// Initialize subscription manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/account')) {
    window.subscriptionManager = new SubscriptionManager();
    
    // Handle checkout success/cancel
    window.subscriptionManager.handleCheckoutSuccess();
    
    // Set up event listeners
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        window.subscriptionManager.createCheckoutSession();
      });
    }

    const manageSubscriptionBtn = document.getElementById('manageSubscriptionBtn');
    if (manageSubscriptionBtn) {
      manageSubscriptionBtn.addEventListener('click', () => {
        window.subscriptionManager.createPortalSession();
      });
    }


  }
});

window.SubscriptionManager = SubscriptionManager;