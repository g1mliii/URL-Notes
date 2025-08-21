# Supabase Deployment Guide

This guide covers deploying the database migrations and Edge Functions for the URL Notes extension.

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   npm install -g supabase
   ```

2. **Supabase project created** at [supabase.com](https://supabase.com)

3. **Project linked locally**
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

## Database Migrations

### 1. Apply Initial Schema
```bash
supabase db push
```

This will apply:
- `001_initial_schema.sql` - Basic tables and RLS policies
- `002_version_history.sql` - Version history and enhanced sync support

### 2. Verify Migration
```bash
supabase db diff
```

## Edge Functions

### 1. Deploy Sync Functions
```bash
# Deploy sync-notes function
supabase functions deploy sync-notes

# Deploy resolve-conflict function  
supabase functions deploy resolve-conflict
```

### 2. Set Environment Variables
```bash
# Set Supabase URL and anon key for functions
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your-anon-key
```

### 3. Verify Functions
```bash
# List deployed functions
supabase functions list

# Test function locally (optional)
supabase functions serve sync-notes
```

## Testing the Setup

### 1. Test Database Connection
```bash
# Connect to your database
supabase db reset
supabase db push
```

### 2. Test Edge Functions
```bash
# Test sync-notes function
curl -X POST https://your-project.supabase.co/functions/v1/sync-notes \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation":"pull","lastSyncTime":null}'
```

## Configuration

### 1. Update Extension Config
In your extension, ensure these URLs match your project:
- `supabaseUrl`: `https://your-project.supabase.co`
- `supabaseAnonKey`: Your project's anon key

### 2. CORS Settings
Edge Functions are configured with CORS headers for browser extensions.

## Troubleshooting

### Common Issues

1. **Function not found (404)**
   - Ensure function is deployed: `supabase functions list`
   - Check function name in URL matches exactly

2. **Authentication errors (401)**
   - Verify JWT token is valid
   - Check RLS policies are correct

3. **Database connection errors**
   - Verify database is accessible
   - Check connection string in secrets

### Debug Mode

Enable function logging:
```bash
supabase functions logs sync-notes --follow
```

## Security Notes

1. **RLS Policies**: All tables have Row Level Security enabled
2. **Authentication**: Functions verify JWT tokens from Supabase Auth
3. **Data Encryption**: Note content is encrypted client-side before sync
4. **Rate Limiting**: Consider implementing rate limiting for production

## Next Steps

After deployment:
1. Test sync functionality in your extension
2. Monitor function logs for errors
3. Set up monitoring and alerting
4. Consider implementing backup strategies
