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
      // Load config overrides if available
      try {
        if (window.urlNotesConfig?.loadConfig) {
          const cfg = await window.urlNotesConfig.loadConfig();
          if (cfg?.supabaseUrl) this.supabaseUrl = cfg.supabaseUrl;
          if (cfg?.supabaseAnonKey) this.supabaseAnonKey = cfg.supabaseAnonKey;
          this.apiUrl = `${this.supabaseUrl}/rest/v1`;
          this.authUrl = `${this.supabaseUrl}/auth/v1`;
        }
      } catch (e) {
        // Config load failed, using defaults - silently handled
      }

      // Check for stored session
      const result = await chrome.storage.local.get(['supabase_session']);
      if (result.supabase_session) {
        this.accessToken = result.supabase_session.access_token;
        this.currentUser = result.supabase_session.user;
        const expiresAt = result.supabase_session.expires_at || 0;
        const now = Date.now();
        // If the token is expired or expiring within 60s, try to refresh first
        if (!expiresAt || (expiresAt - now) < 60000) {
          try {
            await this.refreshSession();
          } catch (e) {
            await this.signOut();
          }
        }

        // Verify token is still valid
        const isValid = await this.verifyToken();
        if (!isValid) {
          await this.signOut();
        } else {
          // Check if we need to create/update profile (only if not done recently)
          try {
            const { profileLastChecked, userTier } = await chrome.storage.local.get(['profileLastChecked', 'userTier']);
            const now = Date.now();
            const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

            // Only check profile if we haven't done so in the last hour AND don't have userTier
            if ((!profileLastChecked || (now - profileLastChecked) > oneHour) && !userTier) {
              await this.upsertProfile(this.currentUser);
              await chrome.storage.local.set({ profileLastChecked: now });
            } else if (userTier) {
              // Use cached subscription status
              try { window.eventBus?.emit('tier:changed', { tier: userTier, active: userTier !== 'free' }); } catch (_) { }
              if (window.adManager) {
                if (userTier !== 'free') {
                  window.adManager.hideAdContainer?.();
                } else {
                  window.adManager.refreshAd?.();
                }
              }
            }
          } catch (e) {
            // Failed to handle profile on init - silently handled
          }
        }
      }
    } catch (error) {
      // Error initializing Supabase client - silently handled
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

  // Internal: sleep helper for backoff
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Centralized request helper with timeout, retry/backoff, and 401 refresh retry
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

        // Handle 401 once by refreshing session
        if (res.status === 401 && auth && !didRefresh) {
          try {
            await this.refreshSession();
            didRefresh = true;
            // retry immediately after refresh
            res = await makeOnce();
          } catch (e) {
            // fall through to error handling
          }
        }

        // Retry on 429/5xx with backoff
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
        // Retry network and abort errors
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

  // Sign in with email and password
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

  // Sign up with email and password
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

    // Clear premium status cache to force refresh
    await chrome.storage.local.remove(['cachedPremiumStatus']);

    // Create or update user profile
    await this.upsertProfile(authData.user);
    try { window.eventBus?.emit('auth:changed', { user: this.currentUser }); } catch (_) { }
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
      // Sign out error - silently handled
    } finally {
      // Clear local session
      this.accessToken = null;
      this.currentUser = null;
      await chrome.storage.local.remove(['supabase_session']);
      // Clear all caches
      await chrome.storage.local.remove(['userTier', 'profileLastChecked', 'subscriptionLastChecked', 'cachedSubscription', 'encryptionKeyLastChecked', 'cachedKeyMaterial', 'cachedSalt']);
      // Reset premium gating
      try {
        await chrome.storage.local.set({ userTier: 'free' });
        window.adManager?.refreshAd?.();
      } catch (_) { }
      try { window.eventBus?.emit('auth:changed', { user: null }); } catch (_) { }
      try { window.eventBus?.emit('tier:changed', { tier: 'free', active: false, expiresAt: null }); } catch (_) { }
    }
  }

  // Reset password
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

  // Verify token validity
  async verifyToken() {
    if (!this.accessToken) return false;

    try {
      const response = await this._request(`${this.authUrl}/user`, { auth: true, raw: true });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Refresh session using refresh_token
  async refreshSession() {
    try {
      const { supabase_session } = await chrome.storage.local.get(['supabase_session']);
      const refreshToken = supabase_session?.refresh_token;
      if (!refreshToken) {
        throw new Error('No refresh token available');
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
        throw new Error(detail);
      }

      const data = await response.json();

      // Some responses may omit user; fetch it if needed
      if (!data.user && data.access_token) {
        try {
          const ures = await fetch(`${this.authUrl}/user`, { headers: { ...this.getHeaders(false), Authorization: `Bearer ${data.access_token}` } });
          if (ures.ok) {
            data.user = await ures.json();
          }
        } catch (_) { }
      }

      // If refresh_token not returned, keep existing one
      if (!data.refresh_token && refreshToken) {
        data.refresh_token = refreshToken;
      }

      await this.handleAuthSuccess(data);
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Create or update user profile
  async upsertProfile(user) {
    try {
      // First, check if profile exists and get current data
      let profile = null;
      try {
        const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}&select=salt,subscription_tier,subscription_expires_at`, { auth: true });
        if (Array.isArray(arr) && arr[0]) profile = arr[0];
      } catch (error) {
        // upsertProfile: Error checking profile existence - silently handled
      }

      // Only create profile if it doesn't exist
      if (!profile) {
        const baseProfile = { id: user.id, email: user.email, updated_at: new Date().toISOString() };
        await this._request(`${this.apiUrl}/profiles`, {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: baseProfile,
          auth: true
        });

        // Fetch the newly created profile
        try {
          const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}&select=salt,subscription_tier,subscription_expires_at`, { auth: true });
          if (Array.isArray(arr) && arr[0]) profile = arr[0];
        } catch (error) {
          // upsertProfile: Error fetching newly created profile - silently handled
        }
      }

      // Generate salt only if missing
      if (profile && !profile.salt) {
        const saltBytes = new Uint8Array(32);
        crypto.getRandomValues(saltBytes);
        const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          body: { salt, updated_at: new Date().toISOString() },
          auth: true
        });
        // Update local profile object
        profile = { ...profile, salt };
      }

      // Update userTier in local storage using the profile we already fetched
      if (profile) {
        const isActive = profile.subscription_tier === 'premium' &&
          (profile.subscription_expires_at === null ||
            (profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()));
        const userTier = isActive ? (profile.subscription_tier || 'premium') : 'free';

        await chrome.storage.local.set({ userTier });

        // Clear premium status cache to force UI refresh
        await chrome.storage.local.remove(['cachedPremiumStatus']);

        // Store profile data in cache for reuse (including salt for encryption key)
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
        if (window.adManager) {
          if (isActive && userTier !== 'free') {
            window.adManager.hideAdContainer?.();
          } else {
            window.adManager.refreshAd?.();
          }
        }
      }
    } catch (error) {
      // Error upserting profile - silently handled
    }
  }

  // Sync notes to cloud using Edge Function
  async syncNotes(syncPayload) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    // Ensure encryption module is available
    if (!window.noteEncryption) {
      throw new Error('NoteEncryption module not available');
    }

    try {
      // Ensure encryption key is available
      const encryptionKey = await this.getUserEncryptionKey();
      if (!encryptionKey) {
        throw new Error('Encryption key not available');
      }

      const encryptedNotes = [];

      // Encrypt notes before uploading (only if notes exist)
      if (syncPayload.notes && Array.isArray(syncPayload.notes)) {
        for (const note of syncPayload.notes) {
          // Skip notes without title or content
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

      // Prepare the final payload for the Edge Function
      const edgeFunctionPayload = {
        operation: syncPayload.operation,
        notes: encryptedNotes,
        deletions: syncPayload.deletions || [],
        lastSyncTime: syncPayload.lastSyncTime,
        timestamp: syncPayload.timestamp
      };



      // Use Edge Function for sync
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

  // Fetch notes from cloud using Edge Function
  async fetchNotes(lastSyncTime = null) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      // Use Edge Function for fetching
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

      // Decrypt notes after downloading
      const userKey = await this.getUserEncryptionKey();

      for (const encryptedNote of encryptedNotes) {
        try {
          let decryptedNote;

          // Check if note is encrypted or plain text
          if (encryptedNote.title_encrypted && encryptedNote.content_encrypted && userKey) {
            // Note is encrypted, decrypt it
            decryptedNote = await window.noteEncryption.decryptNoteFromCloud(
              encryptedNote,
              userKey
            );
          } else if (encryptedNote.title && encryptedNote.content) {
            // Note is plain text, use as-is
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
          // Try to use the note as-is if decryption fails
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

  // Delete note from cloud
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

  // Get user's encryption key (with caching to prevent multiple API calls)
  async getUserEncryptionKey() {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }

    // Check if we have cached key material and salt
    const { encryptionKeyLastChecked, cachedKeyMaterial, cachedSalt } = await chrome.storage.local.get(['encryptionKeyLastChecked', 'cachedKeyMaterial', 'cachedSalt']);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour cache

    // Use cached material if it's recent
    if (encryptionKeyLastChecked && cachedKeyMaterial && cachedSalt && (now - encryptionKeyLastChecked) < oneHour) {
      return await window.noteEncryption.generateKey(cachedKeyMaterial, cachedSalt);
    }

    // Derive key from stable user material + per-user salt from profile
    const keyMaterial = `${this.currentUser.id}:${this.currentUser.email}`;
    let salt = null;

    // Try to get salt from cached profile data first
    try {
      const { cachedSubscription } = await chrome.storage.local.get(['cachedSubscription']);
      if (cachedSubscription?.salt) {
        salt = cachedSubscription.salt;
      }
    } catch (error) {
      // getUserEncryptionKey: Error checking cached subscription - silently handled
    }

    // If no cached salt, fetch from API
    if (!salt) {
      try {
        const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=salt`, { auth: true });
        salt = arr?.[0]?.salt || null;
      } catch (error) {
        // getUserEncryptionKey: Error fetching salt from API - silently handled
      }
    }

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

    const encryptionKey = await window.noteEncryption.generateKey(keyMaterial, salt);

    // Cache the key material and salt instead of the CryptoKey object
    // CryptoKey objects cannot be serialized to JSON
    await chrome.storage.local.set({
      encryptionKeyLastChecked: now,
      cachedKeyMaterial: keyMaterial,
      cachedSalt: salt
    });

    return encryptionKey;
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
      return null;
    }
  }

  // Clear subscription cache
  async clearSubscriptionCache() {
    try {
      await chrome.storage.local.remove(['subscriptionLastChecked', 'cachedSubscription']);
    } catch (error) {
      console.warn('Failed to clear subscription cache:', error);
    }
  }

  // Check subscription status (with caching to prevent multiple API calls)
  async getSubscriptionStatus(forceRefresh = false) {
    if (!this.isAuthenticated()) {
      return { tier: 'free', active: false };
    }

    try {
      // Check if we have cached subscription status (unless force refresh)
      if (!forceRefresh) {
        const { subscriptionLastChecked, cachedSubscription } = await chrome.storage.local.get(['subscriptionLastChecked', 'cachedSubscription']);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes cache

        // Use cached data if it's recent
        if (subscriptionLastChecked && cachedSubscription && (now - subscriptionLastChecked) < fiveMinutes) {
          return cachedSubscription;
        }
      }

      // Fetch fresh data from API
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
        salt: profile.salt // Include salt for encryption key reuse
      };

      // Always update cache with fresh data
      await chrome.storage.local.set({
        subscriptionLastChecked: now,
        cachedSubscription: result
      });

      return result;
    } catch (error) {
      // Don't cache error results, let it try again next time
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
      throw error;
    }
  }

  // Get storage usage
  async getStorageUsage() {
    if (!this.isAuthenticated()) {
      return { used: 0, limit: 0 };
    }

    try {
      // Get both storage_used_bytes and subscription info in ONE API call
      const profiles = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=storage_used_bytes,subscription_tier,subscription_expires_at`, { auth: true });
      const profile = profiles?.[0];

      if (!profile) {
        return { used: 0, limit: 0 };
      }

      // Calculate limit locally instead of calling getSubscriptionStatus()
      const isActive = profile.subscription_tier === 'premium' &&
        (profile.subscription_expires_at === null ||
          (profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()));
      const tier = isActive ? (profile.subscription_tier || 'premium') : 'free';

      const limit = tier === 'premium' ?
        1024 * 1024 * 1024 : // 1GB for premium
        100 * 1024 * 1024;   // 100MB for free

      const result = {
        used: profile?.storage_used_bytes || 0,
        limit: limit
      };

      return result;
    } catch (error) {
      return { used: 0, limit: 0 };
    }
  }

  // Resolve conflicts in cloud
  async resolveConflict(noteId, resolution, localNote = null) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      // Use Edge Function for conflict resolution
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

  // Sync version history to cloud
  async syncVersions(noteId, versions) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      // Use Edge Function for version sync
      const response = await fetch(`${this.supabaseUrl}/functions/v1/sync-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'apikey': this.supabaseAnonKey
        },
        body: JSON.stringify({
          operation: 'sync_versions',
          notes: versions  // Edge Function expects 'notes' parameter, not 'versions'
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

  // Call Supabase RPC functions
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
}

// Export singleton instance
window.supabaseClient = new SupabaseClient();
