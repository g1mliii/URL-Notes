-- Simple test note creation for sync testing
-- Run these commands one by one in your Supabase SQL editor

-- Step 1: Find your user ID (replace 'your-email@example.com' with your actual email)
SELECT id, email, subscription_tier FROM public.profiles WHERE email = 'your-email@example.com';

-- Step 2: Create a test note (replace 'your-user-id-here' with the ID from step 1)
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
    'your-user-id-here'::uuid,  -- Replace with your actual user ID
    -- Mock encrypted title
    '{"encrypted": [1,2,3,4,5], "iv": [10,11,12], "algorithm": "AES-GCM"}'::jsonb,
    -- Mock encrypted content  
    '{"encrypted": [6,7,8,9,10], "iv": [13,14,15], "algorithm": "AES-GCM"}'::jsonb,
    'test-hash-123',
    'https://github.com/yourusername/url-notes-extension',  -- Test URL
    'github.com',  -- Test domain
    NOW(),
    NOW(),
    NOW(),
    false,
    false
);

-- Step 3: Verify the note was created
SELECT 
    id,
    user_id,
    url,
    domain,
    created_at,
    CASE 
        WHEN title_encrypted IS NOT NULL THEN 'Encrypted'
        ELSE 'Not Encrypted'
    END as encryption_status
FROM public.notes 
WHERE user_id = 'your-user-id-here'::uuid  -- Replace with your actual user ID
ORDER BY created_at DESC;

-- Step 4: Clean up after testing (optional)
-- DELETE FROM public.notes WHERE url = 'https://github.com/yourusername/url-notes-extension';
