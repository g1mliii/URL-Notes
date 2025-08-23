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
          // Check if we need to create/update profile (only if not done recently)
          try {
            const { profileLastChecked, userTier } = await chrome.storage.local.get(['profileLastChecked', 'userTier']);
            const now = Date.now();
            const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
            
            console.log('Profile check: profileLastChecked:', profileLastChecked, 'userTier:', userTier, 'timeDiff:', profileLastChecked ? (now - profileLastChecked) / 1000 : 'N/A', 'seconds');
            
            // Only check profile if we haven't done so in the last hour AND don't have userTier
            if ((!profileLastChecked || (now - profileLastChecked) > oneHour) && !userTier) {
              console.log('Profile check: Making API call to upsertProfile');
              await this.upsertProfile(this.currentUser);
              await chrome.storage.local.set({ profileLastChecked: now });
            } else if (userTier) {
              console.log('Profile check: Using cached userTier:', userTier);
              // Use cached subscription status
              try { window.eventBus?.emit('tier:changed', { tier: userTier, active: userTier !== 'free' }); } catch (_) {}
              if (window.adManager) {
                if (userTier !== 'free') {
                  window.adManager.hideAdContainer?.();
                } else {
                  window.adManager.refreshAd?.();
                }
              }
            }
          } catch (e) {
            console.warn('Failed to handle profile on init:', e);
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
      // Clear all caches
      await chrome.storage.local.remove(['userTier', 'profileLastChecked', 'subscriptionLastChecked', 'cachedSubscription', 'encryptionKeyLastChecked', 'cachedKeyMaterial', 'cachedSalt']);
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
      console.log('upsertProfile: Starting profile check/creation for user:', user.id);
      
      // First, check if profile exists and get current data
      let profile = null;
      try {
        console.log('upsertProfile: Checking if profile exists');
        const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}&select=salt,subscription_tier,subscription_expires_at`, { auth: true });
        if (Array.isArray(arr) && arr[0]) profile = arr[0];
        console.log('upsertProfile: Profile check result:', {
          hasProfile: !!profile,
          hasSalt: !!profile?.salt,
          hasTier: !!profile?.subscription_tier,
          hasExpiresAt: !!profile?.subscription_expires_at
        });
      } catch (error) {
        console.warn('upsertProfile: Error checking profile existence:', error);
      }

      // Only create profile if it doesn't exist
      if (!profile) {
        console.log('upsertProfile: Profile does not exist, creating new one');
        const baseProfile = { id: user.id, email: user.email, updated_at: new Date().toISOString() };
        await this._request(`${this.apiUrl}/profiles`, {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: baseProfile,
          auth: true
        });
        console.log('upsertProfile: New profile created successfully');
        
        // Fetch the newly created profile
        try {
          console.log('upsertProfile: Fetching newly created profile');
          const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}&select=salt,subscription_tier,subscription_expires_at`, { auth: true });
          if (Array.isArray(arr) && arr[0]) profile = arr[0];
          console.log('upsertProfile: New profile fetched:', {
            hasProfile: !!profile,
            hasSalt: !!profile?.salt
          });
        } catch (error) {
          console.warn('upsertProfile: Error fetching newly created profile:', error);
        }
      }

      // Generate salt only if missing
      if (profile && !profile.salt) {
        console.log('upsertProfile: Profile missing salt, generating new one');
        const saltBytes = new Uint8Array(32);
        crypto.getRandomValues(saltBytes);
        const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await this._request(`${this.apiUrl}/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          body: { salt, updated_at: new Date().toISOString() },
          auth: true
        });
        console.log('upsertProfile: Salt generated and saved to profile');
        // Update local profile object
        profile = { ...profile, salt };
      }

      // Update userTier in local storage using the profile we already fetched
      if (profile) {
        const isActive = profile.subscription_expires_at ?
          new Date(profile.subscription_expires_at) > new Date() : false;
        const userTier = isActive ? (profile.subscription_tier || 'premium') : 'free';
        
        console.log('upsertProfile: Setting userTier and caching profile data:', {
          userTier,
          isActive,
          hasExpiresAt: !!profile.subscription_expires_at,
          hasSalt: !!profile.salt
        });
        
        await chrome.storage.local.set({ userTier });
        
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
        
        console.log('upsertProfile: Profile data cached successfully');
        
        try { window.eventBus?.emit('tier:changed', { tier: userTier, active: isActive, expiresAt: profile.subscription_expires_at }); } catch (_) {}
        if (window.adManager) {
          if (isActive && userTier !== 'free') {
            window.adManager.hideAdContainer?.();
          } else {
            window.adManager.refreshAd?.();
          }
        }
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

  // Get user's encryption key (with caching to prevent multiple API calls)
  async getUserEncryptionKey() {
    if (!this.currentUser) {
      console.log('getUserEncryptionKey: No authenticated user');
      throw new Error('No authenticated user');
    }

    // Check if we have cached key material and salt
    const { encryptionKeyLastChecked, cachedKeyMaterial, cachedSalt } = await chrome.storage.local.get(['encryptionKeyLastChecked', 'cachedKeyMaterial', 'cachedSalt']);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour cache

    console.log('getUserEncryptionKey: Cache check:', {
      hasCache: !!(cachedKeyMaterial && cachedSalt),
      lastChecked: encryptionKeyLastChecked ? new Date(encryptionKeyLastChecked).toISOString() : 'N/A',
      timeDiff: encryptionKeyLastChecked ? Math.round((now - encryptionKeyLastChecked) / 1000) : 'N/A',
      isRecent: encryptionKeyLastChecked ? (now - encryptionKeyLastChecked) < oneHour : false
    });

    // Use cached material if it's recent
    if (encryptionKeyLastChecked && cachedKeyMaterial && cachedSalt && (now - encryptionKeyLastChecked) < oneHour) {
      console.log('getUserEncryptionKey: Using cached material to regenerate key');
      const cachedKey = await window.noteEncryption.generateKey(cachedKeyMaterial, cachedSalt);
      return cachedKey;
    }

    console.log('getUserEncryptionKey: Making API call to get salt');

    // Derive key from stable user material + per-user salt from profile
    const keyMaterial = `${this.currentUser.id}:${this.currentUser.email}`;
    let salt = null;
    
    // Try to get salt from cached profile data first
    try {
      const { cachedSubscription } = await chrome.storage.local.get(['cachedSubscription']);
      console.log('getUserEncryptionKey: Checking cached subscription for salt:', {
        hasCachedSubscription: !!cachedSubscription,
        hasSalt: !!cachedSubscription?.salt
      });
      if (cachedSubscription?.salt) {
        salt = cachedSubscription.salt;
        console.log('getUserEncryptionKey: Using salt from cached subscription');
      }
    } catch (error) {
      console.warn('getUserEncryptionKey: Error checking cached subscription:', error);
    }

    // If no cached salt, fetch from API
    if (!salt) {
      console.log('getUserEncryptionKey: No cached salt, fetching from API');
      try {
        const arr = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=salt`, { auth: true });
        salt = arr?.[0]?.salt || null;
        console.log('getUserEncryptionKey: API salt response:', {
          hasResponse: !!arr,
          responseLength: arr?.length || 0,
          hasSalt: !!salt
        });
      } catch (error) {
        console.warn('getUserEncryptionKey: Error fetching salt from API:', error);
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
      console.warn('getSession error:', e);
      return null;
    }
  }

  // Check subscription status (with caching to prevent multiple API calls)
  async getSubscriptionStatus() {
    if (!this.isAuthenticated()) {
      console.log('getSubscriptionStatus: User not authenticated, returning free tier');
      return { tier: 'free', active: false };
    }

    try {
      // Check if we have cached subscription status
      const { subscriptionLastChecked, cachedSubscription } = await chrome.storage.local.get(['subscriptionLastChecked', 'cachedSubscription']);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes cache

      console.log('getSubscriptionStatus: Cache check:', {
        hasCache: !!cachedSubscription,
        lastChecked: subscriptionLastChecked ? new Date(subscriptionLastChecked).toISOString() : 'N/A',
        timeDiff: subscriptionLastChecked ? Math.round((now - subscriptionLastChecked) / 1000) : 'N/A',
        isRecent: subscriptionLastChecked ? (now - subscriptionLastChecked) < fiveMinutes : false
      });

      // Use cached data if it's recent
      if (subscriptionLastChecked && cachedSubscription && (now - subscriptionLastChecked) < fiveMinutes) {
        console.log('getSubscriptionStatus: Using cached data:', cachedSubscription);
        return cachedSubscription;
      }

      // Fetch fresh data from API
      console.log('getSubscriptionStatus: Fetching fresh data from API');
      const profiles = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=subscription_tier,subscription_expires_at,salt`, { auth: true });
      const profile = profiles?.[0];

      console.log('getSubscriptionStatus: API response:', {
        profilesCount: profiles?.length || 0,
        hasProfile: !!profile,
        profileData: profile ? {
          hasTier: !!profile.subscription_tier,
          hasExpiresAt: !!profile.subscription_expires_at,
          hasSalt: !!profile.salt
        } : null
      });

      if (!profile) {
        const result = { tier: 'free', active: false };
        console.log('getSubscriptionStatus: No profile found, caching free tier result');
        // Cache the result
        await chrome.storage.local.set({ 
          subscriptionLastChecked: now, 
          cachedSubscription: result 
        });
        return result;
      }

      const isActive = profile.subscription_expires_at ?
        new Date(profile.subscription_expires_at) > new Date() : false;

      const result = {
        tier: profile.subscription_tier || 'free',
        active: isActive,
        expiresAt: profile.subscription_expires_at,
        salt: profile.salt // Include salt for encryption key reuse
      };

      console.log('getSubscriptionStatus: Caching result:', {
        tier: result.tier,
        active: result.active,
        hasExpiresAt: !!result.expiresAt,
        hasSalt: !!result.salt
      });

      // Cache the result
      await chrome.storage.local.set({ 
        subscriptionLastChecked: now, 
        cachedSubscription: result 
      });

      return result;
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
      console.log('getStorageUsage: User not authenticated, returning 0 usage');
      return { used: 0, limit: 0 };
    }

    try {
      console.log('getStorageUsage: Fetching storage and subscription info');
      // Get both storage_used_bytes and subscription info in ONE API call
      const profiles = await this._request(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=storage_used_bytes,subscription_tier,subscription_expires_at`, { auth: true });
      const profile = profiles?.[0];
      
      console.log('getStorageUsage: API response:', {
        profilesCount: profiles?.length || 0,
        hasProfile: !!profile,
        storageUsed: profile?.storage_used_bytes || 0,
        hasTier: !!profile?.subscription_tier,
        hasExpiresAt: !!profile?.subscription_expires_at
      });
      
      if (!profile) {
        console.log('getStorageUsage: No profile found, returning 0 usage');
        return { used: 0, limit: 0 };
      }

      // Calculate limit locally instead of calling getSubscriptionStatus()
      const isActive = profile.subscription_expires_at ?
        new Date(profile.subscription_expires_at) > new Date() : false;
      const tier = isActive ? (profile.subscription_tier || 'premium') : 'free';
      
      const limit = tier === 'premium' ? 
        1024 * 1024 * 1024 : // 1GB for premium
        100 * 1024 * 1024;   // 100MB for free

      const result = {
        used: profile?.storage_used_bytes || 0,
        limit: limit
      };

      console.log('getStorageUsage: Calculated result:', {
        used: result.used,
        limit: result.limit,
        tier,
        isActive
      });

      return result;
    } catch (error) {
      console.error('getStorageUsage: Error getting storage usage:', error);
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
        console.error(`RPC ${functionName} error response:`, errorText);
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
      console.error(`RPC ${functionName} error:`, error);
      return { data: null, error: error.message };
    }
  }
}

// Export singleton instance
window.supabaseClient = new SupabaseClient();
