module.exports = {
  // Firefox development configuration
  sourceDir: './extension-firefox/',
  artifactsDir: './web-ext-artifacts/',
  
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
  
  // Build configuration
  build: {
    overwriteDest: true
  },
  
  // Linting configuration
  lint: {
    pretty: true,
    warningsAsErrors: false
  }
};