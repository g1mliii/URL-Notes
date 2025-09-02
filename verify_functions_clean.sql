-- Verification query to run after applying migration 014
-- This should show only one version of each function with search_path set

-- Check function definitions for search_path
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    p.proconfig as function_config,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('increment_ai_usage', 'sync_notes_simple', 'check_ai_usage')
ORDER BY p.proname, p.oid;

-- Expected result: Each function should appear only once with ["search_path=public"] in function_config
