// Account Module - Placeholder for Task 5 Implementation
class Account {
  constructor() {
    this.user = null;
    this.subscription = null;
    this.init();
  }

  init() {

    // Add a small delay to ensure page is fully loaded
    setTimeout(() => {
      this.checkPaymentSuccess();
    }, 1000);

    this.setupEventListeners();
    this.loadAccountData();
  }

  checkPaymentSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');

    // Checking payment success silently

    if (success === 'true' && sessionId) {
      this.handlePaymentSuccess(sessionId);
    } else if (canceled === 'true') {
      this.showPaymentCanceled();
    }
  }

  async handlePaymentSuccess(sessionId) {
    // Payment successful, upgrading user to premium

    try {
      // Show success message
      const successDiv = document.getElementById('paymentSuccess');
      if (successDiv) {
        successDiv.style.display = 'block';
        setTimeout(() => {
          successDiv.style.display = 'none';
        }, 10000); // Hide after 10 seconds
      }

      // Wait a bit for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Sync subscription status from Stripe
      await this.syncSubscriptionStatus();

      // Reload subscription status
      if (window.subscriptionManager) {
        await window.subscriptionManager.loadSubscriptionStatus();
      }

      // Clean up URL
      const url = new URL(window.location);
      url.searchParams.delete('success');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, document.title, url.pathname);

    } catch (error) {
      // Error handling payment success
    }
  }

  async upgradeUserToPremium(sessionId) {
    try {
      // Starting premium upgrade for user

      // Wait for API and user to be available
      let attempts = 0;
      while ((!window.api || !window.api.currentUser) && attempts < 10) {
        // Waiting for API/user
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      // Check if we have the user and API available
      if (!window.api || !window.api.currentUser) {
        // API or user still not available after waiting
        throw new Error('API or user not available after waiting');
      }

      // API and user are now available

      // Update user subscription status directly using the API pattern

      // For manual testing, we need to get the customer ID from Stripe
      // In a real scenario, this would come from the checkout session
      let stripeCustomerId = null;

      // Try to get customer ID from a real session if available
      if (sessionId && sessionId !== 'manual-test') {
        // This would be a real Stripe session - we'd need to fetch the customer ID
        // For now, we'll leave it null for manual testing
      }

      const updateData = {
        subscription_tier: 'premium',
        subscription_expires_at: null,
        updated_at: new Date().toISOString()
      };

      // Add stripe_customer_id if we have it
      if (stripeCustomerId) {
        updateData.stripe_customer_id = stripeCustomerId;
      }

      const profileResponse = await window.api._request(
        `${window.api.apiUrl}/profiles?id=eq.${window.api.currentUser.id}`,
        {
          method: 'PATCH',
          auth: true,
          body: JSON.stringify(updateData)
        }
      );

      // Profile updated successfully

      // Update AI usage limits by calling the RPC function

      try {
        const aiUsageResponse = await window.api._request(
          `${window.api.apiUrl}/rpc/check_ai_usage`,
          {
            method: 'POST',
            auth: true,
            body: JSON.stringify({
              p_user_id: window.api.currentUser.id,
              p_feature_name: 'overall'
            })
          }
        );

        // AI usage limits updated
      } catch (aiError) {
        // Error updating AI usage limits
        // Don't throw here - profile update succeeded, AI update is secondary
      }

      // User successfully upgraded to premium with 500 AI tokens per month

      // Force refresh the subscription status display
      setTimeout(() => {
        if (window.subscriptionManager) {
          // Refreshing subscription display
          window.subscriptionManager.loadSubscriptionStatus();
        }
      }, 1000);

    } catch (error) {
      // Failed to upgrade user
      alert('Failed to upgrade account. Please contact support with session ID: ' + sessionId);
      throw error;
    }
  }

  async syncSubscriptionStatus() {
    try {
      // Syncing subscription status from Stripe

      // Wait for API to be available
      let attempts = 0;
      while ((!window.api || !window.api.currentUser) && attempts < 10) {
        // Waiting for API/user
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      if (!window.api || !window.api.currentUser) {
        throw new Error('API or user not available');
      }

      // Show loading state
      const syncBtn = document.getElementById('syncSubscriptionBtn');
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
      }

      // Call the sync subscription status function
      const result = await window.api.callFunction('subscription-api', {
        action: 'sync_subscription_status'
      });

      // Sync result obtained

      // Show success message
      if (result.updated) {
        // Subscription updated

        // Show a temporary success message
        const successMessage = document.createElement('div');
        successMessage.className = 'alert alert-success';
        successMessage.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; padding: 15px; border-radius: 5px; background: #d4edda; border: 1px solid #c3e6cb; color: #155724;';
        successMessage.textContent = result.message;
        document.body.appendChild(successMessage);

        setTimeout(() => {
          document.body.removeChild(successMessage);
        }, 5000);
      } else {
        // No update needed
      }

      // Force refresh the subscription status display
      if (window.subscriptionManager) {
        await window.subscriptionManager.loadSubscriptionStatus();
      }

    } catch (error) {
      // Failed to sync subscription status

      // Show error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'alert alert-error';
      errorMessage.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; padding: 15px; border-radius: 5px; background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24;';
      errorMessage.textContent = `Failed to sync subscription: ${error.message}`;
      document.body.appendChild(errorMessage);

      setTimeout(() => {
        if (document.body.contains(errorMessage)) {
          document.body.removeChild(errorMessage);
        }
      }, 5000);
    } finally {
      // Reset button state
      const syncBtn = document.getElementById('syncSubscriptionBtn');
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync Subscription Status';
      }
    }
  }

  showPaymentCanceled() {
    const canceledDiv = document.getElementById('paymentCanceled');
    if (canceledDiv) {
      canceledDiv.style.display = 'block';
      setTimeout(() => {
        canceledDiv.style.display = 'none';
      }, 5000); // Hide after 5 seconds
    }

    // Clean up URL
    const url = new URL(window.location);
    url.searchParams.delete('canceled');
    window.history.replaceState({}, document.title, url.pathname);
  }

  setupEventListeners() {
    // Change password
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => this.showChangePasswordModal());
    }

    // Subscription management
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.showSubscriptionModal());
    }

    const manageSubscriptionBtn = document.getElementById('manageSubscriptionBtn');
    if (manageSubscriptionBtn) {
      manageSubscriptionBtn.addEventListener('click', () => this.manageSubscription());
    }

    // Data management
    const exportAllBtn = document.getElementById('exportAllBtn');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => this.exportAllData());
    }

    // Refresh status button
    const refreshStatusBtn = document.getElementById('refreshStatusBtn');
    if (refreshStatusBtn) {
      refreshStatusBtn.addEventListener('click', () => {
        // Manual refresh requested
        if (window.subscriptionManager) {
          window.subscriptionManager.loadSubscriptionStatus();
        }
        location.reload(); // Force full page reload
      });
    }

    // Sync subscription status button
    const syncSubscriptionBtn = document.getElementById('syncSubscriptionBtn');
    if (syncSubscriptionBtn) {
      syncSubscriptionBtn.addEventListener('click', () => {
        // Sync subscription status triggered
        this.syncSubscriptionStatus();
      });
    }



    // View billing history button
    const viewBillingBtn = document.getElementById('viewBillingBtn');
    if (viewBillingBtn) {
      viewBillingBtn.addEventListener('click', () => this.viewBillingHistory());
    }


  }

  async loadAccountData() {
    try {
      // Loading account data

      // Wait for API to be available
      if (!window.api) {
        // API not available yet, retrying
        setTimeout(() => this.loadAccountData(), 500);
        return;
      }

      // Check if user is authenticated
      if (!window.api.isAuthenticated()) {
        // User not authenticated
        // Redirect to login or show error
        window.location.href = '/';
        return;
      }

      // Get current user data
      const currentUser = window.api.currentUser;
      if (!currentUser) {
        // No current user data
        return;
      }

      // Get user profile data from Supabase
      let profileData = null;
      try {
        const response = await window.api._request(`${window.api.apiUrl}/profiles?id=eq.${currentUser.id}`, { auth: true });
        if (response && response.length > 0) {
          profileData = response[0];
        }
      } catch (error) {
        // Could not load profile data
      }

      // Combine user data with profile data
      const userData = {
        email: currentUser.email || 'Unknown',
        created_at: profileData?.created_at || currentUser.created_at || new Date().toISOString(),
        subscription_tier: profileData?.subscription_tier || 'free'
      };

      // Loaded user data
      this.updateAccountUI(userData);

    } catch (error) {
      // Error loading account data
      // Show placeholder data if loading fails
      this.updateAccountUI({
        email: 'Error loading email',
        created_at: new Date().toISOString(),
        subscription_tier: 'free'
      });
    }
  }

  updateAccountUI(userData) {
    const userEmail = document.getElementById('userEmail');
    const accountCreated = document.getElementById('accountCreated');
    const statusBadge = document.getElementById('statusBadge');

    if (userEmail) userEmail.textContent = userData.email;
    if (accountCreated) {
      accountCreated.textContent = new Date(userData.created_at).toLocaleDateString();
    }
    if (statusBadge) {
      statusBadge.textContent = userData.subscription_tier === 'premium' ? 'Premium' : 'Free';
      statusBadge.className = `status-badge ${userData.subscription_tier}`;
    }
  }

  showChangePasswordModal() {
    window.app.showModal('changePasswordModal');
  }

  showSubscriptionModal() {
    window.app.showModal('subscriptionModal');

    // Set up subscription modal event listener
    const startSubscriptionBtn = document.getElementById('startSubscriptionBtn');
    if (startSubscriptionBtn && window.subscriptionManager) {
      startSubscriptionBtn.onclick = () => {
        window.app.hideModal('subscriptionModal');
        window.subscriptionManager.createCheckoutSession();
      };
    }
  }

  manageSubscription() {
    // Direct link to Stripe customer portal
    window.open('https://billing.stripe.com/p/login/test_28E00icerfLI4Ha6Kj9R600', '_blank');
  }

  viewBillingHistory() {
    // Same Stripe portal link - users can view billing history there
    window.open('https://billing.stripe.com/p/login/test_28E00icerfLI4Ha6Kj9R600', '_blank');
  }



  exportAllData() {
    // Export all data - will be implemented in task 6
  }


}

// Initialize account module when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/account')) {
    window.account = new Account();
  }
});

window.Account = Account;