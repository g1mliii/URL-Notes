// URL Notes Web App - Sync Service
// Matches the edge function sync-notes structure

import { supabaseClient } from './supabase'
import { noteEncryption } from './encryption'
import { Note, NoteWithContent } from './types'

export class SyncService {
  private isSyncing = false
  private lastSyncTime: string | null = null

  constructor() {
    this.loadLastSyncTime()
  }

  private loadLastSyncTime() {
    if (typeof window !== 'undefined') {
      this.lastSyncTime = localStorage.getItem('lastSyncTime')
    }
  }

  private saveLastSyncTime(timestamp: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSyncTime', timestamp)
      this.lastSyncTime = timestamp
    }
  }

  // Get user's encryption key (with caching)
  private async getUserEncryptionKey(): Promise<CryptoKey> {
    if (!supabaseClient.getCurrentUser()) {
      throw new Error('No authenticated user')
    }

    // Check cache first
    const cacheKey = 'encryption_key_cache'
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const { keyMaterial, salt, timestamp } = JSON.parse(cached)
        const oneHour = 60 * 60 * 1000
        if (Date.now() - timestamp < oneHour) {
          return await noteEncryption.generateKey(keyMaterial, salt)
        }
      } catch (e) {
        console.warn('Failed to use cached encryption key')
      }
    }

    // Generate new key from user data
    const user = supabaseClient.getCurrentUser()
    const keyMaterial = `${user.id}:${user.email}`
    
    // Get salt from profile
    const profilesResponse = await fetch(`${supabaseClient.apiUrl}/profiles?id=eq.${user.id}&select=salt`, {
      headers: supabaseClient.getHeaders()
    })
    
    let salt: string | undefined
    if (profilesResponse.ok) {
      const profiles = await profilesResponse.json()
      salt = profiles?.[0]?.salt
    }
    
    if (!salt) {
      // Generate new salt if none exists
      salt = noteEncryption.generateSalt()
      await fetch(`${supabaseClient.apiUrl}/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: supabaseClient.getHeaders(),
        body: JSON.stringify({ salt })
      })
    }

    // Cache the key material
    const cacheData = {
      keyMaterial,
      salt,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))

    return await noteEncryption.generateKey(keyMaterial, salt)
  }

  // Encrypt note for sync
  private async encryptNoteForSync(note: NoteWithContent): Promise<Note> {
    const userKey = await this.getUserEncryptionKey()
    
    const encryptedTitle = await noteEncryption.encryptNote(note.title, userKey)
    const encryptedContent = await noteEncryption.encryptNote(note.content, userKey)
    const contentHash = await noteEncryption.generateContentHash(note.title + note.content)

    return {
      id: note.id,
      user_id: note.user_id,
      title_encrypted: encryptedTitle,
      content_encrypted: encryptedContent,
      content_hash: contentHash,
      is_deleted: note.is_deleted || false,
      created_at: note.created_at,
      updated_at: note.updated_at,
      deleted_at: note.deleted_at,
      last_synced_at: note.last_synced_at,
      sync_pending: note.sync_pending
    }
  }

  // Decrypt note from sync
  private async decryptNoteFromSync(encryptedNote: Note): Promise<NoteWithContent> {
    const userKey = await this.getUserEncryptionKey()
    
    const decryptedTitle = await noteEncryption.decryptNote(encryptedNote.title_encrypted, userKey)
    const decryptedContent = await noteEncryption.decryptNote(encryptedNote.content_encrypted, userKey)

    return {
      ...encryptedNote,
      title: decryptedTitle,
      content: decryptedContent,
      // Add UI-specific fields with defaults
      domain: 'unknown',
      url: null,
      is_url_specific: false,
      tags: [],
      color: null,
      is_pinned: false,
      version: 1
    }
  }

  // Sync notes to server
  async syncNotes(notes: NoteWithContent[], deletions: string[] = []): Promise<any> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress')
    }

    if (!supabaseClient.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    this.isSyncing = true

    try {
      // Encrypt notes before sending
      const encryptedNotes = await Promise.all(
        notes.map(note => this.encryptNoteForSync(note))
      )

      // Prepare sync payload matching edge function
      const syncPayload = {
        operation: 'sync',
        notes: encryptedNotes,
        deletions: deletions.map(id => ({ id })),
        lastSyncTime: this.lastSyncTime,
        timestamp: new Date().toISOString()
      }

      // Call edge function
      const response = await fetch(`${supabaseClient.supabaseUrl}/functions/v1/sync-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseClient.accessToken}`,
          'apikey': supabaseClient.supabaseAnonKey
        },
        body: JSON.stringify(syncPayload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Sync failed: ${errorText}`)
      }

      const result = await response.json()
      
      // Update sync time
      this.saveLastSyncTime(new Date().toISOString())
      
      return result
    } finally {
      this.isSyncing = false
    }
  }

  // Fetch notes from server
  async fetchNotes(): Promise<NoteWithContent[]> {
    if (!supabaseClient.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    try {
      // Use direct database API instead of edge function for fetching
      const response = await fetch(`${supabaseClient.apiUrl}/notes?user_id=eq.${supabaseClient.getCurrentUser()?.id}&is_deleted=eq.false&order=updated_at.desc`, {
        headers: supabaseClient.getHeaders()
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Fetch failed: ${errorText}`)
      }

      const encryptedNotes = await response.json()
      
      if (!encryptedNotes || !Array.isArray(encryptedNotes)) {
        return []
      }

      // Decrypt notes
      const decryptedNotes = await Promise.all(
        encryptedNotes.map((note: Note) => this.decryptNoteFromSync(note))
      )

      return decryptedNotes
    } catch (error) {
      console.error('Failed to fetch notes:', error)
      return []
    }
  }

  // Handle password reset - IMPORTANT: This re-encrypts all notes with new key
  async handlePasswordReset(newPassword: string): Promise<void> {
    if (!supabaseClient.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    try {
      // Get all user notes
      const notesResponse = await fetch(`${supabaseClient.apiUrl}/notes?user_id=eq.${supabaseClient.getCurrentUser()?.id}&is_deleted=eq.false`, {
        headers: supabaseClient.getHeaders()
      })
      
      if (!notesResponse.ok) {
        throw new Error('Failed to fetch notes for re-encryption')
      }
      
      const encryptedNotes = await notesResponse.json()

      if (!encryptedNotes || encryptedNotes.length === 0) {
        return
      }

      // Generate new encryption key from new password
      const user = supabaseClient.getCurrentUser()
      const newSalt = noteEncryption.generateSalt()
      const newKey = await noteEncryption.generateKey(newPassword, newSalt)

      // Update user's salt in profile
      await fetch(`${supabaseClient.apiUrl}/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: supabaseClient.getHeaders(),
        body: JSON.stringify({ salt: newSalt })
      })

      // Re-encrypt all notes with new key
      const reEncryptedNotes = []
      for (const encryptedNote of encryptedNotes) {
        try {
          // Decrypt with old key (if possible)
          const oldKey = await this.getUserEncryptionKey()
          let decryptedTitle: string, decryptedContent: string

          try {
            decryptedTitle = await noteEncryption.decryptNote(encryptedNote.title_encrypted, oldKey)
            decryptedContent = await noteEncryption.decryptNote(encryptedNote.content_encrypted, oldKey)
          } catch (e) {
            // If decryption fails, skip this note (it's already unreadable)
            console.warn(`Failed to decrypt note ${encryptedNote.id}, skipping re-encryption`)
            continue
          }

          // Re-encrypt with new key
          const newEncryptedTitle = await noteEncryption.encryptNote(decryptedTitle, newKey)
          const newEncryptedContent = await noteEncryption.encryptNote(decryptedContent, newKey)
          const newContentHash = await noteEncryption.generateContentHash(decryptedTitle + decryptedContent)

          reEncryptedNotes.push({
            ...encryptedNote,
            title_encrypted: newEncryptedTitle,
            content_encrypted: newEncryptedContent,
            content_hash: newContentHash
          })
        } catch (error) {
          console.error(`Failed to re-encrypt note ${encryptedNote.id}:`, error)
        }
      }

      // Update all re-encrypted notes in database
      if (reEncryptedNotes.length > 0) {
        for (const note of reEncryptedNotes) {
          await fetch(`${supabaseClient.apiUrl}/notes?id=eq.${note.id}`, {
            method: 'PATCH',
            headers: supabaseClient.getHeaders(),
            body: JSON.stringify({
              title_encrypted: note.title_encrypted,
              content_encrypted: note.content_encrypted,
              content_hash: note.content_hash,
              updated_at: new Date().toISOString()
            })
          })
        }
      }

      // Clear encryption key cache
      localStorage.removeItem('encryption_key_cache')
      
      console.log(`Successfully re-encrypted ${reEncryptedNotes.length} notes with new password`)
    } catch (error) {
      console.error('Failed to handle password reset:', error)
      throw error
    }
  }

  // Check sync status
  getSyncStatus() {
    return {
      isOnline: navigator.onLine,
      lastSync: this.lastSyncTime,
      pendingChanges: 0, // Will be updated by notes service
      isSyncing: this.isSyncing
    }
  }
}

// Export singleton instance
export const syncService = new SyncService()
