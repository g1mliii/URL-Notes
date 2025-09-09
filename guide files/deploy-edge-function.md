# Deploy Edge Function

To deploy the updated edge function, you need to run:

```bash
supabase functions deploy sync-notes
```

If you don't have Supabase CLI installed, you can:

1. Install it following the instructions at: https://supabase.com/docs/guides/cli/getting-started
2. Or manually update the function in the Supabase dashboard

## Alternative: Manual Deployment

If you can't use the CLI, you can:

1. Go to your Supabase dashboard
2. Navigate to Edge Functions
3. Find the `sync-notes` function
4. Replace the code with the content from `supabase/functions/sync-notes/index.ts`

## Current Status

The web application now has a fallback mechanism that uses direct database access if the edge function fails with "Invalid operation". This should allow notes to sync even if the edge function hasn't been updated yet.

## Testing

After deployment, test by:
1. Creating a new note in the web dashboard
2. Checking the browser console for detailed logging
3. Verifying the note appears in the database
4. Testing with the browser extension to ensure compatibility