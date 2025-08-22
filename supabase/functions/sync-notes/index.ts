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
    console.log(`Processing sync request for user: ${userId}`)
    console.log(`Request method: ${req.method}`)
    console.log(`Request URL: ${req.url}`)

    const requestData = await req.json()
    const { operation, notes, lastSyncTime, noteId, resolution, localNote } = requestData

    if (operation === 'pull') {
      // Pull notes from cloud since last sync
      return await handlePull(supabaseClient, user.id, lastSyncTime)
    } else if (operation === 'push') {
      // Push local changes to cloud
      return await handlePush(supabaseClient, user.id, notes)
    } else if (operation === 'sync_versions') {
      // Sync version history to cloud
      return await handleSyncVersions(supabaseClient, user.id, notes)
    } else if (operation === 'resolve_conflict') {
      // Resolve conflicts
      return await handleResolveConflict(supabaseClient, user.id, { noteId, resolution, localNote })
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
    console.log(`Edge Function: Pulling notes for user ${userId}, lastSyncTime: ${lastSyncTime}`);
    
    let query = supabaseClient
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })

    if (lastSyncTime) {
      query = query.gt('updated_at', lastSyncTime)
      console.log(`Edge Function: Filtering notes updated after ${lastSyncTime}`);
    }

    const { data: notes, error } = await query

    if (error) {
      console.error('Edge Function: Database query error:', error);
      throw error
    }

    console.log(`Edge Function: Retrieved ${notes?.length || 0} notes from database`);
    
    if (notes && notes.length > 0) {
      console.log('Edge Function: Sample note structure:', {
        id: notes[0].id,
        hasTitleEncrypted: !!notes[0].title_encrypted,
        hasContentEncrypted: !!notes[0].content_encrypted,
        hasTitle: !!notes[0].title,
        hasContent: !!notes[0].content,
        user_id: notes[0].user_id,
        updated_at: notes[0].updated_at
      });
    }

    return new Response(
      JSON.stringify({ 
        notes: notes || [],
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge Function: Pull error:', error);
    throw error;
  }
}

async function handlePush(supabaseClient: any, userId: string, notes: any[]) {
  try {
    console.log(`Processing ${notes.length} notes for user ${userId}`)
    console.log('Raw notes array:', JSON.stringify(notes, null, 2))
    
    if (!notes || !Array.isArray(notes)) {
      console.error('Notes parameter is not an array:', typeof notes, notes)
      throw new Error('Notes parameter must be an array')
    }
    
    if (notes.length === 0) {
      console.log('No notes to process')
      return new Response(
        JSON.stringify({ notes: [], conflicts: [], timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const results = []
    const conflicts = []

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      
      if (!note) {
        console.error(`Note at index ${i} is undefined or null`)
        continue
      }
      
      if (typeof note !== 'object') {
        console.error(`Note at index ${i} is not an object:`, typeof note, note)
        continue
      }
      
      if (!note.id) {
        console.error(`Note at index ${i} is missing id:`, note)
        continue
      }
      
      try {
        console.log(`Processing note ${note.id} with operation: ${note.operation}`)
        console.log(`Note data:`, {
          id: note.id,
          operation: note.operation,
          hasTitleEncrypted: !!note.title_encrypted,
          hasContentEncrypted: !!note.content_encrypted,
          hasContentHash: !!note.content_hash,
          userId: userId
        })
        
        if (!note.operation) {
          console.error(`Note ${note.id} is missing operation`)
          results.push({ id: note.id, status: 'error', error: 'Missing operation' })
          continue
        }
        
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

          if (error) {
            console.error(`Create error for note ${note.id}:`, error)
            throw error
          }
          console.log(`Successfully created note ${note.id}`)
          results.push({ id: note.id, status: 'created', data })

          // If this note has version history data, sync it to Supabase
          if (note.versions && Array.isArray(note.versions) && note.versions.length > 0) {
            console.log(`Syncing ${note.versions.length} version records for note ${note.id}`)
            for (const version of note.versions) {
              try {
                const { error: versionError } = await supabaseClient
                  .from('note_versions')
                  .insert({
                    note_id: note.id,
                    user_id: userId,
                    title_encrypted: version.title_encrypted || version.title,
                    content_encrypted: version.content_encrypted || version.content,
                    content_hash: version.content_hash || version.contentHash,
                    version: version.version,
                    change_reason: version.change_reason || 'auto_save'
                  })
                
                if (versionError) {
                  console.error(`Version sync error for note ${note.id}:`, versionError)
                } else {
                  console.log(`Successfully synced version ${version.version} for note ${note.id}`)
                }
              } catch (versionError) {
                console.error(`Version sync failed for note ${note.id}:`, versionError)
              }
            }
          }

        } else if (note.operation === 'update') {
          // Check for conflicts
          const { data: existingNote, error: fetchError } = await supabaseClient
            .from('notes')
            .select('*')
            .eq('id', note.id)
            .eq('user_id', userId)
            .single()

          if (fetchError) {
            // Note doesn't exist, create it instead
            console.log(`Note ${note.id} not found during update, creating new note`)
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

            if (error) {
              console.error(`Create error for note ${note.id}:`, error)
              results.push({ id: note.id, status: 'error', error: error.message })
              continue
            }
            
            console.log(`Successfully created note ${note.id} (was update but note didn't exist)`)
            results.push({ id: note.id, status: 'created', data })
            continue
          }

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

            // Create version record before updating (if content actually changed)
            if (existingNote.content_hash !== note.content_hash) {
              console.log(`Creating version record for note ${note.id}`)
              try {
                const { error: versionError } = await supabaseClient
                  .from('note_versions')
                  .insert({
                    note_id: note.id,
                    user_id: userId,
                    title_encrypted: existingNote.title_encrypted,
                    content_encrypted: existingNote.content_encrypted,
                    content_hash: existingNote.content_hash,
                    version: existingNote.version || 1,
                    change_reason: 'auto_save'
                  })
                
                if (versionError) {
                  console.error(`Version creation error for note ${note.id}:`, versionError)
                } else {
                  console.log(`Successfully created version record for note ${note.id}`)
                }
              } catch (versionError) {
                console.error(`Version creation failed for note ${note.id}:`, versionError)
              }
            }

            // Update note with proper version increment
            const { data, error } = await supabaseClient
              .from('notes')
              .update({
                title_encrypted: note.title_encrypted,
                content_encrypted: note.content_encrypted,
                content_hash: note.content_hash,
                updated_at: note.updated_at,
                version: (existingNote.version || 1) + 1,
                sync_status: 'synced'
              })
              .eq('id', note.id)
              .eq('user_id', userId)
              .select()

            if (error) {
              console.error(`Update error for note ${note.id}:`, error)
              results.push({ id: note.id, status: 'error', error: error.message })
              continue
            }

            // Handle case where update affected 0 rows
            if (!data || data.length === 0) {
              console.log(`Update affected 0 rows for note ${note.id}, creating new note`)
              const { data: newData, error: createError } = await supabaseClient
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

              if (createError) {
                console.error(`Create error for note ${note.id}:`, createError)
                results.push({ id: note.id, status: 'error', error: createError.message })
                continue
              }
              
              results.push({ id: note.id, status: 'created', data: newData })
            } else {
              results.push({ id: note.id, status: 'updated', data: data[0] })
            }
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
        console.error(`Note error details:`, {
          message: noteError.message,
          code: noteError.code,
          details: noteError.details,
          hint: noteError.hint
        })
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

async function handleSyncVersions(supabaseClient: any, userId: string, versions: any[]) {
  try {
    console.log(`Edge Function: Syncing ${versions.length} versions for user ${userId}`);
    
    if (!versions || !Array.isArray(versions)) {
      throw new Error('Versions parameter must be an array');
    }
    
    const results = [];
    let syncedCount = 0;
    
    for (const version of versions) {
      try {
        if (!version.note_id || !version.version) {
          console.warn('Edge Function: Skipping invalid version:', version);
          continue;
        }
        
        console.log(`Edge Function: Processing version ${version.version} for note ${version.note_id}`);
        
        // Check if version already exists
        const { data: existingVersion, error: checkError } = await supabaseClient
          .from('note_versions')
          .select('id')
          .eq('note_id', version.note_id)
          .eq('version', version.version)
          .eq('user_id', userId)
          .single();
        
        if (existingVersion) {
          console.log(`Edge Function: Version ${version.version} for note ${version.note_id} already exists, skipping`);
          continue;
        }
        
        // Insert new version
        const { data, error } = await supabaseClient
          .from('note_versions')
          .insert({
            note_id: version.note_id,
            user_id: userId,
            title_encrypted: version.title_encrypted || version.title || '',
            content_encrypted: version.content_encrypted || version.content || '',
            content_hash: version.content_hash || `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            version: version.version,
            change_reason: version.change_reason || 'auto_save',
            created_at: version.created_at || new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) {
          console.error(`Edge Function: Version insert error for note ${version.note_id}:`, error);
          results.push({ 
            note_id: version.note_id, 
            version: version.version, 
            status: 'error', 
            error: error.message 
          });
        } else {
          console.log(`Edge Function: Successfully synced version ${version.version} for note ${version.note_id}`);
          results.push({ 
            note_id: version.note_id, 
            version: version.version, 
            status: 'synced', 
            data 
          });
          syncedCount++;
        }
        
      } catch (versionError) {
        console.error(`Edge Function: Error processing version for note ${version.note_id}:`, versionError);
        results.push({ 
          note_id: version.note_id, 
          version: version.version, 
          status: 'error', 
          error: versionError.message 
        });
      }
    }
    
    console.log(`Edge Function: Version sync completed. ${syncedCount} versions synced successfully`);
    
    return new Response(
      JSON.stringify({
        results,
        syncedCount,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Edge Function: Version sync error:', error);
    throw error;
  }
}

async function handleResolveConflict(supabaseClient: any, userId: string, conflictData: any) {
  try {
    console.log(`Edge Function: Resolving conflict for user ${userId}`);
    
    if (!conflictData || !conflictData.noteId || !conflictData.resolution) {
      throw new Error('Missing required conflict resolution data');
    }
    
    const { noteId, resolution, localNote } = conflictData;
    console.log(`Edge Function: Resolving conflict for note ${noteId} with resolution: ${resolution}`);
    
    if (resolution === 'keep_local' && localNote) {
      // Update the note in Supabase with local version
      const { data, error } = await supabaseClient
        .from('notes')
        .update({
          title_encrypted: localNote.title_encrypted || localNote.title,
          content_encrypted: localNote.content_encrypted || localNote.content,
          content_hash: localNote.content_hash,
          updated_at: localNote.updatedAt || localNote.updated_at || new Date().toISOString(),
          sync_status: 'synced'
        })
        .eq('id', noteId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error(`Edge Function: Conflict resolution update error for note ${noteId}:`, error);
        throw error;
      }
      
      console.log(`Edge Function: Successfully resolved conflict for note ${noteId} by keeping local version`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Conflict resolved by keeping local version',
          data: data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } else if (resolution === 'use_server') {
      // Mark conflict as resolved (server version wins)
      const { data, error } = await supabaseClient
        .from('notes')
        .update({
          sync_status: 'synced'
        })
        .eq('id', noteId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error(`Edge Function: Conflict resolution status update error for note ${noteId}:`, error);
        throw error;
      }
      
      console.log(`Edge Function: Successfully resolved conflict for note ${noteId} by using server version`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Conflict resolved by using server version',
          data: data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } else {
      throw new Error(`Invalid resolution type: ${resolution}`);
    }
    
  } catch (error) {
    console.error('Edge Function: Conflict resolution error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
