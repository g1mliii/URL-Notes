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

    const { operation, notes, lastSyncTime } = await req.json()

    if (operation === 'pull') {
      // Pull notes from cloud since last sync
      return await handlePull(supabaseClient, user.id, lastSyncTime)
    } else if (operation === 'push') {
      // Push local changes to cloud
      return await handlePush(supabaseClient, user.id, notes)
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid operation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handlePull(supabaseClient: any, userId: string, lastSyncTime: string | null) {
  try {
    let query = supabaseClient
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })

    if (lastSyncTime) {
      query = query.gt('updated_at', lastSyncTime)
    }

    const { data: notes, error } = await query

    if (error) throw error

    return new Response(
      JSON.stringify({ 
        notes: notes || [],
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Pull error:', error)
    throw error
  }
}

async function handlePush(supabaseClient: any, userId: string, notes: any[]) {
  try {
    const results = []
    const conflicts = []

    for (const note of notes) {
      try {
        if (note.operation === 'create') {
          // Create new note
          const { data, error } = await supabaseClient
            .from('notes')
            .insert({
              id: note.id,
              user_id: userId,
              title_encrypted: note.title_encrypted,
              content_encrypted: note.content_encrypted,
              content_hash: note.content_hash,
              version: 1,
              sync_status: 'synced'
            })
            .select()
            .single()

          if (error) throw error
          results.push({ id: note.id, status: 'created', data })

        } else if (note.operation === 'update') {
          // Check for conflicts
          const { data: existingNote, error: fetchError } = await supabaseClient
            .from('notes')
            .select('*')
            .eq('id', note.id)
            .eq('user_id', userId)
            .single()

          if (fetchError) throw fetchError

          if (existingNote) {
            // Check if server version is newer
            if (new Date(existingNote.updated_at) > new Date(note.updated_at)) {
              conflicts.push({
                id: note.id,
                local: note,
                server: existingNote,
                type: 'server_newer'
              })
              continue
            }

            // Check content hash conflict
            if (existingNote.content_hash !== note.previous_hash) {
              conflicts.push({
                id: note.id,
                local: note,
                server: existingNote,
                type: 'content_conflict'
              })
              continue
            }

            // Update note
            const { data, error } = await supabaseClient
              .from('notes')
              .update({
                title_encrypted: note.title_encrypted,
                content_encrypted: note.content_encrypted,
                content_hash: note.content_hash,
                updated_at: note.updated_at,
                sync_status: 'synced'
              })
              .eq('id', note.id)
              .eq('user_id', userId)
              .select()
              .single()

            if (error) throw error
            results.push({ id: note.id, status: 'updated', data })

          } else {
            // Note doesn't exist, create it
            const { data, error } = await supabaseClient
              .from('notes')
              .insert({
                id: note.id,
                user_id: userId,
                title_encrypted: note.title_encrypted,
                content_encrypted: note.content_encrypted,
                content_hash: note.content_hash,
                version: 1,
                sync_status: 'synced'
              })
              .select()
              .single()

            if (error) throw error
            results.push({ id: note.id, status: 'created', data })
          }

        } else if (note.operation === 'delete') {
          // Soft delete note
          const { error } = await supabaseClient
            .from('notes')
            .update({
              is_deleted: true,
              deleted_at: note.deleted_at,
              sync_status: 'synced'
            })
            .eq('id', note.id)
            .eq('user_id', userId)

          if (error) throw error
          results.push({ id: note.id, status: 'deleted' })
        }

      } catch (noteError) {
        console.error(`Error processing note ${note.id}:`, noteError)
        results.push({ id: note.id, status: 'error', error: noteError.message })
      }
    }

    return new Response(
      JSON.stringify({
        results,
        conflicts,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Push error:', error)
    throw error
  }
}
