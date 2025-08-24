-- Create a test note that will work with the improved error handling
-- This creates a note with encrypted content that will gracefully fall back to readable content

-- Step 1: Find your user ID (replace with your actual email)
SELECT id, email, subscription_tier FROM public.profiles WHERE email = 'your-email@example.com';

-- Step 2: Create a test note with encrypted content (will trigger fallback)
-- The extension will now handle decryption failures gracefully
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
    
    -- Encrypted title (will trigger decryption attempt, then fallback)
    '{"encrypted": [84, 101, 115, 116, 32, 78, 111, 116, 101], "iv": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "algorithm": "AES-GCM"}'::jsonb,
    
    -- Encrypted content (will trigger decryption attempt, then fallback)
    '{"encrypted": [84, 104, 105, 115, 32, 105, 115, 32, 97, 32, 116, 101, 115, 116, 32, 110, 111, 116, 101, 32, 119, 105, 116, 104, 32, 101, 110, 99, 114, 121, 112, 116, 101, 100, 32, 99, 111, 110, 116, 101, 110, 116, 46, 32, 73, 116, 32, 119, 105, 108, 108, 32, 116, 114, 105, 103, 103, 101, 114, 32, 116, 104, 101, 32, 102, 97, 108, 108, 98, 97, 99, 107, 32, 108, 111, 103, 105, 99, 46], "iv": [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], "algorithm": "AES-GCM"}'::jsonb,
    
    'encrypted-test-hash-12345',
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
    END as encryption_status,
    CASE 
        WHEN url IS NOT NULL AND domain IS NOT NULL THEN 'URL/Domain Present'
        ELSE 'Missing URL/Domain'
    END as metadata_status
FROM public.notes 
WHERE user_id = 'your-user-id-here'::uuid  -- Replace with your actual user ID
ORDER BY created_at DESC;

-- Step 4: Clean up old test notes (optional)
-- DELETE FROM public.notes WHERE content_hash IN ('test-hash-123', 'real-content-hash-12345', 'proper-encryption-hash-12345', 'simple-test-hash-12345');
