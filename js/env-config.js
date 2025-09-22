// Environment Configuration
// This file can be modified during build/deployment to inject environment variables
// For client-side applications, these are build-time environment variables

// Google OAuth Client IDs
// These can be set during deployment or build process
window.GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || null;
window.GOOGLE_DEV_CLIENT_ID = window.GOOGLE_DEV_CLIENT_ID || null;

// Example deployment script could replace these values:
// sed -i 's/window.GOOGLE_CLIENT_ID = null/window.GOOGLE_CLIENT_ID = "'"$GOOGLE_CLIENT_ID"'"/g' js/env-config.js

// For local development, you can manually set these:
// window.GOOGLE_CLIENT_ID = 'your-production-client-id';
// window.GOOGLE_DEV_CLIENT_ID = 'your-development-client-id';