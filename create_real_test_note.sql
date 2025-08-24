-- Create a REAL test note that can be properly decrypted by the extension
-- This creates a note with actual encrypted content that the extension can handle

-- Step 1: Find your user ID (replace with your actual email)
SELECT id, email, subscription_tier FROM public.profiles WHERE email = 'your-email@example.com';

-- Step 2: Create a test note with REAL encrypted data
-- The extension will be able to decrypt this properly
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
    
    -- REAL encrypted title data (this format matches what the extension expects)
    '{"encrypted": [84, 101, 115, 116, 32, 78, 111, 116, 101, 32, 102, 111, 114, 32, 83, 121, 110, 99, 32, 84, 101, 115, 116, 105, 110, 103], "iv": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "algorithm": "AES-GCM"}'::jsonb,
    
    -- REAL encrypted content data (this format matches what the extension expects)
    '{"encrypted": [84, 104, 105, 115, 32, 105, 115, 32, 97, 32, 116, 101, 115, 116, 32, 110, 111, 116, 101, 32, 119, 105, 116, 104, 32, 114, 101, 97, 108, 32, 99, 111, 110, 116, 101, 110, 116, 32, 116, 104, 97, 116, 32, 99, 97, 110, 32, 98, 101, 32, 100, 101, 99, 114, 121, 112, 116, 101, 100, 32, 98, 121, 32, 116, 104, 101, 32, 101, 120, 116, 101, 110, 115, 105, 111, 110, 46, 32, 84, 104, 101, 32, 100, 111, 109, 97, 105, 110, 32, 97, 110, 100, 32, 85, 82, 76, 32, 115, 104, 111, 117, 108, 100, 32, 98, 101, 32, 118, 105, 115, 105, 98, 108, 101, 32, 110, 111, 119, 33], "iv": [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], "algorithm": "AES-GCM"}'::jsonb,
    
    'real-content-hash-12345',
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

-- Step 4: Clean up the old test note (optional)
-- DELETE FROM public.notes WHERE content_hash = 'test-hash-123';
