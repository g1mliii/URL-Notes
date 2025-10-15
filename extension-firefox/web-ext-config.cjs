module.exports = {
  // Firefox development configuration
  sourceDir: './',
  artifactsDir: './web-ext-artifacts/',

  // Ignore files during build
  ignoreFiles: [
    'web-ext-config.cjs',
    'web-ext-config.js',
    'package.json',
    'package-lock.json',
    'node_modules',
    '*.md',
    'test-firefox-setup.js',
    'BROWSER_API_MIGRATION_STATUS.md',
    'README.md',
    '.git',
    '.gitignore',
    '*.log',
    '*.map',
    'assets/create-icons.html',
    'BUILD_QUICK_START.md',
    'PACKAGING.md',
    'DISTRIBUTION_CHECKLIST.md',
    'STORE_LISTING.md'
  ],

  // Firefox-specific settings
  run: {
    startUrl: ['about:debugging#/runtime/this-firefox'],
    keepProfileChanges: true,
    profileCreateIfMissing: true,

    // Auto-reload on file changes
    reload: true,

    // Browser console logging
    browserConsole: true,

    // Custom Firefox preferences for development
    pref: [
      'devtools.chrome.enabled=true',
      'extensions.webextensions.keepStorageOnUninstall=true',
      'extensions.webextensions.keepUuidOnUninstall=true'
    ]
  },

  // Build configuration for production .xpi file
  build: {
    overwriteDest: true,
    filename: 'anchored-firefox-{version}.xpi'
  },

  // Signing configuration for Firefox Add-ons
  // Note: API credentials should be set via environment variables:
  // WEB_EXT_API_KEY and WEB_EXT_API_SECRET
  sign: {
    // Channel for distribution
    // 'listed' = Firefox Add-ons store (requires manual review)
    // 'unlisted' = Self-distribution (automatic signing)
    channel: 'listed',
    
    // API credentials (set via environment variables for security)
    // apiKey: process.env.WEB_EXT_API_KEY,
    // apiSecret: process.env.WEB_EXT_API_SECRET,
    
    // Timeout for signing process (in milliseconds)
    timeout: 900000 // 15 minutes
  },

  // Linting configuration
  lint: {
    pretty: true,
    warningsAsErrors: false,
    selfHosted: false
  }
};