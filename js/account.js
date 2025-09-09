// Account Module - Placeholder for Task 5 Implementation
class Account {
  constructor() {
    this.user = null;
    this.subscription = null;
    this.init();
  }

  init() {
    console.log('Account module initialized - will be implemented in task 5');
    this.checkPaymentSuccess();
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

      // Update user to premium in database
      await this.upgradeUserToPremium(sessionId);

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

      // Update user subscription status directly
      console.log('🔄 Updating profile to premium...');
      const { data: profileData, error: profileError } = await window.api.supabase
        .from('profiles')
        .update({
          subscription_tier: 'premium',
          subscription_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', window.api.currentUser.id)
        .select();

      console.log('📊 Profile update result:', { profileData, profileError });

      if (profileError) {
        console.error('❌ Error upgrading user profile:', profileError);
        throw profileError;
      }

      console.log('✅ Profile updated successfully');

      // Update AI usage limits to 500 for premium users
      console.log('🔄 Updating AI usage limits...');
      const { data: aiUsage, error: aiError } = await window.api.supabase.rpc('check_ai_usage', {
        p_user_id: window.api.currentUser.id,
        p_feature_name: 'overall'
      });

      console.log('📊 AI usage update result:', { aiUsage, aiError });

      if (aiError) {
        console.error('⚠️ Error updating AI usage limits:', aiError);
        // Don't throw here - profile update succeeded, AI update is secondary
      } else {
        console.log('✅ AI usage limits updated:', aiUsage);
      }

      console.log('🎉 User successfully upgraded to premium with 500 AI uses per month');

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

    // Manual upgrade button (for testing)
    const manualUpgradeBtn = document.getElementById('manualUpgradeBtn');
    if (manualUpgradeBtn) {
      manualUpgradeBtn.addEventListener('click', () => {
        console.log('🔄 Manual upgrade triggered');
        const sessionId = new URLSearchParams(window.location.search).get('session_id') || 'manual-test';
        this.upgradeUserToPremium(sessionId);
      });
    }

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', () => this.confirmDeleteAccount());
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
    if (window.subscriptionManager) {
      window.subscriptionManager.createPortalSession();
    } else {
      console.error('Subscription manager not available');
    }
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