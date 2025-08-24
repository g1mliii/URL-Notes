-- Test script to generate a test note for sync testing
-- This creates a note with your user ID and specific URL/domain to verify sync is working

-- Replace this with your actual user ID from the profiles table
-- You can find your user ID by running: SELECT id, email FROM public.profiles;
DO $$
DECLARE
    -- UPDATE THIS: Replace with your actual user ID from the profiles table
    your_user_id uuid := 'your-actual-user-id-here'::uuid;
    
    -- Test note data
    test_note_id uuid := gen_random_uuid();
    test_url text := 'https://github.com/yourusername/url-notes-extension';
    test_domain text := 'github.com';
    test_title text := 'Test Note for Sync Verification';
    test_content text := 'This is a test note to verify that the sync functionality is working correctly with URL and domain fields. 

Key things to test:
1. Note syncs to cloud with proper URL and domain
2. Note can be retrieved on another device
3. Domain shows correctly instead of "no domain"
4. URL is preserved during sync
5. Content is not empty after sync

This note was created specifically to test the sync fix for the "no domain untitled empty notes" issue.';
    
    -- Check if user exists
    user_exists boolean;
BEGIN
    -- First, check if the user exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = your_user_id) INTO user_exists;
    
    IF NOT user_exists THEN
        RAISE EXCEPTION 'User ID % does not exist in profiles table. Please update the script with your actual user ID.', your_user_id;
    END IF;
    
    RAISE NOTICE '✅ User found: %', your_user_id;
    RAISE NOTICE '✅ Generating test note with ID: %', test_note_id;
    RAISE NOTICE '✅ Test URL: %', test_url;
    RAISE NOTICE '✅ Test domain: %', test_domain;
    
    -- Create a test note directly in the database
    -- This simulates what would happen during sync
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
        test_note_id,
        your_user_id,
        -- Mock encrypted title (in real sync, this would be actual encrypted data)
        jsonb_build_object(
            'encrypted', '[1,2,3,4,5,6,7,8,9,10]',
            'iv', '[11,12,13,14,15,16,17,18,19,20]',
            'algorithm', 'AES-GCM'
        ),
        -- Mock encrypted content (in real sync, this would be actual encrypted data)
        jsonb_build_object(
            'encrypted', '[21,22,23,24,25,26,27,28,29,30]',
            'iv', '[31,32,33,34,35,36,37,38,39,40]',
            'algorithm', 'AES-GCM'
        ),
        'test-content-hash-12345',
        test_url,
        test_domain,
        NOW(),
        NOW(),
        NOW(),
        false,
        false
    );
    
    RAISE NOTICE '✅ Test note created successfully!';
    RAISE NOTICE '✅ Note ID: %', test_note_id;
    
    -- Verify the note was created correctly
    RAISE NOTICE 'Verifying note creation...';
    
    IF EXISTS (
        SELECT 1 FROM public.notes 
        WHERE id = test_note_id 
        AND user_id = your_user_id
        AND url = test_url
        AND domain = test_domain
    ) THEN
        RAISE NOTICE '✅ Note verification successful!';
        RAISE NOTICE '✅ URL field preserved: %', test_url;
        RAISE NOTICE '✅ Domain field preserved: %', test_domain;
        RAISE NOTICE '✅ Encrypted fields stored: title_encrypted and content_encrypted are present';
    ELSE
        RAISE NOTICE '❌ Note verification failed!';
    END IF;
    
    -- Show the created note
    RAISE NOTICE 'Created note details:';
    RAISE NOTICE 'ID: %', test_note_id;
    RAISE NOTICE 'User ID: %', your_user_id;
    RAISE NOTICE 'URL: %', test_url;
    RAISE NOTICE 'Domain: %', test_domain;
    RAISE NOTICE 'Created at: %', NOW();
    
    -- Instructions for testing
    RAISE NOTICE '';
    RAISE NOTICE '=== NEXT STEPS FOR TESTING ===';
    RAISE NOTICE '1. This note is now in your database with URL and domain fields';
    RAISE NOTICE '2. Try syncing from your extension to see if it can retrieve this note';
    RAISE NOTICE '3. Check if the note shows the correct domain (github.com) instead of "no domain"';
    RAISE NOTICE '4. Verify the URL is preserved during sync';
    RAISE NOTICE '5. Test on another device to see if sync works end-to-end';
    RAISE NOTICE '';
    RAISE NOTICE 'To clean up after testing, run:';
    RAISE NOTICE 'DELETE FROM public.notes WHERE id = ''%'';', test_note_id;
    
END $$;

-- Alternative: If you want to see all notes for your user (including the test note)
-- Uncomment and run this after creating the test note:
/*
SELECT 
    id,
    user_id,
    url,
    domain,
    created_at,
    updated_at,
    CASE 
        WHEN title_encrypted IS NOT NULL THEN 'Encrypted'
        ELSE 'Not Encrypted'
    END as encryption_status
FROM public.notes 
WHERE user_id = 'your-actual-user-id-here'::uuid
ORDER BY created_at DESC;
*/
