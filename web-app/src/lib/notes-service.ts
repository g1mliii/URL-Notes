// URL Notes Web App - Notes Service
// Integrates with sync service and uses correct database schema

import { supabaseClient } from './supabase'
import { syncService } from './sync-service'
import { Note, NoteWithContent } from './types'

export class NotesService {
  private notes: NoteWithContent[] = []
  private isInitialized = false

  // Initialize service and load notes
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Try to fetch from server first
      const serverNotes = await syncService.fetchNotes()
      if (serverNotes.length > 0) {
        this.notes = serverNotes
      } else {
        // Fallback to local storage if no server notes
        this.loadFromLocalStorage()
      }
      this.isInitialized = true
    } catch (error) {
      console.warn('Failed to initialize from server, using local storage:', error)
      this.loadFromLocalStorage()
      this.isInitialized = true
    }
  }

  // Load notes from local storage
  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem('url_notes_web')
      if (stored) {
        this.notes = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load notes from localStorage:', error)
      this.notes = []
    }
  }

  // Save notes to local storage
  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem('url_notes_web', JSON.stringify(this.notes))
    } catch (error) {
      console.error('Failed to save notes to localStorage:', error)
    }
  }

  // Get all notes
  async getNotes(): Promise<NoteWithContent[]> {
    await this.initialize()
    return [...this.notes]
  }

  // Get note by ID
  async getNoteById(id: string): Promise<NoteWithContent | null> {
    await this.initialize()
    return this.notes.find(note => note.id === id) || null
  }

  // Create new note
  async createNote(noteData: Partial<NoteWithContent>): Promise<NoteWithContent> {
    await this.initialize()

    const newNote: NoteWithContent = {
      id: crypto.randomUUID(),
      user_id: supabaseClient.getCurrentUser()?.id || '',
      title: noteData.title || 'New Note',
      content: noteData.content || 'Start writing your note here...',
      domain: noteData.domain || 'unknown',
      url: noteData.url || null,
      is_url_specific: noteData.is_url_specific || false,
      tags: noteData.tags || [],
      color: noteData.color || null,
      is_pinned: noteData.is_pinned || false,
      version: noteData.version || 1,
      content_hash: 'temp_hash_' + Date.now(), // Will be updated by sync service
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      last_synced_at: null,
      sync_pending: true
    }

    this.notes.unshift(newNote)
    this.saveToLocalStorage()

    // Try to sync to server
    try {
      const result = await syncService.syncNotes([newNote])
      
      // Handle any missing notes from server
      if (result.missingNotes && Array.isArray(result.missingNotes)) {
        for (const serverNote of result.missingNotes) {
          const localNote = this.notes.find(n => n.id === serverNote.id)
          if (!localNote) {
            this.notes.push(serverNote)
          }
        }
      }
      
      newNote.sync_pending = false
      newNote.last_synced_at = new Date().toISOString()
      this.saveToLocalStorage()
    } catch (error) {
      console.warn('Failed to sync new note:', error)
    }

    return newNote
  }

  // Update existing note
  async updateNote(id: string, updates: Partial<NoteWithContent>): Promise<NoteWithContent> {
    await this.initialize()

    const noteIndex = this.notes.findIndex(note => note.id === id)
    if (noteIndex === -1) {
      throw new Error(`Note with ID ${id} not found`)
    }

    const updatedNote: NoteWithContent = {
      ...this.notes[noteIndex],
      ...updates,
      updated_at: new Date().toISOString(),
      sync_pending: true
    }

    this.notes[noteIndex] = updatedNote
    this.saveToLocalStorage()

    // Try to sync to server
    try {
      const result = await syncService.syncNotes([updatedNote])
      
      // Handle any missing notes from server
      if (result.missingNotes && Array.isArray(result.missingNotes)) {
        for (const serverNote of result.missingNotes) {
          const localNote = this.notes.find(n => n.id === serverNote.id)
          if (!localNote) {
            this.notes.push(serverNote)
          }
        }
      }
      
      updatedNote.sync_pending = false
      updatedNote.last_synced_at = new Date().toISOString()
      this.notes[noteIndex] = updatedNote
      this.saveToLocalStorage()
    } catch (error) {
      console.warn('Failed to sync updated note:', error)
    }

    return updatedNote
  }

  // Delete note
  async deleteNote(id: string): Promise<void> {
    await this.initialize()

    const noteIndex = this.notes.findIndex(note => note.id === id)
    if (noteIndex === -1) {
      throw new Error(`Note with ID ${id} not found`)
    }

    // Mark as deleted instead of removing
    const deletedNote: NoteWithContent = {
      ...this.notes[noteIndex],
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_pending: true
    }

    this.notes[noteIndex] = deletedNote
    this.saveToLocalStorage()

    // Try to sync deletion to server
    try {
      const result = await syncService.syncNotes([deletedNote], [id])
      
      // Handle any missing notes from server
      if (result.missingNotes && Array.isArray(result.missingNotes)) {
        for (const serverNote of result.missingNotes) {
          const localNote = this.notes.find(n => n.id === serverNote.id)
          if (!localNote) {
            this.notes.push(serverNote)
          }
        }
      }
      
      deletedNote.sync_pending = false
      deletedNote.last_synced_at = new Date().toISOString()
      this.notes[noteIndex] = deletedNote
      this.saveToLocalStorage()
    } catch (error) {
      console.warn('Failed to sync note deletion:', error)
    }
  }

  // Search notes
  async searchNotes(query: string): Promise<NoteWithContent[]> {
    await this.initialize()

    if (!query.trim()) {
      return this.notes.filter(note => !note.is_deleted)
    }

    const searchTerm = query.toLowerCase()
    return this.notes.filter(note => 
      !note.is_deleted &&
      (note.title.toLowerCase().includes(searchTerm) ||
       note.content.toLowerCase().includes(searchTerm) ||
       note.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
       (note.domain && note.domain.toLowerCase().includes(searchTerm)))
    )
  }

  // Get notes by domain
  async getNotesByDomain(domain: string): Promise<NoteWithContent[]> {
    await this.initialize()
    return this.notes.filter(note => 
      !note.is_deleted && 
      note.domain === domain
    )
  }

  // Get notes by tag
  async getNotesByTag(tag: string): Promise<NoteWithContent[]> {
    await this.initialize()
    return this.notes.filter(note => 
      !note.is_deleted && 
      note.tags.includes(tag)
    )
  }

  // Get pinned notes
  async getPinnedNotes(): Promise<NoteWithContent[]> {
    await this.initialize()
    return this.notes.filter(note => 
      !note.is_deleted && 
      note.is_pinned
    )
  }

  // Sync all pending changes
  async syncAll(): Promise<void> {
    await this.initialize()

    const pendingNotes = this.notes.filter(note => note.sync_pending)
    if (pendingNotes.length === 0) return

    try {
      const result = await syncService.syncNotes(pendingNotes)
      
      // Handle missing notes from server (notes that exist on server but not in client data)
      if (result.missingNotes && Array.isArray(result.missingNotes)) {
        console.log('NotesService: Processing missing notes from server:', result.missingNotes.length)
        
        for (const serverNote of result.missingNotes) {
          // Only add if note doesn't exist locally
          const localNote = this.notes.find(n => n.id === serverNote.id)
          if (!localNote) {
            // Ensure URL and domain are present before adding
            if (!serverNote.url || !serverNote.domain) {
              console.warn('NotesService: Server note missing URL or domain:', serverNote.id)
            }
            this.notes.push(serverNote)
          }
        }
      }
      
      // Update sync status for all notes
      const now = new Date().toISOString()
      this.notes = this.notes.map(note => ({
        ...note,
        sync_pending: false,
        last_synced_at: now
      }))
      
      this.saveToLocalStorage()
    } catch (error) {
      console.error('Failed to sync all notes:', error)
      throw error
    }
  }

  // Force refresh from server
  async refreshFromServer(): Promise<void> {
    try {
      const serverNotes = await syncService.fetchNotes()
      this.notes = serverNotes
      this.saveToLocalStorage()
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to refresh from server:', error)
      throw error
    }
  }

  // Get sync status
  getSyncStatus() {
    const pendingCount = this.notes.filter(note => note.sync_pending).length
    const lastSync = this.notes.length > 0 
      ? Math.max(...this.notes.map(note => new Date(note.last_synced_at || 0).getTime()))
      : null

    const baseSyncStatus = syncService.getSyncStatus()
    return {
      ...baseSyncStatus,
      pendingChanges: pendingCount,
      lastSync: lastSync ? new Date(lastSync).toISOString() : baseSyncStatus.lastSync
    }
  }

  // Clear all data (for testing/logout)
  clearAll(): void {
    this.notes = []
    this.isInitialized = false
    if (typeof window !== 'undefined') {
      localStorage.removeItem('url_notes_web')
    }
  }
}

// Export singleton instance
export const notesService = new NotesService()
