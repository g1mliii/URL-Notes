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


  async init() {
    try {
      try {
        if (window.urlNotesConfig?.loadConfig) {
          const cfg = await window.urlNotesConfig.loadConfig();
          if (cfg?.supabaseUrl) this.supabaseUrl = cfg.supabaseUrl;
          if (cfg?.supabaseAnonKey) this.supabaseAnonKey = cfg.supabaseAnonKey;
          this.apiUrl = `${this.supabaseUrl}/rest/v1`;
          this.authUrl = `${this.supabaseUrl}/auth/v1`;
        }
      } catch (e) {
      }

      const result = await chrome.storage.local.get(['supabase_session']);
      if (result.supabase_session) {
        this.accessToken = result.supabase_session.access_token;
        this.currentUser = result.supabase_session.user;
        const expiresAt = result.supabase_session.expires_at || 0;
        const now = Date.now();
        if (!expiresAt || (expiresAt - now) < 60000) {
          try {
            await this.refreshSession();
          } catch (e) {
            await this.signOut();
          }
        }

        {
          try {
            const { profileLastChecked, userTier } = await chrome.storage.local.get(['profileLastChecked', 'userTier']);
            const now = Date.now();
            const oneHour = 60 * 60 * 1000; 
            if ((!profileLastChecked || (now - profileLastChecked) > oneHour) && !userTier) {
              await this.upsertProfile(this.currentUser);
              await chrome.storage.local.set({ profileLastChecked: now });
            } else if (userTier) {
              const isActive = userTier !== 'free';
              try { window.eventBus?.emit('tier:changed', { tier: userTier, active: isActive }); } catch (_) { }

              try {
                chrome.runtime.sendMessage({
                  action: 'tier-changed',
                  active: isActive,
                  tier: userTier
                }).catch(() => { });
              } catch (_) { }

              if (window.adManager) {
                if (userTier !== 'free') {
                  window.adManager.hideAdContainer?.();
                } else {
                  window.adManager.refreshAd?.();
                }
              }
            }


            try { window.eventBus?.emit('auth:changed', { user: this.currentUser }); } catch (_) { }
          } catch (e) {
          }
        }
      }
    } catch (error) {

    }
  }

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

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _request(url, {
    method = 'GET',
    headers = {},
    body = undefined,
    auth = true,
    timeoutMs = 10000,
    maxRetries = 2,
    raw = false
  } = {}) {
    const makeOnce = async () => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const init = { method, headers: { ...this.getHeaders(auth), ...headers }, signal: controller.signal };
        if (body !== undefined) {
          init.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        const res = await fetch(url, init);
        return res;
      } finally {
        clearTimeout(id);
      }
    };

    let attempt = 0;
    let didRefresh = false;
    let res;

    while (true) {
      try {
        res = await makeOnce();

        if (res.status === 401 && auth && !didRefresh) {
          try {
            await this.refreshSession();
            didRefresh = true;
            res = await makeOnce();
          } catch (e) {
          }
        }

        if ((res.status === 429 || (res.status >= 500 && res.status <= 599)) && attempt < maxRetries) {
          const backoff = Math.min(2000 * Math.pow(2, attempt), 8000);
          await this._sleep(backoff);
          attempt++;
          continue;
        }

        if (raw) return res;

        const text = await res.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

        if (!res.ok) {
          const detail = (data && (data.error_description || data.msg || data.error)) || (typeof data === 'string' ? data : 'Request failed');
          const err = new Error(detail);
          err.status = res.status;
          err.data = data;
          throw err;
        }

        return data;
      } catch (err) {
        const isAbort = err?.name === 'AbortError';
        const isNetwork = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError');
        if ((isAbort || isNetwork) && attempt < maxRetries) {
          const backoff = Math.min(2000 * Math.pow(2, attempt), 8000);
          await this._sleep(backoff);
          attempt++;
          continue;
        }
        throw err;
      }
    }
  }

  async signInWithEmail(email, password) {
    try {
      const data = await this._request(`${this.authUrl}/token?grant_type=password`, {
        method: 'POST',
        auth: false,
        body: { email, password }
      });
      await this.handleAuthSuccess(data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async signUpWithEmail(email, password) {
    try {
      const data = await this._request(`${this.authUrl}/signup`, {
        method: 'POST',
        auth: false,
        body: { email, password }
      });
      if (data.access_token) {
        await this.handleAuthSuccess(data);
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  async signInWithOAuth(provider) {
    try {
      const redirectUri = chrome.identity.getRedirectURL();
      console.log('Extension redirect URI:', redirectUri);
      const websiteRedirectUri = 'https://anchored.site/login-success';
      const authUrl = `${this.authUrl}/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(websiteRedirectUri)}&access_type=offline&prompt=consent`;
      console.log('Opening OAuth URL:', authUrl);
      const tab = await chrome.tabs.create({ url: authUrl });
      console.log('Opened OAuth tab:', tab.id);

      return new Promise((resolve, reject) => {
        console.log('🎧 Setting up OAuth completion listener...');

        const handleOAuthComplete = (message, sender, sendResponse) => {
          console.log('📨 Received message in OAuth listener:', message);
          console.log('📨 Message sender:', sender);

          if (message.action === 'oauth-complete') {
            console.log('✅ OAuth completion message received:', message);
            chrome.runtime.onMessage.removeListener(handleOAuthComplete);

            if (message.success) {
              console.log('🎉 OAuth successful, handling auth success...');
              this.handleAuthSuccess(message.data).then(() => {
                console.log('✅ Auth success handled, resolving promise');
                resolve(message.data);
              }).catch((error) => {
                console.error('❌ Auth success handling failed:', error);
                reject(error);
              });
            } else {
              console.log('❌ OAuth failed:', message.error);
              reject(new Error(message.error || 'OAuth authentication failed'));
            }
          } else {
            console.log('📨 Ignoring non-oauth message:', message.action);
          }
        };

        chrome.runtime.onMessage.addListener(handleOAuthComplete);
        console.log('🎧 OAuth listener set up, waiting for completion...');
        setTimeout(() => {
          console.log('⏰ OAuth timeout reached');
          chrome.runtime.onMessage.removeListener(handleOAuthComplete);
          reject(new Error('OAuth authentication timed out'));
        }, 300000);
      });
    } catch (error) {
      console.error('OAuth error:', error);
      throw error;
    }
  }


  async handleAuthSuccess(authData) {
    this.accessToken = authData.access_token;
    this.currentUser = authData.user;
    await chrome.storage.local.set({
      supabase_session: {
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
        user: authData.user,
        expires_at: Date.now() + (authData.expires_in * 1000)
      }
    });

    await chrome.storage.local.remove(['cachedPremiumStatus']);
    await this.upsertProfile(authData.user);
    try {
      window.eventBus?.emit('auth:changed', {
        user: this.currentUser,
        statusRefresh: true
      });
    } catch (_) { }
  }

  async signOut() {
    try {
      if (this.accessToken) {
        await fetch(`${this.authUrl}/logout`, {
          method: 'POST',
          headers: this.getHeaders()
        });
      }
    } catch (error) {
    } finally {
      this.accessToken = null;
      this.currentUser = null;
      await chrome.storage.local.remove(['supabase_session']);
      await chrome.storage.local.remove(['userTier', 'profileLastChecked', 'subscriptionLastChecked', 'cachedSubscription', 'encryptionKeyLastChecked', 'cachedKeyMaterial', 'cachedSalt']);
      try {
        await chrome.storage.local.set({ userTier: 'free' });
        window.adManager?.refreshAd?.();
      } catch (_) { }
      try { window.eventBus?.emit('auth:changed', { user: null }); } catch (_) { }
      try { window.eventBus?.emit('tier:changed', { tier: 'free', active: false, expiresAt: null }); } catch (_) { }
      try {
        chrome.runtime.sendMessage({
          action: 'tier-changed',
          active: false,
          tier: 'free'
        }).catch(() => { });
      } catch (_) { }
    }
  }

  async resetPassword(email) {
    try {
      const response = await fetch(`${this.authUrl}/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseAnonKey
        },
        body: JSON.stringify({
          email: email,
          type: 'recovery'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Password reset failed');
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  async refreshSession() {
    try {
      const storage = typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local;
      const { supabase_session } = await storage.get(['supabase_session']);
      const refreshToken = supabase_session?.refresh_token;
 
      if (!refreshToken) {
        console.error('No refresh token available for session refresh - user will need to re-authenticate');
        // Clear the invalid session and force re-authentication
        await this.signOut();
        await storage.set({ needsReauth: true });
        throw new Error('No refresh token available - please sign in again');
      }

      const response = await fetch(`${this.authUrl}/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        let detail = 'Refresh token failed';
        try {
          const j = await response.json();
          detail = j.error_description || j.msg || j.error || JSON.stringify(j);
        } catch (_) {
          try { detail = await response.text(); } catch (_) { }
        }

        console.error('Refresh token failed:', detail);
        if (response.status === 400 || response.status === 401) {
          console.log('Refresh token invalid, clearing session');
          await this.signOut();
          const storage = typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local;
          await storage.set({ needsReauth: true });
        }

        throw new Error(detail);
      }

      const data = await response.json();

      if (!data.user && data.access_token) {
        try {
          const ures = await fetch(`${this.authUrl}/user`, { headers: { ...this.getHeaders(false), Authorization: `Bearer ${data.access_token}` } });
          if (ures.ok) {
            data.user = await ures.json();
          }
        } catch (_) { }
      }

      if (!data.refresh_token && refreshToken) {
        data.refresh_token = refreshToken;
      }

      await this.handleAuthSuccess(data);
      return true;
    } catch (error) {
      console.error('Session refresh failed:', error.message);
      throw error;
    }
  }

  async upsertProfile(user) {
    try {
      let profile = null;
      try {
        const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}&select=salt,subscription_tier,subscription_expires_at`, { auth: true });
        if (Array.isArray(arr) && arr[0]) profile = arr[0];
      } catch (error) {
      }

      if (!profile) {
        const baseProfile = { id: user.id, email: user.email, updated_at: new Date().toISOString() };
        await this._request(`${this.apiUrl}/profiles`, {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: baseProfile,
          auth: true
        });

        try {
          const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}&select=salt,subscription_tier,subscription_expires_at`, { auth: true });
          if (Array.isArray(arr) && arr[0]) profile = arr[0];
        } catch (error) {
        }
      }

      if (profile && !profile.salt) {
        const saltBytes = new Uint8Array(32);
        crypto.getRandomValues(saltBytes);
        const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          body: { salt, updated_at: new Date().toISOString() },
          auth: true
        });
        profile = { ...profile, salt };
      }

      if (profile) {
        const isActive = profile.subscription_tier === 'premium' &&
          (profile.subscription_expires_at === null ||
            (profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()));
        const userTier = isActive ? (profile.subscription_tier || 'premium') : 'free';

        await chrome.storage.local.set({ userTier });

        // Clear premium status cache and AI usage cache to force UI refresh with updated limits
        await chrome.storage.local.remove(['cachedPremiumStatus', 'cachedAIUsage']);

        const profileData = {
          tier: profile.subscription_tier || 'free',
          active: isActive,
          expiresAt: profile.subscription_expires_at,
          salt: profile.salt
        };

        await chrome.storage.local.set({
          subscriptionLastChecked: Date.now(),
          cachedSubscription: profileData
        });

        try { window.eventBus?.emit('tier:changed', { tier: userTier, active: isActive, expiresAt: profile.subscription_expires_at }); } catch (_) { }
        try {
          chrome.runtime.sendMessage({
            action: 'tier-changed',
            active: isActive,
            tier: userTier
          }).catch(() => { });
        } catch (_) { }

        try {
          chrome.runtime.sendMessage({
            action: 'auth-changed',
            user: this.currentUser,
            statusRefresh: true
          }).catch(() => { });
        } catch (_) { }

        if (window.adManager) {
          if (isActive && userTier !== 'free') {
            window.adManager.hideAdContainer?.();
          } else {
            window.adManager.refreshAd?.();
          }
        }
      }
    } catch (error) {
    }
  }

  async syncNotes(syncPayload) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }
    const subscriptionStatus = await this.getSubscriptionStatus();
    if (!subscriptionStatus || !subscriptionStatus.active || subscriptionStatus.tier === 'free') {
      throw new Error('Premium subscription required for cloud sync');
    }

    if (!window.noteEncryption) {
      throw new Error('NoteEncryption module not available');
    }

    try {
      const encryptionKey = await this.getUserEncryptionKey();
      if (!encryptionKey) {
        throw new Error('Encryption key not available');
      }

      const encryptedNotes = [];
      if (syncPayload.notes && Array.isArray(syncPayload.notes)) {
        for (const note of syncPayload.notes) {
          if (!note.content || !note.title) {
            continue;
          }

          const encryptedNote = await window.noteEncryption.encryptNoteForCloud(
            note,
            encryptionKey
          );

          encryptedNotes.push(encryptedNote);
        }
      }

      const edgeFunctionPayload = {
        operation: syncPayload.operation,
        notes: encryptedNotes,
        deletions: syncPayload.deletions || [],
        lastSyncTime: syncPayload.lastSyncTime,
        timestamp: syncPayload.timestamp
      };

      const response = await fetch(`${this.supabaseUrl}/functions/v1/sync-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'apikey': this.supabaseAnonKey
        },
        body: JSON.stringify(edgeFunctionPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Sync failed' };
        }
        throw new Error(errorData.error || `Sync failed with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  async fetchNotes(lastSyncTime = null) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/sync-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'apikey': this.supabaseAnonKey
        },
        body: JSON.stringify({
          operation: 'pull',
          lastSyncTime: lastSyncTime
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Fetch failed' };
        }
        throw new Error(errorData.error || `Fetch failed with status ${response.status}`);
      }

      const responseData = await response.json();

      const { notes: encryptedNotes } = responseData;

      if (!encryptedNotes || !Array.isArray(encryptedNotes)) {
        return [];
      }

      const decryptedNotes = [];
      const userKey = await this.getUserEncryptionKey();

      for (const encryptedNote of encryptedNotes) {
        try {
          let decryptedNote;

          if (encryptedNote.title_encrypted && encryptedNote.content_encrypted && userKey) {
            decryptedNote = await window.noteEncryption.decryptNoteFromCloud(
              encryptedNote,
              userKey
            );
          } else if (encryptedNote.title && encryptedNote.content) {
            decryptedNote = {
              ...encryptedNote,
              title: encryptedNote.title,
              content: encryptedNote.content
            };
          } else {
            continue;
          }

          decryptedNotes.push(decryptedNote);
        } catch (error) {
          if (encryptedNote.title && encryptedNote.content) {
            decryptedNotes.push({
              ...encryptedNote,
              title: encryptedNote.title,
              content: encryptedNote.content
            });
          }
        }
      }

      return decryptedNotes;
    } catch (error) {
      throw error;
    }
  }

  async deleteNote(noteId) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      await this._request(`${this.apiUrl}/notes?id=eq.${noteId}`, {
        method: 'PATCH',
        body: { is_deleted: true, deleted_at: new Date().toISOString() },
        auth: true
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  async getUserEncryptionKey() {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }

    const { encryptionKeyLastChecked, cachedKeyMaterial, cachedSalt } = await chrome.storage.local.get(['encryptionKeyLastChecked', 'cachedKeyMaterial', 'cachedSalt']);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; 

    if (encryptionKeyLastChecked && cachedKeyMaterial && cachedSalt && (now - encryptionKeyLastChecked) < oneHour) {
      return await window.noteEncryption.generateKey(cachedKeyMaterial, cachedSalt);
    }

    const keyMaterial = `${this.currentUser.id}:${this.currentUser.email}`;
    let salt = null;

    try {
      const { cachedSubscription } = await chrome.storage.local.get(['cachedSubscription']);
      if (cachedSubscription?.salt) {
        salt = cachedSubscription.salt;
      }
    } catch (error) {
    }

    if (!salt) {
      try {
        const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=salt`, { auth: true });
        salt = arr?.[0]?.salt || null;
      } catch (error) {
      }
    }

    if (!salt) {
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

    const encryptionKey = await window.noteEncryption.generateKey(keyMaterial, salt);
    await chrome.storage.local.set({
      encryptionKeyLastChecked: now,
      cachedKeyMaterial: keyMaterial,
      cachedSalt: salt
    });

    return encryptionKey;
  }

  isAuthenticated() {
    return !!(this.accessToken && this.currentUser);
  }

  getCurrentUser() {
    return this.currentUser;
  }

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
      return null;
    }
  }

  async clearSubscriptionCache() {
    try {
      await chrome.storage.local.remove(['subscriptionLastChecked', 'cachedSubscription']);
    } catch (error) {
      console.warn('Failed to clear subscription cache:', error);
    }
  }

  async getSubscriptionStatus(forceRefresh = false) {
    if (!this.isAuthenticated()) {
      return { tier: 'free', active: false };
    }
    try {
      if (!forceRefresh) {
        const { subscriptionLastChecked, cachedSubscription } = await chrome.storage.local.get(['subscriptionLastChecked', 'cachedSubscription']);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000; 
        if (subscriptionLastChecked && cachedSubscription && (now - subscriptionLastChecked) < fiveMinutes) {
          return cachedSubscription;
        }
      }

      const now = Date.now();
      const profiles = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=subscription_tier,subscription_expires_at,salt`, { auth: true });

      const profile = profiles?.[0];

      if (!profile) {
        const result = { tier: 'free', active: false };
        await chrome.storage.local.set({
          subscriptionLastChecked: now,
          cachedSubscription: result
        });
        return result;
      }

      // Check if subscription is active
      // If subscription_expires_at is null and tier is premium, consider it active (lifetime/never expires)
      // If subscription_expires_at has a date, check if it's in the future
      const isActive = profile.subscription_tier === 'premium' &&
        (profile.subscription_expires_at === null ||
          (profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()));

      const result = {
        tier: profile.subscription_tier || 'free',
        active: isActive,
        expiresAt: profile.subscription_expires_at,
        salt: profile.salt
      };

      await chrome.storage.local.set({
        subscriptionLastChecked: now,
        cachedSubscription: result
      });

      return result;
    } catch (error) {
      return { tier: 'free', active: false };
    }
  }

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
      throw error;
    }
  }

  async getStorageUsage() {
    if (!this.isAuthenticated()) {
      return { used: 0, limit: 0 };
    }

    try {
      const profiles = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=storage_used_bytes,subscription_tier,subscription_expires_at`, { auth: true });
      const profile = profiles?.[0];

      if (!profile) {
        return { used: 0, limit: 0 };
      }

      const isActive = profile.subscription_tier === 'premium' &&
        (profile.subscription_expires_at === null ||
          (profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()));
      const tier = isActive ? (profile.subscription_tier || 'premium') : 'free';

      const limit = tier === 'premium' ?
        1024 * 1024 * 1024 : 
        100 * 1024 * 1024;   

      const result = {
        used: profile?.storage_used_bytes || 0,
        limit: limit
      };

      return result;
    } catch (error) {
      return { used: 0, limit: 0 };
    }
  }


  async resolveConflict(noteId, resolution, localNote = null) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/sync-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'apikey': this.supabaseAnonKey
        },
        body: JSON.stringify({
          operation: 'resolve_conflict',
          noteId: noteId,
          resolution: resolution,
          localNote: localNote
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Conflict resolution failed' };
        }
        throw new Error(errorData.error || `Conflict resolution failed with status ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async syncVersions(noteId, versions) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/sync-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'apikey': this.supabaseAnonKey
        },
        body: JSON.stringify({
          operation: 'sync_versions',
          notes: versions
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Version sync failed' };
        }
        throw new Error(errorData.error || `Version sync failed with status ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async rpc(functionName, params = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'apikey': this.supabaseAnonKey
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || `RPC ${functionName} failed` };
        }
        throw new Error(errorData.error || `RPC ${functionName} failed with status ${response.status}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }


  async refreshPremiumStatusAndUI() {
    try {
      if (this.clearSubscriptionCache) {
        await this.clearSubscriptionCache();
      }

      const status = await this.getSubscriptionStatus(true); 
      const userTier = status.active ? status.tier : 'free';
      await chrome.storage.local.set({ userTier });
      await chrome.storage.local.remove(['cachedAIUsage']);
      try {
        window.eventBus?.emit('tier:changed', {
          tier: status.tier,
          active: status.active,
          expiresAt: status.expiresAt
        });
      } catch (_) { }

      try {
        chrome.runtime.sendMessage({
          action: 'tier-changed',
          active: status.active,
          tier: status.tier
        }).catch(() => { });
      } catch (_) { }

      try {
        window.eventBus?.emit('auth:changed', {
          user: this.currentUser,
          statusRefresh: true
        });
      } catch (_) { }

      try {
        chrome.runtime.sendMessage({
          action: 'auth-changed',
          user: this.currentUser,
          statusRefresh: true 
        }).catch(() => { });
      } catch (_) { }

      try {
        if (window.adManager) {
          if (status.active && status.tier !== 'free') {
            window.adManager.hideAdContainer?.();
          } else {
            window.adManager.refreshAd?.();
          }
        }
      } catch (_) { }

      return status;

    } catch (error) {
      // If comprehensive refresh fails, fall back to basic auth event
      try { window.eventBus?.emit('auth:changed', { user: this.currentUser }); } catch (_) { }
      throw error;
    }
  }
}

window.supabaseClient = new SupabaseClient();
