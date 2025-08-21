import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { noteId, resolution, noteData } = await req.json()

    if (!noteId || !resolution) {
      return new Response(
        JSON.stringify({ error: 'Missing noteId or resolution' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return await handleConflictResolution(supabaseClient, user.id, noteId, resolution, noteData)

  } catch (error) {
    console.error('Conflict resolution error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleConflictResolution(
  supabaseClient: any, 
  userId: string, 
  noteId: string, 
  resolution: 'keep_local' | 'use_server' | 'merge',
  noteData?: any
) {
  try {
    // Get the current note
    const { data: currentNote, error: fetchError } = await supabaseClient
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', userId)
      .single()

    if (fetchError) throw fetchError

    if (resolution === 'keep_local') {
      // Overwrite server with local version
      const { data, error } = await supabaseClient
        .from('notes')
        .update({
          title_encrypted: noteData.title_encrypted,
          content_encrypted: noteData.content_encrypted,
          content_hash: noteData.content_hash,
          updated_at: noteData.updated_at,
          sync_status: 'synced'
        })
        .eq('id', noteId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          status: 'resolved',
          resolution: 'keep_local',
          note: data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (resolution === 'use_server') {
      // Keep server version, mark as resolved
      const { error } = await supabaseClient
        .from('notes')
        .update({ sync_status: 'synced' })
        .eq('id', noteId)
        .eq('user_id', userId)

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          status: 'resolved',
          resolution: 'use_server',
          note: currentNote
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (resolution === 'merge') {
      // Merge local and server content (basic merge strategy)
      if (!noteData) {
        throw new Error('Note data required for merge resolution')
      }

      // Create a merged version
      const mergedNote = {
        title_encrypted: noteData.title_encrypted, // Prefer local title
        content_encrypted: noteData.content_encrypted, // Prefer local content
        content_hash: noteData.content_hash,
        updated_at: new Date().toISOString(),
        sync_status: 'synced'
      }

      const { data, error } = await supabaseClient
        .from('notes')
        .update(mergedNote)
        .eq('id', noteId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          status: 'resolved',
          resolution: 'merge',
          note: data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      throw new Error('Invalid resolution type')
    }

  } catch (error) {
    console.error('Conflict resolution error:', error)
    throw error
  }
}
