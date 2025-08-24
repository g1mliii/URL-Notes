'use client'

import { NoteWithContent } from '@/lib/types'
import { formatDate, truncateText, generateNoteTitle } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Tag, Clock, Star } from 'lucide-react'

interface NotesListProps {
  notes: NoteWithContent[]
  selectedNote: NoteWithContent | null
  onNoteSelect: (note: NoteWithContent) => void
}

export function NotesList({ notes, selectedNote, onNoteSelect }: NotesListProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No notes found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-96 lg:max-h-[calc(100vh-300px)]">
      {notes.map((note) => (
        <div
          key={note.id}
          onClick={() => onNoteSelect(note)}
          className={cn(
            "p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] backdrop-blur-md",
            selectedNote?.id === note.id
              ? "border-blue-400/60 bg-blue-500/10 shadow-lg shadow-blue-500/20"
              : "border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/30 hover:shadow-lg hover:shadow-white/10"
          )}
        >
          {/* Note Header */}
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-white line-clamp-2 text-base">
              {note.title || generateNoteTitle(note.content)}
            </h3>
            {note.is_pinned && (
              <Star size={16} className="text-yellow-400 flex-shrink-0 ml-2 drop-shadow-sm" />
            )}
          </div>

          {/* Note Content Preview */}
          <p className="text-sm text-white/70 mb-4 line-clamp-3 leading-relaxed">
            {truncateText(note.content, 120)}
          </p>

          {/* Note Metadata */}
          <div className="flex items-center justify-between text-xs text-white/60 mb-3">
            <div className="flex items-center space-x-2">
              <Clock size={12} className="text-white/50" />
              <span>{formatDate(note.updated_at)}</span>
            </div>
            
            {/* Tags */}
            {note.tags.length > 0 && (
              <div className="flex items-center space-x-1">
                <Tag size={12} className="text-white/50" />
                <span>{note.tags.length}</span>
              </div>
            )}
          </div>

          {/* Domain/URL Info */}
          <div className="text-xs text-white/50">
            <div className="font-medium text-white/70">{note.domain}</div>
            {note.url && note.url !== note.domain && (
              <div className="truncate text-white/60">{note.url}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
