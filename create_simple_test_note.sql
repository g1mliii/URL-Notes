-- Create a SIMPLE test note without encrypted content to avoid decryption issues
-- This will let you test the URL/domain functionality without encryption problems

-- Step 1: Find your user ID (replace with your actual email)
SELECT id, email, subscription_tier FROM public.profiles WHERE email = 'your-email@example.com';

-- Step 2: Create a simple test note (no encrypted content)
-- This avoids the decryption error while testing URL/domain sync
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
    
    -- No encrypted title (NULL)
    NULL,
    
    -- No encrypted content (NULL)
    NULL,
    
    'simple-test-hash-12345',
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
-- DELETE FROM public.notes WHERE content_hash IN ('test-hash-123', 'real-content-hash-12345', 'proper-encryption-hash-12345');
