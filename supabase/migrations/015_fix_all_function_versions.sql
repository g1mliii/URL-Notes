-- Fix ALL versions of the functions that are causing RLS warnings
-- Based on the actual function signatures found in Supabase

-- Drop all versions of increment_ai_usage
DROP FUNCTION IF EXISTS public.increment_ai_usage(uuid, text, integer);
DROP FUNCTION IF EXISTS public.increment_ai_usage(uuid, integer);
DROP FUNCTION IF EXISTS public.increment_ai_usage(uuid, text);

-- Drop all versions of check_ai_usage
DROP FUNCTION IF EXISTS public.check_ai_usage(uuid);
DROP FUNCTION IF EXISTS public.check_ai_usage(uuid, text);

-- Drop sync_notes_simple (should only be one version)
DROP FUNCTION IF EXISTS public.sync_notes_simple(uuid, jsonb, jsonb);

-- Recreate increment_ai_usage with proper search_path (version with feature_name and increment_amount)
CREATE OR REPLACE FUNCTION public.increment_ai_usage(
    p_user_id uuid,
    p_feature_name text DEFAULT 'overall'::text,
    p_increment_amount integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    current_usage integer;
BEGIN
    -- Update or insert usage for the specific feature
    INSERT INTO public.ai_usage (user_id, feature_name, usage)
    VALUES (p_user_id, p_feature_name, p_increment_amount)
    ON CONFLICT (user_id, feature_name)
    DO UPDATE SET 
        usage = ai_usage.usage + p_increment_amount,
        updated_at = NOW();
    
    -- Get current usage for the feature
    SELECT usage INTO current_usage
    FROM public.ai_usage
    WHERE user_id = p_user_id AND feature_name = p_feature_name;
    
    -- Return result
    result := jsonb_build_object(
        'success', true,
        'feature_name', p_feature_name,
        'current_usage', current_usage,
        'increment_amount', p_increment_amount
    );
    
    RETURN result;
END;
$$;

-- Recreate check_ai_usage with proper search_path (version with feature_name)
CREATE OR REPLACE FUNCTION public.check_ai_usage(
    p_user_id uuid,
    p_feature_name text DEFAULT 'overall'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    current_usage integer;
BEGIN
    -- Get current usage for the specific feature
    SELECT COALESCE(usage, 0) INTO current_usage
    FROM public.ai_usage
    WHERE user_id = p_user_id AND feature_name = p_feature_name;
    
    -- Return result
    result := jsonb_build_object(
        'success', true,
        'feature_name', p_feature_name,
        'current_usage', current_usage
    );
    
    RETURN result;
END;
$$;

-- Recreate sync_notes_simple with proper search_path
CREATE OR REPLACE FUNCTION public.sync_notes_simple(
  p_user_id uuid,
  notes_data jsonb,
  deletions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
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
$$;

-- Grant execute permissions for all function versions
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_usage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_notes_simple(uuid, jsonb, jsonb) TO authenticated;
