// URL Notes Extension - Supabase API Client
// Handles communication with Supabase backend for premium features

class SupabaseClient {
  constructor() {
    this.supabaseUrl = 'https://kqjcorjjvunmyrnzvqgr.supabase.co'; // Set from user-provided project URL
    this.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxamNvcmpqdnVubXlybnp2cWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTc4ODgsImV4cCI6MjA3MTI5Mzg4OH0.l-ZdPOYMNi8x3lBqlemwQ2elDyvoPy-2ZUWuODVviWk'; // Set from user-provided anon key
    this.apiUrl = `${this.supabaseUrl}/rest/v1`;
    this.authUrl = `${this.supabaseUrl}/auth/v1`;
    this.currentUser = null;
    this.accessToken = null;
  }

  // PKCE helpers
  async generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => ('0' + b.toString(16)).slice(-2)).join('');
  }

  async sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return await crypto.subtle.digest('SHA-256', data);
  }

  base64UrlEncode(arrayBuffer) {
    let str = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async generateCodeChallenge(verifier) {
    const hashed = await this.sha256(verifier);
    return this.base64UrlEncode(hashed);
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
        } else {
          // Propagate subscription tier on startup
          try {
            const status = await this.getSubscriptionStatus();
            await chrome.storage.local.set({ userTier: status.active ? (status.tier || 'premium') : 'free' });
            if (window.adManager) {
              if (status.active && (status.tier || 'premium') !== 'free') {
                window.adManager.hideAdContainer?.();
              } else {
                window.adManager.refreshAd?.();
              }
            }
          } catch (e) {
            console.warn('Failed to propagate userTier on init:', e);
          }
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
        let detail = 'Sign in failed';
        try {
          const j = await response.json();
          detail = j.error_description || j.msg || j.error || JSON.stringify(j);
        } catch (_) {
          try { detail = await response.text(); } catch (_) {}
        }
        throw new Error(detail);
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
        let detail = 'Sign up failed';
        try {
          const j = await response.json();
          detail = j.error_description || j.msg || j.error || JSON.stringify(j);
        } catch (_) {
          try { detail = await response.text(); } catch (_) {}
        }
        throw new Error(detail);
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

  // Sign in with OAuth provider using PKCE + chrome.identity.launchWebAuthFlow
  async signInWithOAuth(provider) {
    try {
      const redirectUri = chrome.identity.getRedirectURL();
      const codeVerifier = await this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);

      const scope = encodeURIComponent('openid email profile');
      const authUrl = `${this.authUrl}/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectUri)}&response_type=code&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&scope=${scope}`;

      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectedTo) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(redirectedTo);
        });
      });

      const urlObj = new URL(responseUrl);
      const code = urlObj.searchParams.get('code');
      console.debug('[OAuth] authorize url:', authUrl);
      console.debug('[OAuth] redirected to:', responseUrl);
      if (!code) {
        const errParam = urlObj.searchParams.get('error');
        const errDesc = urlObj.searchParams.get('error_description');
        throw new Error(`Authorization code not found. error=${errParam || ''} ${errDesc || ''}`.trim());
      }

      // Token exchange attempts with fallbacks
      const attempts = [];

      // Attempt 1: x-www-form-urlencoded with Authorization header
      const form1 = new URLSearchParams();
      form1.set('grant_type', 'authorization_code');
      form1.set('code', code);
      form1.set('code_verifier', codeVerifier);
      form1.set('redirect_uri', redirectUri);
      attempts.push(() => fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'apikey': this.supabaseAnonKey,
          'Authorization': `Bearer ${this.supabaseAnonKey}`
        },
        body: form1.toString()
      }));

      // Attempt 2: x-www-form-urlencoded without Authorization header
      const form2 = new URLSearchParams(form1);
      attempts.push(() => fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'apikey': this.supabaseAnonKey
        },
        body: form2.toString()
      }));

      // Attempt 3: x-www-form-urlencoded with grant_type=pkce
      const form3 = new URLSearchParams();
      form3.set('grant_type', 'pkce');
      form3.set('code', code);
      form3.set('code_verifier', codeVerifier);
      form3.set('redirect_uri', redirectUri);
      attempts.push(() => fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'apikey': this.supabaseAnonKey
        },
        body: form3.toString()
      }));

      let lastStatus = 0;
      const errors = [];
      let tokenRes = null;
      for (const attempt of attempts) {
        tokenRes = await attempt();
        if (tokenRes.ok) break;
        lastStatus = tokenRes.status;
        try {
          const j = await tokenRes.json();
          errors.push(`status ${tokenRes.status}: ${j.error_description || j.msg || JSON.stringify(j)}`);
        } catch (_) {
          try { errors.push(`status ${tokenRes.status}: ${await tokenRes.text()}`); } catch (_) { errors.push(`status ${tokenRes.status}`); }
        }
      }

      if (!tokenRes || !tokenRes.ok) {
        throw new Error(`Token exchange failed after ${attempts.length} attempts. ${errors.join(' | ')}`);
      }

      const data = await tokenRes.json();
      await this.handleAuthSuccess(data);
      return data;
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
      // Reset premium gating
      try {
        await chrome.storage.local.set({ userTier: 'free' });
        window.adManager?.refreshAd?.();
      } catch (_) {}
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
      // Ensure profile exists and has a per-user salt
      const baseProfile = { id: user.id, email: user.email, updated_at: new Date().toISOString() };
      await fetch(`${this.apiUrl}/profiles`, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(baseProfile)
      });

      // Fetch current salt
      let salt = null;
      try {
        const res = await fetch(`${this.apiUrl}/profiles?id=eq.${user.id}&select=salt,subscription_tier,subscription_expires_at`, { headers: this.getHeaders() });
        if (res.ok) {
          const arr = await res.json();
          if (arr[0]) salt = arr[0].salt || null;
        }
      } catch (_) {}

      // If no salt, generate and patch
      if (!salt) {
        const saltBytes = new Uint8Array(32);
        crypto.getRandomValues(saltBytes);
        salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await fetch(`${this.apiUrl}/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ salt, updated_at: new Date().toISOString() })
        });
      }

      // Update userTier in local storage
      try {
        const status = await this.getSubscriptionStatus();
        await chrome.storage.local.set({ userTier: status.active ? (status.tier || 'premium') : 'free' });
        if (window.adManager) {
          if (status.active && (status.tier || 'premium') !== 'free') {
            window.adManager.hideAdContainer?.();
          } else {
            window.adManager.refreshAd?.();
          }
        }
      } catch (e) {
        console.warn('Failed to set userTier:', e);
      }
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

    // Derive key from stable user material + per-user salt from profile
    const keyMaterial = `${this.currentUser.id}:${this.currentUser.email}`;
    let salt = null;
    try {
      const res = await fetch(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=salt`, { headers: this.getHeaders() });
      if (res.ok) {
        const arr = await res.json();
        salt = arr[0]?.salt || null;
      }
    } catch (_) {}

    if (!salt) {
      // Fallback: local salt (as last resort)
      const local = await chrome.storage.local.get(['local_salt']);
      if (!local.local_salt) {
        const saltBytes = new Uint8Array(32);
        crypto.getRandomValues(saltBytes);
        const gen = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await chrome.storage.local.set({ local_salt: gen });
        salt = gen;
      } else {
        salt = local.local_salt;
      }
    }

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

  // Get current session (from storage or in-memory)
  async getSession() {
    try {
      const { supabase_session } = await chrome.storage.local.get(['supabase_session']);
      if (supabase_session) return supabase_session;
      if (this.accessToken && this.currentUser) {
        return {
          access_token: this.accessToken,
          user: this.currentUser
        };
      }
      return null;
    } catch (e) {
      console.warn('getSession error:', e);
      return null;
    }
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
