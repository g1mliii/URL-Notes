# Google Authentication Setup Guide

This guide will walk you through setting up Google authentication for the Anchored web application.

## Prerequisites

1. A Google Cloud Platform account
2. Access to your Supabase project dashboard
3. Your production domain (anchored.site) and development domain (localhost)

## Step 1: Google Cloud Console Setup

### 1.1 Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID for reference

### 1.2 Enable Google+ API (if not already enabled)

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google+ API" and enable it
3. This is required for the profile information access

### 1.3 Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace)
3. Fill in the required information:
   - **App name**: Anchored
   - **User support email**: info@anchored.site
   - **App logo**: Upload your Anchored logo (optional but recommended)
   - **App domain**: anchored.site
   - **Authorized domains**: Add `anchored.site`
   - **Developer contact information**: info@anchored.site

### 1.4 Configure Scopes

1. In the "Scopes" section, add these scopes:
   - `openid` (add manually)
   - `.../auth/userinfo.email` (should be added by default)
   - `.../auth/userinfo.profile` (should be added by default)

### 1.5 Create OAuth 2.0 Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Choose "Web application" as the application type
4. Configure the client:

   **Name**: Anchored Web App

   **Authorized JavaScript origins**:
   - `https://anchored.site`
   - `http://localhost:3000` (for development)
   - `http://localhost:8080` (for development)
   - `http://127.0.0.1:3000` (for development)

   **Authorized redirect URIs**:
   - `https://kqjcorjjvunmyrnzvqgr.supabase.co/auth/v1/callback`
   - `http://localhost:54321/auth/v1/callback` (for local Supabase development)

5. Click "Create"
6. **IMPORTANT**: Copy the Client ID and Client Secret - you'll need these for the next steps

## Step 2: Supabase Configuration

### 2.1 Configure Google Provider in Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to "Authentication" > "Providers"
4. Find "Google" in the list and click to configure
5. Enable the Google provider
6. Enter the credentials from Step 1.5:
   - **Client ID**: The Client ID from Google Cloud Console
   - **Client Secret**: The Client Secret from Google Cloud Console
7. Click "Save"

### 2.2 Configure Redirect URLs (if not already set)

1. In Supabase Dashboard, go to "Authentication" > "URL Configuration"
2. Ensure these URLs are in your redirect allow list:
   - `https://anchored.site/`
   - `https://anchored.site/dashboard`
   - `https://anchored.site/account`
   - `http://localhost:3000/` (for development)

## Step 3: Update Application Configuration

### 3.1 Update config.js

Replace the placeholder Google Client ID in `config.js`:

```javascript
// Google OAuth configuration
google: {
  // Production Google OAuth Client ID (replace with your actual Client ID)
  clientId: 'YOUR_ACTUAL_CLIENT_ID_HERE.apps.googleusercontent.com',
  // Development/localhost client ID (use same or create separate one)
  devClientId: 'YOUR_ACTUAL_CLIENT_ID_HERE.apps.googleusercontent.com'
},
```

**Replace `YOUR_ACTUAL_CLIENT_ID_HERE` with the actual Client ID from Step 1.5**

### 3.2 Environment Variables (Optional)

For additional security, you can use environment variables:

```javascript
// In config.js, you could modify to use environment variables:
google: {
  clientId: process.env.GOOGLE_CLIENT_ID || 'YOUR_FALLBACK_CLIENT_ID',
  devClientId: process.env.GOOGLE_DEV_CLIENT_ID || 'YOUR_FALLBACK_CLIENT_ID'
},
```

## Step 4: Testing

### 4.1 Test in Development

1. Start your local development server
2. Navigate to the login page
3. You should see a "Sign in with Google" button
4. Click it and verify the Google OAuth flow works
5. Check that you're redirected back and logged in successfully

### 4.2 Test in Production

1. Deploy your changes to production
2. Navigate to https://anchored.site
3. Test the Google Sign-In flow
4. Verify that users can sign in and access the dashboard

## Step 5: Security Considerations

### 5.1 Domain Verification (Recommended)

1. In Google Cloud Console, go to "OAuth consent screen"
2. Add domain verification for `anchored.site`
3. This improves user trust and reduces phishing risk

### 5.2 Brand Verification (Optional)

1. Submit your app for brand verification
2. This can take several business days
3. Improves the consent screen appearance

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**:
   - Check that your redirect URIs in Google Cloud Console match exactly
   - Ensure you're using the correct Supabase project URL

2. **"invalid_client" error**:
   - Verify the Client ID is correct in both Google Cloud Console and config.js
   - Check that the Client Secret is correctly set in Supabase

3. **Google Sign-In button not appearing**:
   - Check browser console for JavaScript errors
   - Verify the Google Sign-In script is loading
   - Ensure the Client ID is not the placeholder value

4. **CSP (Content Security Policy) errors**:
   - The layout has been updated to allow Google domains
   - If you see CSP errors, check the meta tag in `_layouts/default.html`

### Debug Steps

1. Check browser developer console for errors
2. Verify network requests to Google APIs are successful
3. Check Supabase logs for authentication errors
4. Test with different browsers and incognito mode

## Production Checklist

- [ ] Google Cloud project created and configured
- [ ] OAuth consent screen configured with correct domains
- [ ] OAuth 2.0 Client ID created with correct redirect URIs
- [ ] Supabase Google provider enabled and configured
- [ ] Client ID updated in config.js (not placeholder)
- [ ] CSP headers allow Google domains
- [ ] Tested in development environment
- [ ] Tested in production environment
- [ ] Domain verification completed (recommended)

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify all URLs and Client IDs are correct
3. Test the regular email/password authentication to ensure Supabase is working
4. Contact support at info@anchored.site if needed

## Security Notes

- The Client ID is public and safe to include in client-side code
- The Client Secret should only be stored in Supabase (server-side)
- Never commit Client Secrets to version control
- Use HTTPS in production for all OAuth flows
- Consider implementing additional security measures like nonce validation (already implemented)