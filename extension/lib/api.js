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
        console.warn('Config load failed, using defaults:', e);
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
            console.warn('Token refresh on init failed, signing out:', e);
            await this.signOut();
          }
        }
        
        // Verify token is still valid
        const isValid = await this.verifyToken();
        if (!isValid) {
          await this.signOut();
        } else {
          // Propagate subscription tier on startup
          try {
            const status = await this.getSubscriptionStatus();
            await chrome.storage.local.set({ userTier: status.active ? (status.tier || 'premium') : 'free' });
            try { window.eventBus?.emit('tier:changed', status); } catch (_) {}
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
      console.error('Sign in error:', error);
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
    try { window.eventBus?.emit('auth:changed', { user: this.currentUser }); } catch (_) {}
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
      try { window.eventBus?.emit('auth:changed', { user: null }); } catch (_) {}
      try { window.eventBus?.emit('tier:changed', { tier: 'free', active: false, expiresAt: null }); } catch (_) {}
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
      console.error('Password reset error:', error);
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
          try { detail = await response.text(); } catch (_) {}
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
        } catch (_) {}
      }

      // If refresh_token not returned, keep existing one
      if (!data.refresh_token && refreshToken) {
        data.refresh_token = refreshToken;
      }

      await this.handleAuthSuccess(data);
      return true;
    } catch (error) {
      console.error('refreshSession error:', error);
      throw error;
    }
  }

  // Create or update user profile
  async upsertProfile(user) {
    try {
      // Ensure profile exists and has a per-user salt
      const baseProfile = { id: user.id, email: user.email, updated_at: new Date().toISOString() };
      await this._request(`${this.apiUrl}/profiles`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: baseProfile,
        auth: true
      });

      // Fetch current salt
      let salt = null;
      try {
        const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}&select=salt,subscription_tier,subscription_expires_at`, { auth: true });
        if (Array.isArray(arr) && arr[0]) salt = arr[0].salt || null;
      } catch (_) {}

      // If no salt, generate and patch
      if (!salt) {
        const saltBytes = new Uint8Array(32);
        crypto.getRandomValues(saltBytes);
        salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          body: { salt, updated_at: new Date().toISOString() },
          auth: true
        });
      }

      // Update userTier in local storage
      try {
        const status = await this.getSubscriptionStatus();
        await chrome.storage.local.set({ userTier: status.active ? (status.tier || 'premium') : 'free' });
        try { window.eventBus?.emit('tier:changed', status); } catch (_) {}
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

  // Sync notes to cloud using Edge Function
  async syncNotes(syncPayload) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Starting sync with token:', this.accessToken ? 'Present' : 'Missing');
      console.log('API: Sync payload structure:', {
        operation: syncPayload.operation,
        notesCount: syncPayload.notes?.length || 0,
        deletionsCount: syncPayload.deletions?.length || 0,
        hasLastSyncTime: !!syncPayload.lastSyncTime,
        timestamp: syncPayload.timestamp
      });
      
      const encryptedNotes = [];
      
      // Encrypt notes before uploading (only if notes exist)
      if (syncPayload.notes && Array.isArray(syncPayload.notes)) {
        for (const note of syncPayload.notes) {
          console.log('API: Original note before encryption:', {
            id: note.id,
            title: note.title,
            hasContent: !!note.content,
            domain: note.domain
          });
          
          const encryptedNote = await window.noteEncryption.encryptNoteForCloud(
            note, 
            await this.getUserEncryptionKey()
          );
          
          console.log('API: Encrypted note for sync:', {
            id: encryptedNote.id,
            hasTitleEncrypted: !!encryptedNote.title_encrypted,
            hasContentEncrypted: !!encryptedNote.content_encrypted,
            hasContentHash: !!encryptedNote.content_hash
          });
          
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

      console.log('Sync response status:', response.status);
      console.log('Sync response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sync error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Sync failed' };
        }
        throw new Error(errorData.error || `Sync failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('Sync response data:', data);
      return data;
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }

  // Fetch notes from cloud using Edge Function
  async fetchNotes(lastSyncTime = null) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('API: Fetching notes from cloud, lastSyncTime:', lastSyncTime);
      
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
        console.error('Fetch error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Fetch failed' };
        }
        throw new Error(errorData.error || `Fetch failed with status ${response.status}`);
      }

      const responseData = await response.json();
      console.log('API: Raw response from Edge Function:', responseData);
      
      const { notes: encryptedNotes } = responseData;
      
      if (!encryptedNotes || !Array.isArray(encryptedNotes)) {
        console.warn('API: No notes returned from Edge Function or invalid format:', encryptedNotes);
        return [];
      }
      
      console.log(`API: Received ${encryptedNotes.length} notes from cloud`);
      
      const decryptedNotes = [];

      // Decrypt notes after downloading
      const userKey = await this.getUserEncryptionKey();
      console.log('API: User encryption key available:', !!userKey);
      
      for (const encryptedNote of encryptedNotes) {
        try {
          console.log('API: Processing note from cloud:', {
            id: encryptedNote.id,
            hasTitleEncrypted: !!encryptedNote.title_encrypted,
            hasContentEncrypted: !!encryptedNote.content_encrypted,
            hasTitle: !!encryptedNote.title,
            hasContent: !!encryptedNote.content
          });
          
          let decryptedNote;
          
          // Check if note is encrypted or plain text
          if (encryptedNote.title_encrypted && encryptedNote.content_encrypted && userKey) {
            // Note is encrypted, decrypt it
            decryptedNote = await window.noteEncryption.decryptNoteFromCloud(
              encryptedNote, 
              userKey
            );
            console.log('API: Successfully decrypted note:', encryptedNote.id);
          } else if (encryptedNote.title && encryptedNote.content) {
            // Note is plain text, use as-is
            decryptedNote = {
              ...encryptedNote,
              title: encryptedNote.title,
              content: encryptedNote.content
            };
            console.log('API: Using plain text note as-is:', encryptedNote.id);
          } else {
            console.warn('API: Note has neither encrypted nor plain text fields:', encryptedNote.id);
            continue;
          }
          
          decryptedNotes.push(decryptedNote);
        } catch (error) {
          console.error('API: Failed to process note:', encryptedNote.id, error);
          // Try to use the note as-is if decryption fails
          if (encryptedNote.title && encryptedNote.content) {
            console.log('API: Using note as-is after decryption failure:', encryptedNote.id);
            decryptedNotes.push({
              ...encryptedNote,
              title: encryptedNote.title,
              content: encryptedNote.content
            });
          }
        }
      }

      console.log(`API: Successfully processed ${decryptedNotes.length} notes from cloud`);
      return decryptedNotes;
    } catch (error) {
      console.error('API: Fetch error:', error);
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
      const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=salt`, { auth: true });
      salt = arr?.[0]?.salt || null;
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
      const profiles = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=subscription_tier,subscription_expires_at`, { auth: true });
      const profile = profiles?.[0];

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
      const profiles = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=storage_used_bytes`, { auth: true });
      const profile = profiles?.[0];
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

  // Resolve conflicts in cloud
  async resolveConflict(noteId, resolution, localNote = null) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      console.log(`API: Resolving conflict for note ${noteId} with resolution: ${resolution}`);
      
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
        console.error('Conflict resolution error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Conflict resolution failed' };
        }
        throw new Error(errorData.error || `Conflict resolution failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('Conflict resolution response:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Conflict resolution error:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync version history to cloud
  async syncVersions(noteId, versions) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      console.log(`API: Syncing ${versions.length} versions for note ${noteId}`);
      
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
        console.error('Version sync error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Version sync failed' };
        }
        throw new Error(errorData.error || `Version sync failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('Version sync response:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Version sync error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
window.supabaseClient = new SupabaseClient();
