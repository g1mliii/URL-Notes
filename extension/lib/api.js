// URL Notes Extension - Supabase API Client
// Handles communication with Supabase backend for premium features

class SupabaseClient {
  constructor() {
    this.supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with actual URL
    this.supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // Replace with actual key
    this.apiUrl = `${this.supabaseUrl}/rest/v1`;
    this.authUrl = `${this.supabaseUrl}/auth/v1`;
    this.currentUser = null;
    this.accessToken = null;
  }

  // Initialize client and check auth status
  async init() {
    try {
      // Check for stored session
      const result = await chrome.storage.local.get(['supabase_session']);
      if (result.supabase_session) {
        this.accessToken = result.supabase_session.access_token;
        this.currentUser = result.supabase_session.user;
        
        // Verify token is still valid
        const isValid = await this.verifyToken();
        if (!isValid) {
          await this.signOut();
        }
      }
    } catch (error) {
      console.error('Error initializing Supabase client:', error);
    }
  }

  // Get authorization headers
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.supabaseAnonKey
    };

    if (includeAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  // Sign in with email and password
  async signInWithEmail(email, password) {
    try {
      const response = await fetch(`${this.authUrl}/token?grant_type=password`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({
          email,
          password
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Sign in failed');
      }

      const data = await response.json();
      await this.handleAuthSuccess(data);
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  // Sign up with email and password
  async signUpWithEmail(email, password) {
    try {
      const response = await fetch(`${this.authUrl}/signup`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({
          email,
          password
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Sign up failed');
      }

      const data = await response.json();
      if (data.access_token) {
        await this.handleAuthSuccess(data);
      }
      return data;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  // Sign in with OAuth provider
  async signInWithOAuth(provider) {
    try {
      const redirectUrl = chrome.runtime.getURL('popup/popup.html');
      const authUrl = `${this.authUrl}/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUrl)}`;
      
      // Open auth popup
      const authWindow = window.open(authUrl, 'auth', 'width=500,height=600');
      
      return new Promise((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(checkClosed);
            // Check if auth was successful
            this.checkAuthResult().then(resolve).catch(reject);
          }
        }, 1000);
      });
    } catch (error) {
      console.error('OAuth sign in error:', error);
      throw error;
    }
  }

  // Handle successful authentication
  async handleAuthSuccess(authData) {
    this.accessToken = authData.access_token;
    this.currentUser = authData.user;

    // Store session
    await chrome.storage.local.set({
      supabase_session: {
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
        user: authData.user,
        expires_at: Date.now() + (authData.expires_in * 1000)
      }
    });

    // Create or update user profile
    await this.upsertProfile(authData.user);
  }

  // Sign out
  async signOut() {
    try {
      if (this.accessToken) {
        await fetch(`${this.authUrl}/logout`, {
          method: 'POST',
          headers: this.getHeaders()
        });
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      // Clear local session
      this.accessToken = null;
      this.currentUser = null;
      await chrome.storage.local.remove(['supabase_session']);
    }
  }

  // Verify token validity
  async verifyToken() {
    if (!this.accessToken) return false;

    try {
      const response = await fetch(`${this.authUrl}/user`, {
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Create or update user profile
  async upsertProfile(user) {
    try {
      const profile = {
        id: user.id,
        email: user.email,
        updated_at: new Date().toISOString()
      };

      await fetch(`${this.apiUrl}/profiles`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(profile)
      });
    } catch (error) {
      console.error('Error upserting profile:', error);
    }
  }

  // Sync notes to cloud
  async syncNotes(notes) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const encryptedNotes = [];
      
      // Encrypt notes before uploading
      for (const note of notes) {
        const encryptedNote = await window.noteEncryption.encryptNoteForCloud(
          note, 
          await this.getUserEncryptionKey()
        );
        encryptedNotes.push(encryptedNote);
      }

      const response = await fetch(`${this.apiUrl}/notes`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(encryptedNotes)
      });

      if (!response.ok) {
        throw new Error('Failed to sync notes');
      }

      return await response.json();
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }

  // Fetch notes from cloud
  async fetchNotes(lastSyncTime = null) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      let url = `${this.apiUrl}/notes?user_id=eq.${this.currentUser.id}&is_deleted=eq.false&order=updated_at.desc`;
      
      if (lastSyncTime) {
        url += `&updated_at=gt.${lastSyncTime}`;
      }

      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }

      const encryptedNotes = await response.json();
      const decryptedNotes = [];

      // Decrypt notes after downloading
      const userKey = await this.getUserEncryptionKey();
      for (const encryptedNote of encryptedNotes) {
        try {
          const decryptedNote = await window.noteEncryption.decryptNoteFromCloud(
            encryptedNote, 
            userKey
          );
          decryptedNotes.push(decryptedNote);
        } catch (error) {
          console.error('Failed to decrypt note:', encryptedNote.id, error);
        }
      }

      return decryptedNotes;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  // Delete note from cloud
  async deleteNote(noteId) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${this.apiUrl}/notes?id=eq.${noteId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      return true;
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  // Get user's encryption key
  async getUserEncryptionKey() {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }

    // For now, derive key from user ID and email
    // In production, this should be more secure
    const keyMaterial = `${this.currentUser.id}:${this.currentUser.email}`;
    const salt = 'url-notes-salt'; // Should be unique per user
    
    return await window.noteEncryption.generateKey(keyMaterial, salt);
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!(this.accessToken && this.currentUser);
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check subscription status
  async getSubscriptionStatus() {
    if (!this.isAuthenticated()) {
      return { tier: 'free', active: false };
    }

    try {
      const response = await fetch(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=subscription_tier,subscription_expires_at`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        return { tier: 'free', active: false };
      }

      const profiles = await response.json();
      const profile = profiles[0];

      if (!profile) {
        return { tier: 'free', active: false };
      }

      const isActive = profile.subscription_expires_at ? 
        new Date(profile.subscription_expires_at) > new Date() : false;

      return {
        tier: profile.subscription_tier || 'free',
        active: isActive,
        expiresAt: profile.subscription_expires_at
      };
    } catch (error) {
      console.error('Error checking subscription:', error);
      return { tier: 'free', active: false };
    }
  }

  // Update subscription
  async updateSubscription(tier, expiresAt) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          subscription_tier: tier,
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      return true;
    } catch (error) {
      console.error('Subscription update error:', error);
      throw error;
    }
  }

  // Get storage usage
  async getStorageUsage() {
    if (!this.isAuthenticated()) {
      return { used: 0, limit: 0 };
    }

    try {
      const response = await fetch(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=storage_used_bytes`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        return { used: 0, limit: 0 };
      }

      const profiles = await response.json();
      const profile = profiles[0];
      const subscription = await this.getSubscriptionStatus();
      
      const limit = subscription.tier === 'premium' ? 
        1024 * 1024 * 1024 : // 1GB for premium
        100 * 1024 * 1024;   // 100MB for free

      return {
        used: profile?.storage_used_bytes || 0,
        limit: limit
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { used: 0, limit: 0 };
    }
  }
}

// Export singleton instance
window.supabaseClient = new SupabaseClient();
