'use client'

import { useState } from 'react'

interface Note {
  id: number
  title: string
  content: string
  domain?: string | null
  url?: string | null
  tags?: string[]
  created_at: string
  updated_at: string
}

interface NoteEditorProps {
  selectedNote: Note | null
  onClose: () => void
  onSave: (note: Note) => void
}

export default function NoteEditor({ selectedNote, onClose, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState(selectedNote?.title || '')
  const [content, setContent] = useState(selectedNote?.content || '')
  const [tags, setTags] = useState<string[]>(selectedNote?.tags || [])

  const handleSave = () => {
    if (selectedNote) {
      onSave({
        ...selectedNote,
        title,
        content,
        tags,
        updated_at: new Date().toISOString()
      })
    }
  }

  if (!selectedNote) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(8px)' }}>
        <div className="text-center opacity-30">
          <div className="w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(55, 65, 81, 0.1)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium mb-1" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Select a note to edit</h3>
          <p className="text-xs" style={{ color: 'rgba(156, 163, 175, 0.3)' }}>Click on any note from the list</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(8px)' }}>
      {/* Editor Header */}
      <div className="border-b" style={{ 
        borderColor: 'rgba(75, 85, 99, 0.3)', 
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        padding: '128px !important'
      }}>
        <div className="flex items-center justify-between" style={{ 
          marginBottom: '80px !important'
        }}>
          <div className="flex items-center" style={{ 
            gap: '64px !important'
          }}>
            <span style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.2)', 
              border: '1px solid rgba(59, 130, 246, 0.4)', 
              color: 'rgb(147, 197, 253)',
              fontSize: '60px !important',
              padding: '64px 32px !important',
              borderRadius: '50px',
              display: 'inline-block'
            }}>
              {selectedNote.domain}
            </span>
            <span style={{ 
              color: 'rgb(156, 163, 175)', 
              fontSize: '36px !important',
              padding: '16px',
              borderRadius: '8px'
            }}>
              {new Date(selectedNote.updated_at).toLocaleDateString()}
            </span>
          </div>
          <button
            onClick={handleSave}
            style={{ 
              backgroundColor: 'rgb(59, 130, 246)', 
              color: 'white',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              padding: '32px 80px !important',
              fontSize: '30px !important',
              borderRadius: '50px',
              fontWeight: '500'
            }}
          >
            Save Changes
          </button>
        </div>
        
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          style={{ 
            width: '100%',
            color: 'white', 
            backgroundColor: 'transparent',
            fontSize: '96px !important',
            fontWeight: '600',
            border: 'none',
            outline: 'none',
            marginBottom: '64px !important',
            padding: '16px'
          }}
        />
        
        <div className="flex flex-wrap" style={{ 
          gap: '32px !important'
        }}>
          {tags.map((tag, index) => (
            <span key={index} style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: 'rgb(147, 197, 253)',
              fontSize: '30px !important',
              padding: '20px 40px !important',
              borderRadius: '50px',
              display: 'inline-block'
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 p-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing your note..."
          className="w-full h-full bg-transparent border-none outline-none resize-none text-lg leading-relaxed"
          style={{ color: 'white' }}
        />
      </div>

      {/* Editor Footer */}
      <div className="p-10 border-t" style={{ borderColor: 'rgba(75, 85, 99, 0.3)' }}>
        <div className="flex items-center justify-between">
          <div className="text-lg" style={{ color: 'rgb(156, 163, 175)' }}>
            Last updated: {new Date(selectedNote.updated_at).toLocaleString()}
          </div>
          <div className="text-lg" style={{ color: 'rgb(156, 163, 175)' }}>
            {content.length} characters
          </div>
        </div>
      </div>
    </div>
  )
}
