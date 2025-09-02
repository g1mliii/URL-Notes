-- Update sync function to handle tags_encrypted field

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
      -- Update existing note - handle jsonb columns correctly and include url/domain/tags
      UPDATE public.notes SET
        title_encrypted = note_record->'title_encrypted',
        content_encrypted = note_record->'content_encrypted',
        tags_encrypted = note_record->'tags_encrypted',
        content_hash = note_record->>'content_hash',
        url = note_record->>'url',
        domain = note_record->>'domain',
        last_synced_at = NOW(),
        sync_pending = false
      WHERE id = note_id AND user_id = p_user_id;
      
      RAISE LOG 'Updated existing note: %', note_id;
    ELSE
      -- Insert new note - handle jsonb columns correctly and include url/domain/tags
      INSERT INTO public.notes (
        id, user_id, title_encrypted, content_encrypted, tags_encrypted, content_hash,
        url, domain, created_at, updated_at, last_synced_at, sync_pending
      ) VALUES (
        note_id, p_user_id, 
        note_record->'title_encrypted', note_record->'content_encrypted', 
        note_record->'tags_encrypted', note_record->>'content_hash',
        note_record->>'url', note_record->>'domain',
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
      'tags_encrypted', n.tags_encrypted,
      'content_hash', n.content_hash,
      'url', n.url,
      'domain', n.domain,
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
