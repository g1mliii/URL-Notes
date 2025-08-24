-- Check the test note to see what fields are actually present
-- This will help debug why the URL is not working

-- Step 1: Find your user ID (replace with your actual email)
SELECT id, email, subscription_tier FROM public.profiles WHERE email = 'your-email@example.com';

-- Step 2: Check the test note structure (replace 'your-user-id-here' with your actual user ID)
SELECT 
    id,
    user_id,
    url,
    domain,
    title_encrypted,
    content_encrypted,
    content_hash,
    created_at,
    updated_at,
    last_synced_at,
    sync_pending,
    is_deleted,
    -- Check if fields are NULL or empty
    CASE 
        WHEN url IS NULL THEN 'URL is NULL'
        WHEN url = '' THEN 'URL is empty string'
        ELSE 'URL has value: ' || url
    END as url_status,
    CASE 
        WHEN domain IS NULL THEN 'Domain is NULL'
        WHEN domain = '' THEN 'Domain is empty string'
        ELSE 'Domain has value: ' || domain
    END as domain_status
FROM public.notes 
WHERE user_id = 'your-user-id-here'::uuid  -- Replace with your actual user ID
ORDER BY created_at DESC;

-- Step 3: Check if there are any notes with missing URL/domain
SELECT 
    COUNT(*) as total_notes,
    COUNT(CASE WHEN url IS NULL OR url = '' THEN 1 END) as notes_without_url,
    COUNT(CASE WHEN domain IS NULL OR domain = '' THEN 1 END) as notes_without_domain,
    COUNT(CASE WHEN url IS NOT NULL AND url != '' AND domain IS NOT NULL AND domain != '' THEN 1 END) as notes_with_both
FROM public.notes 
WHERE user_id = 'your-user-id-here'::uuid;  -- Replace with your actual user ID
