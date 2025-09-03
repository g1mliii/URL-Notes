-- Test query to check if functions have search_path set
-- Run this in your Supabase SQL editor to verify the migration was applied

-- Check function definitions for search_path
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('increment_ai_usage', 'sync_notes_simple', 'check_ai_usage')
ORDER BY p.proname;

-- Alternative query to check search_path specifically
SELECT 
    p.proname as function_name,
    p.proconfig as function_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('increment_ai_usage', 'sync_notes_simple', 'check_ai_usage');
