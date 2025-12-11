// Anchored Web Application Configuration
// Environment-specific configuration for production deployment

window.urlNotesConfig = {
  // Production configuration
  production: {
    supabaseUrl: 'https://kqjcorjjvunmyrnzvqgr.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxamNvcmpqdnVubXlybnp2cWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTc4ODgsImV4cCI6MjA3MTI5Mzg4OH0.l-ZdPOYMNi8x3lBqlemwQ2elDyvoPy-2ZUWuODVviWk',
    environment: 'production',
    domain: 'anchored.site',
    httpsOnly: true
  },

  // Development configuration
  development: {
    supabaseUrl: 'https://kqjcorjjvunmyrnzvqgr.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxamNvcmpqdnVubXlybnp2cWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTc4ODgsImV4cCI6MjA3MTI5Mzg4OH0.l-ZdPOYMNi8x3lBqlemwQ2elDyvoPy-2ZUWuODVviWk',
    environment: 'development',
    domain: 'localhost',
    httpsOnly: false
  },

  // Stripe configuration
  stripe: {
    // Live Stripe product and price IDs (public-safe identifiers)
    productId: 'prod_SzJCRQMmohjH3D',
    premiumPriceId: 'price_1S7o87PEFS1nRTYDqozxz8We',
    productName: 'Anchored Premium',
    monthlyPrice: 2.50,
    currency: 'usd'
  },

  // Google OAuth configuration
  google: {
    // Production Google OAuth Client ID (public-safe identifier)
    // Can be overridden by environment variables during build/deployment
    clientId: window.GOOGLE_CLIENT_ID || '222304352528-f4d1n0fbsmlrh34bnaurjmrol48mqcr1.apps.googleusercontent.com',
    // Development/localhost client ID (if different)
    devClientId: window.GOOGLE_DEV_CLIENT_ID || '222304352528-f4d1n0fbsmlrh34bnaurjmrol48mqcr1.apps.googleusercontent.com'
  },

  // Get current environment configuration
  getCurrentConfig() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Force HTTPS in production (skip for crawlers)
    const isSearchEngineCrawler = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      return ['googlebot', 'bingbot', 'slurp', 'duckduckbot'].some(crawler => userAgent.includes(crawler));
    };

    if (hostname === 'anchored.site' && protocol === 'http:' && !isSearchEngineCrawler()) {
      window.location.href = window.location.href.replace('http:', 'https:');
      return;
    }

    // Determine environment based on hostname
    if (hostname === 'anchored.site') {
      return this.production;
    } else {
      return this.development;
    }
  },

  // Get Google OAuth Client ID for current environment
  getGoogleClientId() {
    const hostname = window.location.hostname;
    if (hostname === 'anchored.site') {
      return this.google.clientId;
    } else {
      return this.google.devClientId;
    }
  },

  // Load configuration for the current environment
  async loadConfig() {
    const config = this.getCurrentConfig();

    // Validate HTTPS in production
    if (config.httpsOnly && window.location.protocol === 'http:') {
      // Redirect to HTTPS
      window.location.href = window.location.href.replace('http:', 'https:');
      return;
    }

    return config;
  },

  // Security headers and CSP configuration
  getSecurityConfig() {
    return {
      contentSecurityPolicy: {
        'default-src': "'self'",
        'script-src': "'self' https://kqjcorjjvunmyrnzvqgr.supabase.co https://accounts.google.com https://apis.google.com",
        'style-src': "'self' 'unsafe-inline'",
        'connect-src': "'self' https://kqjcorjjvunmyrnzvqgr.supabase.co wss://kqjcorjjvunmyrnzvqgr.supabase.co https://accounts.google.com",
        'img-src': "'self' data: https:",
        'font-src': "'self'",
        'object-src': "'none'",
        'base-uri': "'self'",
        'form-action': "'self'",
        'frame-ancestors': "'none'",
        'upgrade-insecure-requests': ''
      },

      // Additional security headers
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      }
    };
  }
};

// Initialize configuration on load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const config = await window.urlNotesConfig.loadConfig();
    // Configuration loaded silently for production
  } catch (error) {
    // Configuration load failed silently for production
  }
});