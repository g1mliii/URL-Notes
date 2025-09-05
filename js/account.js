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
    // Placeholder - actual implementation in task 5
    console.log('Loading account data...');
    
    // Update UI with placeholder data
    this.updateAccountUI({
      email: 'user@example.com',
      created_at: new Date().toISOString(),
      subscription_tier: 'free'
    });
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
  }

  manageSubscription() {
    console.log('Manage subscription - will be implemented in task 5');
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