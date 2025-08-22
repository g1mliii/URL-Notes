-- Final sync fix - clean up all remaining issues
-- This migration ensures the sync system works correctly

-- 1. Drop any remaining old functions and triggers
-- Drop the functions that exist in your database
DROP FUNCTION IF EXISTS public.sync_notes_simple(uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.create_note_version();
DROP FUNCTION IF EXISTS public.update_storage_usage();
DROP FUNCTION IF EXISTS public.cleanup_old_notes();
DROP FUNCTION IF EXISTS public.set_updated_at();

-- 2. Drop old triggers
-- Drop any triggers that might exist
DROP TRIGGER IF EXISTS create_note_version_trigger ON public.notes;
DROP TRIGGER IF EXISTS update_storage_usage_trigger ON public.notes;
DROP TRIGGER IF EXISTS set_notes_updated_at ON public.notes;
-- Also drop any triggers that might be using the old functions
DROP TRIGGER IF EXISTS create_note_version ON public.notes;
DROP TRIGGER IF EXISTS update_storage_usage ON public.notes;

-- 3. Ensure the notes table has the correct structure
ALTER TABLE public.notes DROP COLUMN IF EXISTS version;
ALTER TABLE public.notes DROP COLUMN IF EXISTS parent_version_id;
ALTER TABLE public.notes DROP COLUMN IF EXISTS sync_status;
ALTER TABLE public.notes DROP COLUMN IF EXISTS url;
ALTER TABLE public.notes DROP COLUMN IF EXISTS domain;
ALTER TABLE public.notes DROP COLUMN IF EXISTS tags;

-- 4. Add missing columns if they don't exist
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS sync_pending boolean DEFAULT false;

-- 5. Create the set_updated_at function that the trigger needs
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Recreate the trigger for updated_at
CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 7. Create the clean sync function
CREATE OR REPLACE FUNCTION sync_notes_simple(
  p_user_id uuid,
  notes_data jsonb,
  deletions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  note_record jsonb;
  note_id uuid;
  result jsonb;
  missing_notes jsonb := '[]'::jsonb;
  debug_info jsonb;
BEGIN
  -- Debug: log incoming data
  debug_info := jsonb_build_object(
    'user_id', p_user_id,
    'notes_count', jsonb_array_length(notes_data),
    'deletions_count', jsonb_array_length(deletions),
    'first_note_id', notes_data->0->>'id'
  );
  
  RAISE LOG 'sync_notes_simple called with: %', debug_info;

  -- Process deletions first
  FOR note_record IN SELECT * FROM jsonb_array_elements(deletions)
  LOOP
    note_id := (note_record->>'id')::uuid;
    DELETE FROM public.notes WHERE id = note_id AND user_id = p_user_id;
    RAISE LOG 'Deleted note: %', note_id;
  END LOOP;

  -- Process note updates/creates
  FOR note_record IN SELECT * FROM jsonb_array_elements(notes_data)
  LOOP
    note_id := (note_record->>'id')::uuid;
    
    -- Debug: log what we're processing
    RAISE LOG 'Processing note: id=%, user_id=%, note_exists=%', 
      note_id, p_user_id, 
      EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND user_id = p_user_id);
    
    -- Check if note exists
    IF EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND user_id = p_user_id) THEN
      -- Update existing note - handle jsonb columns correctly
      UPDATE public.notes SET
        title_encrypted = note_record->'title_encrypted',
        content_encrypted = note_record->'content_encrypted',
        content_hash = note_record->>'content_hash',
        last_synced_at = NOW(),
        sync_pending = false
      WHERE id = note_id AND user_id = p_user_id;
      
      RAISE LOG 'Updated existing note: %', note_id;
    ELSE
      -- Insert new note - handle jsonb columns correctly
      INSERT INTO public.notes (
        id, user_id, title_encrypted, content_encrypted, content_hash,
        created_at, updated_at, last_synced_at, sync_pending
      ) VALUES (
        note_id, p_user_id, 
        note_record->'title_encrypted', note_record->'content_encrypted', 
        note_record->>'content_hash',
        COALESCE((note_record->>'createdAt')::timestamptz, NOW()), 
        COALESCE((note_record->>'updatedAt')::timestamptz, NOW()), 
        NOW(), false
      );
      
      RAISE LOG 'Inserted new note: %', note_id;
    END IF;
  END LOOP;

  -- Get any notes that exist on server but not in the client data
  -- This implements the "local priority" - only return missing notes
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'title_encrypted', n.title_encrypted,
      'content_encrypted', n.content_encrypted,
      'content_hash', n.content_hash,
      'createdAt', n.created_at,
      'updatedAt', n.updated_at
    )
  ) INTO missing_notes
  FROM public.notes n
  WHERE n.user_id = p_user_id 
    AND n.id NOT IN (
      SELECT (note->>'id')::uuid 
      FROM jsonb_array_elements(notes_data) AS note
    );

  -- Return result
  result := jsonb_build_object(
    'success', true,
    'missingNotes', COALESCE(missing_notes, '[]'::jsonb),
    'timestamp', NOW()
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant execute permission
GRANT EXECUTE ON FUNCTION sync_notes_simple(uuid, jsonb, jsonb) TO authenticated;

-- 9. Ensure RLS is enabled and policies are correct
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 10. Drop old policies and recreate them with proper syntax
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
DROP POLICY IF EXISTS "notes_select_own" ON public.notes;
DROP POLICY IF EXISTS "notes_insert_own" ON public.notes;
DROP POLICY IF EXISTS "notes_update_own" ON public.notes;
DROP POLICY IF EXISTS "notes_delete_own" ON public.notes;

-- 11. Create clean RLS policies with proper auth.uid() syntax
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own notes" ON public.notes
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE USING ((select auth.uid()) = user_id);

-- 12. Ensure all required indexes exist
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_sync_pending ON public.notes(sync_pending);
CREATE INDEX IF NOT EXISTS idx_notes_last_synced ON public.notes(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON public.notes(updated_at);

-- 13. Grant permissions on the set_updated_at function
GRANT EXECUTE ON FUNCTION set_updated_at() TO authenticated;
