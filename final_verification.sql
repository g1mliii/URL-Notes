-- Final verification query after applying migration 015
-- This should show all functions with search_path properly set

SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    p.proconfig as function_config,
    pg_get_function_arguments(p.oid) as arguments,
    p.prorettype::regtype as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('increment_ai_usage', 'sync_notes_simple', 'check_ai_usage')
ORDER BY p.proname, p.oid;

-- Expected result: All functions should have ["search_path=public"] in function_config
-- No functions should have null in function_config
