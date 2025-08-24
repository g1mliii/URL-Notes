import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { NoteWithContent, User, UserPreferences, SyncStatus } from './types'
import { notesService } from './notes-service'

interface AppState {
  // User state
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Notes state
  notes: NoteWithContent[]
  selectedNote: NoteWithContent | null
  viewMode: 'all' | 'site' | 'page'
  currentDomain: string | null
  currentUrl: string | null
  
  // Search and filtering
  searchQuery: string
  selectedTags: string[]
  sortBy: 'updated' | 'created' | 'title'
  sortOrder: 'asc' | 'desc'
  
  // UI state
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  compactMode: boolean
  
  // Sync state
  syncStatus: SyncStatus
  
  // User preferences
  preferences: UserPreferences
  
  // Actions
  setUser: (user: User | null) => void
  setAuthenticated: (authenticated: boolean) => void
  setLoading: (loading: boolean) => void
  
  setNotes: (notes: NoteWithContent[]) => void
  addNote: (note: NoteWithContent) => void
  updateNote: (id: string, updates: Partial<NoteWithContent>) => void
  deleteNote: (id: string) => void
  setSelectedNote: (note: NoteWithContent | null) => void
  loadNotes: () => Promise<void>
  createNote: (noteData: Partial<NoteWithContent>) => Promise<void>
  saveNote: (id: string, updates: Partial<NoteWithContent>) => Promise<void>
  
  setViewMode: (mode: 'all' | 'site' | 'page') => void
  setCurrentDomain: (domain: string | null) => void
  setCurrentUrl: (url: string | null) => void
  
  setSearchQuery: (query: string) => void
  setSelectedTags: (tags: string[]) => void
  setSortBy: (sortBy: 'updated' | 'created' | 'title') => void
  setSortOrder: (order: 'asc' | 'desc') => void
  
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setCompactMode: (compact: boolean) => void
  
  setSyncStatus: (status: Partial<SyncStatus>) => void
  
  setPreferences: (preferences: Partial<UserPreferences>) => void
  
  // Sync actions
  syncAll: () => Promise<void>
  refreshFromServer: () => Promise<void>
  
  // Computed values
  getFilteredNotes: () => NoteWithContent[]
  getNotesByDomain: () => Record<string, NoteWithContent[]>
  getTags: () => string[]
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      
      notes: [],
      selectedNote: null,
      viewMode: 'all',
      currentDomain: null,
      currentUrl: null,
      
      searchQuery: '',
      selectedTags: [],
      sortBy: 'updated',
      sortOrder: 'desc',
      
      sidebarOpen: true,
      theme: 'system',
      compactMode: false,
      
      syncStatus: {
        isOnline: true,
        lastSync: null,
        pendingChanges: 0,
        isSyncing: false,
      },
      
      preferences: {
        theme: 'system',
        editorFont: 'monospace',
        editorFontSize: 14,
        compactMode: false,
        autoSave: true,
      },
      
      // Actions
      setUser: (user) => set({ user }),
      setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
      setLoading: (loading) => set({ isLoading: loading }),
      
      setNotes: (notes) => set({ notes }),
      addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
      updateNote: (id, updates) => set((state) => ({
        notes: state.notes.map(note => 
          note.id === id ? { ...note, ...updates } : note
        ),
        selectedNote: state.selectedNote?.id === id 
          ? { ...state.selectedNote, ...updates }
          : state.selectedNote
      })),
      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter(note => note.id !== id),
        selectedNote: state.selectedNote?.id === id ? null : state.selectedNote
      })),
      setSelectedNote: (note) => set({ selectedNote: note }),
      
      // Async actions for working with notes service
      loadNotes: async () => {
        set({ isLoading: true })
        try {
          const notes = await notesService.getNotes()
          const syncStatus = notesService.getSyncStatus()
          set({ notes, isLoading: false, syncStatus })
        } catch (error) {
          console.error('Failed to load notes:', error)
          set({ isLoading: false })
        }
      },
      
      createNote: async (noteData) => {
        try {
          const newNote = await notesService.createNote(noteData)
          const syncStatus = notesService.getSyncStatus()
          set((state) => ({ 
            notes: [newNote, ...state.notes],
            selectedNote: newNote,
            syncStatus
          }))
        } catch (error) {
          console.error('Failed to create note:', error)
          throw error
        }
      },
      
      saveNote: async (id, updates) => {
        try {
          const updatedNote = await notesService.updateNote(id, updates)
          const syncStatus = notesService.getSyncStatus()
          set((state) => ({
            notes: state.notes.map(note => 
              note.id === id ? updatedNote : note
            ),
            selectedNote: state.selectedNote?.id === id ? updatedNote : state.selectedNote,
            syncStatus
          }))
        } catch (error) {
          console.error('Failed to save note:', error)
          throw error
        }
      },
      
      setViewMode: (viewMode) => set({ viewMode }),
      setCurrentDomain: (domain) => set({ currentDomain: domain }),
      setCurrentUrl: (url) => set({ currentUrl: url }),
      
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedTags: (selectedTags) => set({ selectedTags }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setTheme: (theme) => set({ theme }),
      setCompactMode: (compactMode) => set({ compactMode }),
      
      setSyncStatus: (status) => set((state) => ({
        syncStatus: { ...state.syncStatus, ...status }
      })),
      
      setPreferences: (preferences) => set((state) => ({
        preferences: { ...state.preferences, ...preferences }
      })),
      
      // Sync actions
      syncAll: async () => {
        try {
          await notesService.syncAll()
          const syncStatus = notesService.getSyncStatus()
          set({ syncStatus })
        } catch (error) {
          console.error('Failed to sync all notes:', error)
          throw error
        }
      },
      
      refreshFromServer: async () => {
        set({ isLoading: true })
        try {
          await notesService.refreshFromServer()
          const notes = await notesService.getNotes()
          const syncStatus = notesService.getSyncStatus()
          set({ notes, isLoading: false, syncStatus })
        } catch (error) {
          console.error('Failed to refresh from server:', error)
          set({ isLoading: false })
          throw error
        }
      },
      
      // Computed values
      getFilteredNotes: () => {
        const state = get()
        let filtered = [...state.notes]
        
        // Filter by view mode
        if (state.viewMode === 'site' && state.currentDomain) {
          filtered = filtered.filter(note => note.domain === state.currentDomain)
        } else if (state.viewMode === 'page' && state.currentUrl) {
          filtered = filtered.filter(note => note.url === state.currentUrl)
        }
        
        // Filter by search query
        if (state.searchQuery) {
          const query = state.searchQuery.toLowerCase()
          filtered = filtered.filter(note => 
            note.title?.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query) ||
            note.tags.some(tag => tag.toLowerCase().includes(query))
          )
        }
        
        // Filter by tags
        if (state.selectedTags.length > 0) {
          filtered = filtered.filter(note =>
            state.selectedTags.every(tag => note.tags.includes(tag))
          )
        }
        
        // Sort
        filtered.sort((a, b) => {
          let aValue: any, bValue: any
          
          switch (state.sortBy) {
            case 'updated':
              aValue = new Date(a.updated_at).getTime()
              bValue = new Date(b.updated_at).getTime()
              break
            case 'created':
              aValue = new Date(a.created_at).getTime()
              bValue = new Date(b.created_at).getTime()
              break
            case 'title':
              aValue = a.title || ''
              bValue = b.title || ''
              break
            default:
              return 0
          }
          
          if (state.sortOrder === 'asc') {
            return aValue > bValue ? 1 : -1
          } else {
            return aValue < bValue ? 1 : -1
          }
        })
        
        return filtered
      },
      
      getNotesByDomain: () => {
        const notes = get().getFilteredNotes()
        const grouped: Record<string, NoteWithContent[]> = {}
        
        notes.forEach(note => {
          const domain = note.domain || 'unknown'
          if (!grouped[domain]) {
            grouped[domain] = []
          }
          grouped[domain].push(note)
        })
        
        return grouped
      },
      
      getTags: () => {
        const state = get()
        const tagSet = new Set<string>()
        
        state.notes.forEach(note => {
          note.tags.forEach(tag => tagSet.add(tag))
        })
        
        return Array.from(tagSet).sort()
      },
    }),
    {
      name: 'url-notes-store',
      partialize: (state) => ({
        theme: state.theme,
        compactMode: state.compactMode,
        preferences: state.preferences,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)
