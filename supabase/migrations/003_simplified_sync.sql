-- URL Notes - Simplified Sync Schema
-- Removes version history tables and simplifies sync to only latest versions

-- Drop version history related tables (no longer needed)
DROP TABLE IF EXISTS public.note_versions CASCADE;
DROP TABLE IF EXISTS public.note_sync_queue CASCADE;

-- Remove version tracking columns from notes table
ALTER TABLE public.notes 
DROP COLUMN IF EXISTS version,
DROP COLUMN IF EXISTS parent_version_id,
DROP COLUMN IF EXISTS sync_status;

-- Add simple sync tracking columns
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz null;
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS sync_pending boolean default false;

-- Create index for sync performance
CREATE INDEX IF NOT EXISTS idx_notes_sync_pending ON public.notes(sync_pending);
CREATE INDEX IF NOT EXISTS idx_notes_last_synced ON public.notes(last_synced_at);

-- Add function to clean up old notes (optional, for data management)
CREATE OR REPLACE FUNCTION cleanup_old_notes()
RETURNS void AS $$
BEGIN
  -- Delete notes older than 1 year that haven't been synced
  DELETE FROM public.notes 
  WHERE created_at < NOW() - INTERVAL '1 year' 
    AND last_synced_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_notes() TO authenticated;

-- Drop the existing function first
DROP FUNCTION IF EXISTS sync_notes_simple(uuid, jsonb, jsonb);

-- Create a simple sync function for the Edge Function to use
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
        updated_at = NOW(),
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_notes_simple(uuid, jsonb, jsonb) TO authenticated;

-- Add RLS policy for the function
ALTER FUNCTION sync_notes_simple(uuid, jsonb, jsonb) SECURITY DEFINER;

-- Update the existing RLS policies to be simpler
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

-- Also drop the old policies that might exist
DROP POLICY IF EXISTS "notes_select_own" ON public.notes;
DROP POLICY IF EXISTS "notes_insert_own" ON public.notes;
DROP POLICY IF EXISTS "notes_update_own" ON public.notes;
DROP POLICY IF EXISTS "notes_delete_own" ON public.notes;

-- Create simplified RLS policies
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
