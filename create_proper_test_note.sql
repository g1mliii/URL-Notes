-- Create a PROPER test note with the exact structure the extension expects
-- This should work correctly with the sync functionality

-- Step 1: Find your user ID (replace with your actual email)
SELECT id, email, subscription_tier FROM public.profiles WHERE email = 'your-email@example.com';

-- Step 2: Create a proper test note with the exact structure
-- This matches what the extension sends during sync
INSERT INTO public.notes (
    id, 
    user_id, 
    title_encrypted, 
    content_encrypted, 
    content_hash,
    url,
    domain,
    created_at, 
    updated_at, 
    last_synced_at, 
    sync_pending,
    is_deleted
) VALUES (
    gen_random_uuid(),
    'your-user-id-here'::uuid,  -- Replace with your actual user ID from Step 1
    
    -- Simple encrypted title (will trigger fallback content)
    '{"encrypted": [84, 101, 115, 116], "iv": [1, 2, 3, 4], "algorithm": "AES-GCM"}'::jsonb,
    
    -- Simple encrypted content (will trigger fallback content)
    '{"encrypted": [84, 104, 105, 115, 32, 105, 115, 32, 97, 32, 116, 101, 115, 116], "iv": [5, 6, 7, 8], "algorithm": "AES-GCM"}'::jsonb,
    
    'proper-test-hash-12345',
    'https://github.com/yourusername/url-notes-extension',  -- Test URL - REPLACE with your actual URL
    'github.com',  -- Test domain - REPLACE with your actual domain
    NOW(),
    NOW(),
    NOW(),
    false,
    false
);

-- Step 3: Verify the note was created with proper URL/domain
SELECT 
    id,
    user_id,
    url,
    domain,
    created_at,
    CASE 
        WHEN url IS NOT NULL AND url != '' THEN '✅ URL Present: ' || url
        ELSE '❌ URL Missing'
    END as url_status,
    CASE 
        WHEN domain IS NOT NULL AND domain != '' THEN '✅ Domain Present: ' || domain
        ELSE '❌ Domain Missing'
    END as domain_status
FROM public.notes 
WHERE user_id = 'your-user-id-here'::uuid  -- Replace with your actual user ID
ORDER BY created_at DESC;

-- Step 4: Test the sync function directly to see what it returns
-- This will help verify the database function is working correctly
-- (You can run this after creating the note to test the sync function)
/*
SELECT sync_notes_simple(
    'your-user-id-here'::uuid,  -- Replace with your actual user ID
    '[]'::jsonb,  -- Empty notes array (will return existing notes as missing)
    '[]'::jsonb   -- Empty deletions array
);
*/
