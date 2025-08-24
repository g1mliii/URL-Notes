// URL Notes Web App - Supabase API Client
// Based on proven patterns from the browser extension

class SupabaseClient {
  public supabaseUrl: string
  public supabaseAnonKey: string
  public apiUrl: string
  public authUrl: string
  public currentUser: any
  public accessToken: string | null

  constructor() {
    // Use environment variables for configuration
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    this.supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    this.apiUrl = `${this.supabaseUrl}/rest/v1`
    this.authUrl = `${this.supabaseUrl}/auth/v1`
    this.currentUser = null
    this.accessToken = null
  }

  // Get authorization headers
  getHeaders(includeAuth = true) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.supabaseAnonKey
    }

    if (includeAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    return headers
  }

  // Initialize client - check for stored session
  async init() {
    try {
      const session = localStorage.getItem('supabase_session')
      if (session) {
        const sessionData = JSON.parse(session)
        this.accessToken = sessionData.access_token
        this.currentUser = sessionData.user
        
        const expiresAt = sessionData.expires_at || 0
        const now = Date.now()
        
        // If token is expired or expiring within 60s, try to refresh
        if (!expiresAt || (expiresAt - now) < 60000) {
          try {
            await this.refreshSession()
          } catch (e) {
            console.warn('Token refresh on init failed, signing out:', e)
            await this.signOut()
          }
        }
        
        // Verify token is still valid
        const isValid = await this.verifyToken()
        if (!isValid) {
          await this.signOut()
        }
      }
    } catch (error) {
      console.error('Error initializing Supabase client:', error)
    }
  }

  // Sign in with email and password
  async signInWithEmail(email: string, password: string) {
    try {
      const response = await fetch(`${this.authUrl}/token?grant_type=password`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error_description || 'Sign in failed')
      }

      const data = await response.json()
      await this.handleAuthSuccess(data)
      return { data, error: null }
    } catch (error: any) {
      console.error('Sign in error:', error)
      return { data: null, error }
    }
  }

  // Sign up with email and password
  async signUpWithEmail(email: string, password: string) {
    try {
      const response = await fetch(`${this.authUrl}/signup`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error_description || 'Sign up failed')
      }

      const data = await response.json()
      if (data.access_token) {
        await this.handleAuthSuccess(data)
      }
      return { data, error: null }
    } catch (error: any) {
      console.error('Sign up error:', error)
      return { data: null, error }
    }
  }

  // Handle successful authentication
  async handleAuthSuccess(authData: any) {
    this.accessToken = authData.access_token
    this.currentUser = authData.user

    // Store session in localStorage
    const sessionData = {
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      user: authData.user,
      expires_at: Date.now() + (authData.expires_in * 1000)
    }
    localStorage.setItem('supabase_session', JSON.stringify(sessionData))

    // Create or update user profile
    await this.upsertProfile(authData.user)
  }

  // Sign out
  async signOut() {
    try {
      if (this.accessToken) {
        await fetch(`${this.authUrl}/logout`, {
          method: 'POST',
          headers: this.getHeaders()
        })
      }
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      // Clear local session
      this.accessToken = null
      this.currentUser = null
      localStorage.removeItem('supabase_session')
    }
  }

  // Reset password
  async resetPassword(email: string) {
    try {
      const response = await fetch(`${this.authUrl}/recover`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({
          email: email,
          type: 'recovery'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error_description || 'Password reset failed')
      }

      return { error: null }
    } catch (error: any) {
      console.error('Password reset error:', error)
      return { error: error.message }
    }
  }

  // Verify token validity
  async verifyToken() {
    if (!this.accessToken) return false

    try {
      const response = await fetch(`${this.authUrl}/user`, {
        headers: this.getHeaders()
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  // Refresh session using refresh_token
  async refreshSession() {
    try {
      const session = localStorage.getItem('supabase_session')
      if (!session) throw new Error('No session available')
      
      const sessionData = JSON.parse(session)
      const refreshToken = sessionData.refresh_token
      if (!refreshToken) throw new Error('No refresh token available')

      const response = await fetch(`${this.authUrl}/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error_description || 'Refresh failed')
      }

      const data = await response.json()

      // If refresh_token not returned, keep existing one
      if (!data.refresh_token && refreshToken) {
        data.refresh_token = refreshToken
      }

      await this.handleAuthSuccess(data)
      return true
    } catch (error) {
      console.error('refreshSession error:', error)
      throw error
    }
  }

  // Create or update user profile
  async upsertProfile(user: any) {
    try {
      const baseProfile = { 
        id: user.id, 
        email: user.email, 
        updated_at: new Date().toISOString() 
      }
      
      const response = await fetch(`${this.apiUrl}/profiles`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(baseProfile)
      })

      if (!response.ok) {
        console.warn('Profile upsert failed, but continuing...')
      }
    } catch (error) {
      console.error('Error upserting profile:', error)
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!(this.accessToken && this.currentUser)
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser
  }

  // Get subscription status
  async getSubscriptionStatus() {
    if (!this.isAuthenticated()) {
      return { tier: 'free', active: false }
    }

    try {
      const response = await fetch(`${this.apiUrl}/profiles?id=eq.${this.currentUser.id}&select=subscription_tier,subscription_expires_at`, {
        headers: this.getHeaders()
      })

      if (!response.ok) {
        return { tier: 'free', active: false }
      }

      const profiles = await response.json()
      const profile = profiles?.[0]

      if (!profile) {
        return { tier: 'free', active: false }
      }

      const isActive = profile.subscription_expires_at ?
        new Date(profile.subscription_expires_at) > new Date() : false

      return {
        tier: profile.subscription_tier || 'free',
        active: isActive,
        expiresAt: profile.subscription_expires_at
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      return { tier: 'free', active: false }
    }
  }
}

// Export singleton instance
export const supabaseClient = new SupabaseClient()

// Legacy exports for compatibility
export const supabase = supabaseClient
export const createClient = () => supabaseClient
