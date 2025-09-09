// Account Module - Placeholder for Task 5 Implementation
class Account {
  constructor() {
    this.user = null;
    this.subscription = null;
    this.init();
  }

  init() {
    console.log('Account module initialized - will be implemented in task 5');
    this.setupEventListeners();
    this.loadAccountData();
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