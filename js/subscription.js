// Subscription Management Module
class SubscriptionManager {
  constructor() {
    this.api = null;
    this.currentSubscription = null;
    this.init();
  }

  async init() {
    // Wait for API to be available
    if (window.api) {
      this.api = window.api;
      await this.loadSubscriptionStatus();
    } else {
      // Wait for API to initialize
      setTimeout(() => this.init(), 100);
    }
  }

  async loadSubscriptionStatus() {
    try {
      const response = await this.api.callFunction('subscription-management', {
        action: 'get_subscription_status'
      });

      if (response.error) {
        console.error('Failed to load subscription status:', response.error);
        return;
      }

      this.currentSubscription = response;
      this.updateSubscriptionUI();
    } catch (error) {
      console.error('Error loading subscription status:', error);
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
    if (upgradeBtn && manageSubscriptionBtn && viewBillingBtn) {
      if (isPremium && this.currentSubscription.has_stripe_customer) {
        upgradeBtn.classList.add('hidden');
        manageSubscriptionBtn.classList.remove('hidden');
        viewBillingBtn.classList.remove('hidden');
      } else {
        upgradeBtn.classList.remove('hidden');
        manageSubscriptionBtn.classList.add('hidden');
        viewBillingBtn.classList.add('hidden');
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
        const limit = usage.monthlyLimit || 5;
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
        const limit = usage.monthlyLimit || 5;
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
      console.error('Error loading AI usage info:', error);
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

      const response = await this.api.callFunction('subscription-management', {
        action: 'create_checkout_session',
        origin: window.location.origin
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Redirect to Stripe Checkout
      window.location.href = response.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      this.showError('Failed to start subscription process. Please try again.');
      
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
        manageBtn.textContent = 'Loading...';
      }

      const response = await this.api.callFunction('subscription-management', {
        action: 'create_portal_session',
        origin: window.location.origin
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Redirect to Stripe Customer Portal
      window.location.href = response.url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      
      // Show specific error message if it's the "no Stripe subscription" issue
      if (error.message.includes('No Stripe subscription found')) {
        this.showError('This account has premium status but no Stripe subscription. Please create a new subscription or contact support.');
      } else {
        this.showError('Failed to open subscription management. Please try again.');
      }
      
      // Reset button state
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

  // Handle successful checkout return
  handleCheckoutSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');

    if (success === 'true') {
      this.showSuccess('Welcome to Anchored Premium! Your subscription is now active.');
      // Reload subscription status
      setTimeout(() => {
        this.loadSubscriptionStatus();
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

    const viewBillingBtn = document.getElementById('viewBillingBtn');
    if (viewBillingBtn) {
      viewBillingBtn.addEventListener('click', () => {
        window.subscriptionManager.createPortalSession();
      });
    }
  }
});

window.SubscriptionManager = SubscriptionManager;