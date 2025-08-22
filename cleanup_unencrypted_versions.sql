-- Cleanup script to remove unencrypted versions from Supabase
-- This will allow the extension to re-sync them properly encrypted

-- First, let's see how many unencrypted versions we have
-- (versions where title_encrypted and content_encrypted are plain text)
SELECT 
    COUNT(*) as unencrypted_count,
    COUNT(DISTINCT note_id) as affected_notes
FROM note_versions 
WHERE 
    (title_encrypted::text NOT LIKE '{"iv"%' AND title_encrypted::text != '')
    OR 
    (content_encrypted::text NOT LIKE '{"iv"%' AND content_encrypted::text != '');

-- Optional: Delete all unencrypted versions (uncomment to execute)
-- WARNING: This will delete version history data. Only run if you want to clean up and re-sync.
/*
DELETE FROM note_versions 
WHERE 
    (title_encrypted::text NOT LIKE '{"iv"%' AND title_encrypted::text != '')
    OR 
    (content_encrypted::text NOT LIKE '{"iv"%' AND content_encrypted::text != '');
*/

-- Show remaining versions after cleanup
SELECT 
    COUNT(*) as remaining_versions,
    COUNT(DISTINCT note_id) as notes_with_versions
FROM note_versions;
