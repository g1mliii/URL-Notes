
-- Update RLS policies for production domain
UPDATE auth.users SET raw_app_meta_data = 
  COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  '{"allowed_domains": ["anchored.site", "localhost"]}'::jsonb;

-- Ensure CORS is configured for production domain
-- This would typically be done through Supabase dashboard or CLI
