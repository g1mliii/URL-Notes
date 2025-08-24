'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { NotesList } from './notes-list'
import { NoteEditor } from './note-editor'
import { EmptyState } from './empty-state'
import { Button } from '@/components/ui/button'
import { Plus, Filter, SortAsc, SortDesc, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NotesView() {
  const {
    viewMode,
    notes,
    selectedNote,
    setSelectedNote,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    selectedTags,
    setSelectedTags,
    getFilteredNotes,
    getTags,
    loadNotes,
    createNote
  } = useAppStore()

  const filteredNotes = getFilteredNotes()
  const tags = getTags()

  // Load notes on component mount
  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const handleNewNote = async () => {
    await createNote({
      domain: 'example.com',
      title: 'New Note',
      content: 'Start writing your note here...',
      tags: []
    })
  }

  const handleSortChange = () => {
    if (sortOrder === 'asc') {
      setSortOrder('desc')
    } else {
      setSortOrder('asc')
    }
  }

  const getViewModeLabel = () => {
    switch (viewMode) {
      case 'all':
        return 'All Notes'
      case 'site':
        return 'This Site'
      case 'page':
        return 'This Page'
      default:
        return 'Notes'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Google Drive Style Top Bar */}
      <div className="flex items-center justify-between p-6 bg-white/10 backdrop-blur-md border-b border-white/20 rounded-t-xl">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-white/80">Filter:</label>
            <select className="text-sm border border-white/20 rounded-lg px-3 py-2 bg-white/10 backdrop-blur-md text-white placeholder-white/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all">
              <option value="all" className="bg-slate-800 text-white">All Notes</option>
              <option value="recent" className="bg-slate-800 text-white">Recent</option>
              <option value="pinned" className="bg-slate-800 text-white">Pinned</option>
            </select>
          </div>
          <span className="text-sm text-white/60">Updated</span>
        </div>
        
        <Button onClick={handleNewNote} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium">
          + New
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex bg-gradient-to-br from-slate-800/50 to-slate-900/50">
        {/* Notes List - Google Drive Style */}
        <div className="w-80 border-r border-white/20 bg-white/5 backdrop-blur-md p-4">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              {getViewModeLabel()}
            </h2>
            <p className="text-sm text-white/60">
              {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {/* Tags Filter */}
          {tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-white/80 mb-3">Filter by Tags</h3>
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 8).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag))
                      } else {
                        setSelectedTags([...selectedTags, tag])
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-full border transition-all duration-200 backdrop-blur-md",
                      selectedTags.includes(tag)
                        ? "bg-blue-500/20 border-blue-400/40 text-blue-300 shadow-lg"
                        : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:border-white/30"
                    )}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes List */}
          <div className="flex-1 overflow-hidden">
            {filteredNotes.length > 0 ? (
              <NotesList
                notes={filteredNotes}
                selectedNote={selectedNote}
                onNoteSelect={setSelectedNote}
              />
            ) : (
              <EmptyState viewMode={viewMode} />
            )}
          </div>
        </div>

        {/* Note Editor */}
        <div className="flex-1 p-6">
          {selectedNote ? (
            <NoteEditor note={selectedNote} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-white/40 mb-4">
                  <FileText size={64} />
                </div>
                <h3 className="text-xl font-medium text-white mb-3">
                  Select a note to edit
                </h3>
                <p className="text-white/60 text-lg">
                  Choose a note from the list or create a new one to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
