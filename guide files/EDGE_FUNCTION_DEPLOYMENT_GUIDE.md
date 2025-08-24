# Edge Function Deployment Guide

## Overview
This guide will help you deploy the Edge Functions to Supabase and resolve the 401 Unauthorized error you're experiencing.

## Prerequisites
- Supabase project already set up
- Database migrations already applied
- Supabase CLI installed (optional, for troubleshooting)

## Step 1: Deploy Edge Functions via Supabase UI

### 1.1 Navigate to Edge Functions
1. Go to your Supabase project dashboard
2. Click on "Edge Functions" in the left sidebar
3. Click "Create a new function"

### 1.2 Create sync-notes Function
1. Function name: `sync-notes`
2. Click "Create function"
3. Replace the default `index.ts` content with the code from `supabase/functions/sync-notes/index.ts`
4. Click "Deploy"

### 1.3 Create resolve-conflict Function
1. Function name: `resolve-conflict`
2. Click "Create function"
3. Replace the default `index.ts` content with the code from `supabase/functions/resolve-conflict/index.ts`
4. Click "Deploy"

## Step 2: Verify Function Deployment

### 2.1 Check Function Status
- Both functions should show "Active" status
- Note the function URLs (they should be accessible)

### 2.2 Test Function Endpoints
The functions should be available at:
- `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/sync-notes`
- `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/resolve-conflict`

## Step 3: Troubleshoot 401 Error

### 3.1 Common Causes
1. **Function not deployed**: Check if functions are active
2. **Authentication token expired**: User needs to re-authenticate
3. **RLS policies blocking access**: Check database policies
4. **Function environment variables**: Verify SUPABASE_URL and SUPABASE_ANON_KEY

### 3.2 Debug Steps

#### Step 3.2.1: Check Browser Console
Open the extension popup and check the console for:
- Authentication status
- Token presence
- Response details

#### Step 3.2.2: Verify Authentication
1. Check if user is signed in: `chrome.storage.local.get(['supabase_session'])`
2. Verify token is valid and not expired
3. Check if `accessToken` is present in the API client

#### Step 3.2.3: Test with Supabase CLI (Optional)
If you have Supabase CLI installed:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref [YOUR_PROJECT_REF]

# Test function locally
supabase functions serve sync-notes --env-file .env.local

# Deploy functions
supabase functions deploy sync-notes
supabase functions deploy resolve-conflict
```

### 3.3 Environment Variables Check
Edge Functions automatically have access to:
- `SUPABASE_URL`: Your project URL
- `SUPABASE_ANON_KEY`: Your project's anon key

These are set automatically by Supabase.

### 3.4 RLS Policy Verification
Ensure your database has the correct RLS policies:

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('notes', 'profiles');

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'notes';
```

## Step 4: Test the Functions

### 4.1 Test Authentication Flow
1. Sign out and sign back in to refresh tokens
2. Check if the 401 error persists
3. Verify the user session in Supabase dashboard

### 4.2 Test Function Endpoints
Use a tool like Postman or curl to test:

```bash
# Test sync-notes function
curl -X POST "https://[YOUR_PROJECT_REF].supabase.co/functions/v1/sync-notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [USER_ACCESS_TOKEN]" \
  -H "apikey: [YOUR_ANON_KEY]" \
  -d '{"operation": "pull", "lastSyncTime": null}'
```

## Step 5: Common Solutions

### 5.1 Token Refresh Issue
If tokens are expiring:
1. Implement automatic token refresh
2. Check token expiration logic in `api.js`
3. Ensure proper session management

### 5.2 RLS Policy Issues
If RLS is blocking access:
1. Verify user authentication in Supabase
2. Check if user exists in `profiles` table
3. Ensure RLS policies allow authenticated users

### 5.3 Function Configuration
If functions aren't working:
1. Redeploy functions
2. Check function logs in Supabase dashboard
3. Verify function code syntax

## Step 6: Verification

### 6.1 Successful Deployment Signs
- Functions show "Active" status
- No 401 errors in console
- Sync operations complete successfully
- Notes are syncing between devices

### 6.2 Next Steps
Once functions are working:
1. Test full sync workflow
2. Verify conflict resolution
3. Test offline/online scenarios
4. Monitor function performance

## Troubleshooting Checklist

- [ ] Functions deployed and active
- [ ] User authenticated with valid token
- [ ] RLS policies configured correctly
- [ ] Function environment variables accessible
- [ ] No syntax errors in function code
- [ ] CORS headers properly set
- [ ] Authentication headers sent correctly

## Support

If issues persist:
1. Check Supabase function logs
2. Verify database connectivity
3. Test with minimal function code
4. Contact Supabase support if needed

## Notes

- Edge Functions run in Deno runtime
- URL imports are correct for Deno
- Functions automatically have access to project environment
- Authentication is handled via JWT tokens
- RLS policies must allow function access
