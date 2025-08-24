-- Test script to verify database sync function with URL and domain fields
-- This simulates what happens when the extension syncs notes

-- First, let's create a test user (you'll need to replace with an actual user ID from your database)
-- INSERT INTO public.profiles (id, email, subscription_tier) VALUES 
-- ('test-user-123', 'test@example.com', 'premium');

-- Test data that would be sent from the extension
-- This simulates the encrypted note data with URL and domain fields
DO $$
DECLARE
    test_user_id uuid := 'test-user-123'::uuid; -- Replace with actual user ID
    test_note_id uuid := 'test-note-456'::uuid;
    test_notes_data jsonb;
    test_deletions jsonb;
    sync_result jsonb;
BEGIN
    -- Create test note data (this is what the extension would send)
    test_notes_data := jsonb_build_array(
        jsonb_build_object(
            'id', test_note_id,
            'title_encrypted', jsonb_build_object(
                'encrypted', '[1,2,3,4,5]'::jsonb, -- Mock encrypted data
                'iv', '[10,11,12]'::jsonb,         -- Mock IV
                'algorithm', 'AES-GCM'
            ),
            'content_encrypted', jsonb_build_object(
                'encrypted', '[6,7,8,9,10]'::jsonb, -- Mock encrypted data
                'iv', '[13,14,15]'::jsonb,          -- Mock IV
                'algorithm', 'AES-GCM'
            ),
            'content_hash', 'test-hash-123',
            'url', 'https://example.com/test-page',
            'domain', 'example.com',
            'createdAt', '2025-01-24T02:25:14.972Z',
            'updatedAt', '2025-01-24T02:25:14.973Z'
        )
    );
    
    test_deletions := '[]'::jsonb;
    
    RAISE NOTICE 'Test data prepared:';
    RAISE NOTICE 'Notes count: %', jsonb_array_length(test_notes_data);
    RAISE NOTICE 'First note URL: %', test_notes_data->0->>'url';
    RAISE NOTICE 'First note domain: %', test_notes_data->0->>'domain';
    RAISE NOTICE 'First note has encrypted title: %', (test_notes_data->0->'title_encrypted') IS NOT NULL;
    RAISE NOTICE 'First note has encrypted content: %', (test_notes_data->0->'content_encrypted') IS NOT NULL;
    
    -- Test the sync function
    -- Note: This will only work if the function exists and the user has permissions
    BEGIN
        SELECT sync_notes_simple(test_user_id, test_notes_data, test_deletions) INTO sync_result;
        RAISE NOTICE 'Sync function executed successfully';
        RAISE NOTICE 'Sync result: %', sync_result;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Sync function failed: %', SQLERRM;
        RAISE NOTICE 'This is expected if the function is not deployed yet';
    END;
    
    -- Verify the note was stored correctly (if sync succeeded)
    IF sync_result IS NOT NULL THEN
        RAISE NOTICE 'Verifying stored note...';
        
        -- Check if note exists in database
        IF EXISTS (SELECT 1 FROM public.notes WHERE id = test_note_id AND user_id = test_user_id) THEN
            RAISE NOTICE '✅ Note successfully stored in database';
            
            -- Check if URL and domain fields are preserved
            IF EXISTS (
                SELECT 1 FROM public.notes 
                WHERE id = test_note_id 
                AND user_id = test_user_id 
                AND url = 'https://example.com/test-page'
                AND domain = 'example.com'
            ) THEN
                RAISE NOTICE '✅ URL and domain fields preserved correctly';
            ELSE
                RAISE NOTICE '❌ URL or domain fields not preserved correctly';
            END IF;
            
            -- Check if encrypted fields are stored
            IF EXISTS (
                SELECT 1 FROM public.notes 
                WHERE id = test_note_id 
                AND user_id = test_user_id 
                AND title_encrypted IS NOT NULL
                AND content_encrypted IS NOT NULL
            ) THEN
                RAISE NOTICE '✅ Encrypted fields stored correctly';
            ELSE
                RAISE NOTICE '❌ Encrypted fields not stored correctly';
            END IF;
            
        ELSE
            RAISE NOTICE '❌ Note not found in database after sync';
        END IF;
    END IF;
    
END $$;

-- Clean up test data (optional)
-- DELETE FROM public.notes WHERE id = 'test-note-456'::uuid;
-- DELETE FROM public.profiles WHERE id = 'test-user-123'::uuid;
