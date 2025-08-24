export interface User {
  id: string
  email: string
  subscription_tier: 'free' | 'premium'
  subscription_expires_at?: string
  storage_used_bytes: number
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  title_encrypted: any // JSONB encrypted title
  content_encrypted: any // JSONB encrypted content
  content_hash: string
  url?: string | null
  domain?: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
  last_synced_at?: string | null
  sync_pending?: boolean
}

export interface NoteVersion {
  id: string
  note_id: string
  user_id: string
  version: number
  content_encrypted: string
  created_at: string
}

export interface NoteWithContent extends Omit<Note, 'title_encrypted' | 'content_encrypted'> {
  title: string
  content: string
  // Additional fields for the web app UI
  domain?: string
  url?: string | null
  is_url_specific?: boolean
  tags: string[]
  color?: string | null
  is_pinned?: boolean
  version?: number
}

export interface DomainGroup {
  domain: string
  notes: NoteWithContent[]
  totalNotes: number
  tags: string[]
}

export interface SearchResult {
  note: NoteWithContent
  score: number
  matchedFields: string[]
}

export interface SyncStatus {
  isOnline: boolean
  lastSync: string | null
  pendingChanges: number
  isSyncing: boolean
  error?: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  editorFont: string
  editorFontSize: number
  compactMode: boolean
  autoSave: boolean
}

export interface ExportOptions {
  format: 'json' | 'markdown' | 'html' | 'pdf'
  includeVersions: boolean
  includeDeleted: boolean
  dateRange?: {
    start: string
    end: string
  }
}
