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
      console.error('Authentication failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    // Remove verbose logging

    const requestData = await req.json()
    const { operation, notes, deletions, lastSyncTime, timestamp } = requestData

    // Debug: Log received data structure
    console.log('Edge function received:', {
      operation,
      notesCount: notes?.length || 0,
      deletionsCount: deletions?.length || 0,
      requestKeys: Object.keys(requestData)
    });

    // Validate operation
    if (!operation) {
      console.error('No operation specified in request');
      return new Response(
        JSON.stringify({ error: 'No operation specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (operation === 'sync') {
      // Remove verbose logging
      // Remove verbose logging

      // Validate notes have required encrypted fields
      if (notes && Array.isArray(notes)) {
        for (const note of notes) {
          if (!note.title_encrypted || !note.content_encrypted) {
            console.error('Note missing required encrypted fields:', {
              id: note.id,
              hasTitleEncrypted: !!note.title_encrypted,
              hasContentEncrypted: !!note.content_encrypted,
              titleEncryptedType: typeof note.title_encrypted,
              contentEncryptedType: typeof note.content_encrypted,
              noteKeys: Object.keys(note)
            });
            return new Response(
              JSON.stringify({
                error: 'Note missing required encrypted fields',
                noteId: note.id,
                missingFields: {
                  title_encrypted: !note.title_encrypted,
                  content_encrypted: !note.content_encrypted
                }
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // Use the simplified sync function
      const { data, error } = await supabaseClient.rpc('sync_notes_simple', {
        p_user_id: userId,
        notes_data: notes || [],
        deletions: deletions || []
      })

      if (error) {
        console.error('Sync failed:', error)
        return new Response(
          JSON.stringify({ error: 'Sync failed', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Debug: Log what the RPC function returned
      console.log('RPC sync_notes_simple returned:', {
        missingNotesCount: data?.missingNotes?.length || 0,
        processedDeletionsCount: data?.processedDeletions?.length || 0
      });

      // Ensure the response has the expected structure
      const responseData = {
        success: true,
        missingNotes: data?.missingNotes || [],
        processedDeletions: data?.processedDeletions || [],
        ...data // Include any other fields from the RPC response
      };

      return new Response(
        JSON.stringify(responseData),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.error('Invalid operation received:', operation);
    return new Response(
      JSON.stringify({
        error: 'Invalid operation',
        received: operation,
        expected: 'sync'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
