// Account Module - Placeholder for Task 5 Implementation
class Account {
  constructor() {
    this.user = null;
    this.subscription = null;
    this.init();
  }

  init() {
    // Listen for auth state changes instead of doing separate auth check
    window.eventBus.on('auth:stateChanged', (authData) => {
      if (authData.isAuthenticated && authData.currentUser) {
        this.user = authData.currentUser;
        this.updateAccountUI({
          email: authData.currentUser.email || 'Unknown',
          created_at: authData.currentUser.created_at || new Date().toISOString(),
          subscription_tier: 'free' // Will be updated by subscription manager
        });
      }
    });

    // Check if auth state is already available
    if (window.authState?.isAuthenticated || (window.app?.isAuthenticated && window.app?.currentUser)) {
      this.user = window.app?.currentUser || window.authState?.currentUser;
      if (this.user) {
        this.updateAccountUI({
          email: this.user.email || 'Unknown',
          created_at: this.user.created_at || new Date().toISOString(),
          subscription_tier: 'free'
        });
      }
    }

    // Add a small delay to ensure page is fully loaded
    setTimeout(() => {
      this.checkPaymentSuccess();
    }, 500); // Reduced delay

    this.setupEventListeners();
    
    // Load account data only if we don't have user from auth state
    if (!this.user) {
      this.loadAccountData();
    }
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

  async syncSubscriptionStatus(silent = false) {
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

      // Show loading state (only if not silent)
      const syncBtn = document.getElementById('syncSubscriptionBtn');
      if (syncBtn && !silent) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
      }

      // Call the sync subscription status function
      const result = await window.api.callFunction('subscription-api', {
        action: 'sync_subscription_status'
      });

      // Sync result obtained

      // Show messages only if not in silent mode
      if (!silent) {
        if (result.updated) {
          // Subscription updated
          let displayMessage = result.message;
          
          // Improve the message for canceled subscriptions
          if (result.message && result.message.includes('premium subscrition cancelled expired at')) {
            // Extract the date and reformat the message
            const dateMatch = result.message.match(/expired at (.+?)(?:\s|$)/);
            if (dateMatch) {
              const expiryDate = new Date(dateMatch[1]).toLocaleDateString();
              displayMessage = `Subscription expires ${expiryDate} - recurring billing canceled`;
            }
          } else if (result.message && result.message.includes('Premium subscription canceled, expires')) {
            // Already in good format, just use it
            displayMessage = result.message.replace('Premium subscription canceled, expires', 'Subscription expires') + ' - recurring billing canceled';
          }

          // Show a temporary success message
          const successMessage = document.createElement('div');
          successMessage.className = 'alert alert-success';
          successMessage.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; padding: 15px; border-radius: 5px; background: #d4edda; border: 1px solid #c3e6cb; color: #155724;';
          successMessage.textContent = displayMessage;
          document.body.appendChild(successMessage);

          setTimeout(() => {
            document.body.removeChild(successMessage);
          }, 5000);
        } else {
          // No update needed - but still show a message for user feedback
          const infoMessage = document.createElement('div');
          infoMessage.className = 'alert alert-info';
          infoMessage.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; padding: 15px; border-radius: 5px; background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460;';
          infoMessage.textContent = result.message || 'Subscription status is up to date';
          document.body.appendChild(infoMessage);

          setTimeout(() => {
            document.body.removeChild(infoMessage);
          }, 3000);
        }
      }

      // Force refresh the subscription status display
      if (window.subscriptionManager) {
        await window.subscriptionManager.loadSubscriptionStatus();
      }

      return result; // Return result for silent mode handling

    } catch (error) {
      // Failed to sync subscription status

      // Show error message only if not silent
      if (!silent) {
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
      }

      throw error; // Re-throw for silent mode error handling
    } finally {
      // Reset button state (only if not silent)
      const syncBtn = document.getElementById('syncSubscriptionBtn');
      if (syncBtn && !silent) {
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

    // Subscription management
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.showSubscriptionModal());
    }

    const manageSubscriptionBtn = document.getElementById('manageSubscriptionBtn');
    if (manageSubscriptionBtn) {
      manageSubscriptionBtn.addEventListener('click', () => this.manageSubscription());
    }

    // Data management - Export All Data button removed as requested

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
        this.syncSubscriptionStatus(false); // Explicit false for manual sync with messages
      });
    }






  }

  async loadAccountData() {
    try {
      // Wait for API to be available
      let apiAttempts = 0;
      while (!window.api && apiAttempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        apiAttempts++;
      }
      
      if (!window.api) {
        setTimeout(() => this.loadAccountData(), 500);
        return;
      }

      // Get current user data
      const currentUser = window.api.currentUser;
      if (!currentUser) {
        // Try to get user from cached session
        const cachedSession = localStorage.getItem('supabase_session');
        if (cachedSession) {
          try {
            const sessionData = JSON.parse(cachedSession);
            if (sessionData.user) {
              // Use cached user data temporarily
              this.updateAccountUI({
                email: sessionData.user.email || 'Loading...',
                created_at: sessionData.user.created_at || new Date().toISOString(),
                subscription_tier: 'free' // Will be updated when API loads
              });
              
              // Retry loading after API is ready
              setTimeout(() => this.loadAccountData(), 1000);
              return;
            }
          } catch (e) {
            // Invalid cached session
          }
        }
        
        // No current user data and no cached session
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

      this.updateAccountUI(userData);

      // Auto-sync subscription status when account page loads (silently)
      // This ensures users always see the latest subscription status
      if (profileData?.stripe_customer_id) {
        try {
          await this.syncSubscriptionStatus(true); // Pass true for silent mode
        } catch (error) {
          // Silent sync failed, but don't show error to user
        }
      }

    } catch (error) {
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



  // Reuse the notification system from auth.js
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    // Add icon based on type
    let icon = 'ℹ';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠';

    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
    `;

    // Apply glassmorphism styling to match extension design
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: var(--text-primary, #333);
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
      background: var(--glass-bg, rgba(255, 255, 255, 0.1));
      border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.2));
      box-shadow: var(--glass-inset, inset 0 1px 0 rgba(255, 255, 255, 0.1)), var(--glass-shadow, 0 8px 32px rgba(0, 0, 0, 0.1));
      backdrop-filter: blur(var(--backdrop-blur, 10px));
      -webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
      transform: translateX(100%);
      transition: transform 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    // Apply type-specific styling
    if (type === 'success') {
      notification.style.background = 'color-mix(in oklab, var(--accent-primary, #007aff) 20%, var(--glass-bg, rgba(255, 255, 255, 0.1)) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, var(--accent-primary, #007aff) 40%, var(--glass-border, rgba(255, 255, 255, 0.2)) 60%)';
    } else if (type === 'error') {
      notification.style.background = 'color-mix(in oklab, #ff3b30 20%, var(--glass-bg, rgba(255, 255, 255, 0.1)) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, #ff3b30 40%, var(--glass-border, rgba(255, 255, 255, 0.2)) 60%)';
    } else if (type === 'info') {
      notification.style.background = 'color-mix(in oklab, #007aff 20%, var(--glass-bg, rgba(255, 255, 255, 0.1)) 80%)';
      notification.style.borderColor = 'color-mix(in oklab, #007aff 40%, var(--glass-border, rgba(255, 255, 255, 0.2)) 60%)';
    }

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Remove after delay
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
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
    // Use subscription manager's portal session for better integration
    if (window.subscriptionManager) {
      window.subscriptionManager.createPortalSession();
    } else {
      // Fallback to direct link to live Stripe customer portal
      window.open('https://billing.stripe.com/p/login/7sY7sN0nf3Vl3IY6gW3oA00', '_blank');
    }
  }



  // exportAllData method removed as Export All Data button was removed per task requirements


}

// Initialize account module when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/account')) {
    window.account = new Account();
  }
});

window.Account = Account;