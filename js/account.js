// Account Module - Placeholder for Task 5 Implementation
class Account {
  constructor() {
    this.user = null;
    this.subscription = null;
    this.init();
  }

  init() {
    console.log('🚀 Account module initialized');
    console.log('🔍 Current URL:', window.location.href);

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

    console.log('🔍 Checking payment success:', {
      success,
      canceled,
      sessionId,
      fullUrl: window.location.href
    });

    if (success === 'true' && sessionId) {
      console.log('✅ Payment success detected, starting upgrade...');
      this.handlePaymentSuccess(sessionId);
    } else if (canceled === 'true') {
      console.log('❌ Payment was canceled');
      this.showPaymentCanceled();
    } else {
      console.log('ℹ️ No payment status detected');
    }
  }

  async handlePaymentSuccess(sessionId) {
    console.log('Payment successful, upgrading user to premium');

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
      console.log('⏳ Waiting for page to fully load before upgrade...');
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
      console.error('Error handling payment success:', error);
    }
  }

  async upgradeUserToPremium(sessionId) {
    try {
      console.log('🔄 Starting premium upgrade for user:', window.api?.currentUser?.id);
      console.log('🔄 Session ID:', sessionId);

      // Wait for API and user to be available
      let attempts = 0;
      while ((!window.api || !window.api.currentUser) && attempts < 10) {
        console.log(`⏳ Waiting for API/user... attempt ${attempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      // Check if we have the user and API available
      if (!window.api || !window.api.currentUser) {
        console.error('❌ API or user still not available after waiting');
        throw new Error('API or user not available after waiting');
      }

      console.log('✅ API and user are now available:', window.api.currentUser.id);

      // Update user subscription status directly using the API pattern
      console.log('🔄 Updating profile to premium...');

      // For manual testing, we need to get the customer ID from Stripe
      // In a real scenario, this would come from the checkout session
      let stripeCustomerId = null;

      // Try to get customer ID from a real session if available
      if (sessionId && sessionId !== 'manual-test') {
        // This would be a real Stripe session - we'd need to fetch the customer ID
        // For now, we'll leave it null for manual testing
        console.log('Real session ID detected:', sessionId);
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

      console.log('📊 Profile update result:', profileResponse);
      console.log('✅ Profile updated successfully');

      // Update AI usage limits by calling the RPC function
      console.log('🔄 Updating AI usage limits...');

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

        console.log('📊 AI usage update result:', aiUsageResponse);
        console.log('✅ AI usage limits updated');
      } catch (aiError) {
        console.error('⚠️ Error updating AI usage limits:', aiError);
        // Don't throw here - profile update succeeded, AI update is secondary
      }

      console.log('🎉 User successfully upgraded to premium with 500 AI tokens per month');

      // Force refresh the subscription status display
      setTimeout(() => {
        if (window.subscriptionManager) {
          console.log('🔄 Refreshing subscription display...');
          window.subscriptionManager.loadSubscriptionStatus();
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Failed to upgrade user:', error);
      alert('Failed to upgrade account. Please contact support with session ID: ' + sessionId);
      throw error;
    }
  }

  async syncSubscriptionStatus() {
    try {
      console.log('🔄 Syncing subscription status from Stripe...');

      // Wait for API to be available
      let attempts = 0;
      while ((!window.api || !window.api.currentUser) && attempts < 10) {
        console.log(`⏳ Waiting for API/user... attempt ${attempts + 1}`);
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

      console.log('✅ Sync result:', result);

      // Show success message
      if (result.updated) {
        console.log(`🎉 Subscription updated: ${result.message}`);

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
        console.log(`ℹ️ No update needed: ${result.message}`);
      }

      // Force refresh the subscription status display
      if (window.subscriptionManager) {
        await window.subscriptionManager.loadSubscriptionStatus();
      }

    } catch (error) {
      console.error('❌ Failed to sync subscription status:', error);

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
        console.log('🔄 Manual refresh requested');
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
        console.log('🔄 Sync subscription status triggered');
        this.syncSubscriptionStatus();
      });
    }

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', () => this.confirmDeleteAccount());
    }

    // View billing history button
    const viewBillingBtn = document.getElementById('viewBillingBtn');
    if (viewBillingBtn) {
      viewBillingBtn.addEventListener('click', () => this.viewBillingHistory());
    }


  }

  async loadAccountData() {
    try {
      console.log('Loading account data...');

      // Wait for API to be available
      if (!window.api) {
        console.warn('API not available yet, retrying...');
        setTimeout(() => this.loadAccountData(), 500);
        return;
      }

      // Check if user is authenticated
      if (!window.api.isAuthenticated()) {
        console.warn('User not authenticated');
        // Redirect to login or show error
        window.location.href = '/';
        return;
      }

      // Get current user data
      const currentUser = window.api.currentUser;
      if (!currentUser) {
        console.warn('No current user data');
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
        console.warn('Could not load profile data:', error);
      }

      // Combine user data with profile data
      const userData = {
        email: currentUser.email || 'Unknown',
        created_at: profileData?.created_at || currentUser.created_at || new Date().toISOString(),
        subscription_tier: profileData?.subscription_tier || 'free'
      };

      console.log('Loaded user data:', userData);
      this.updateAccountUI(userData);

    } catch (error) {
      console.error('Error loading account data:', error);
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
    console.log('Export all data - will be implemented in task 6');
  }

  confirmDeleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      this.deleteAccount();
    }
  }

  async deleteAccount() {
    console.log('Delete account - will be implemented in task 5');
  }
}

// Initialize account module when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/account')) {
    window.account = new Account();
  }
});

window.Account = Account;