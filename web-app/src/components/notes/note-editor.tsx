'use client'

import { useState, useEffect } from 'react'
import { NoteWithContent } from '@/lib/types'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { 
  Save, 
  Tag, 
  Star, 
  Trash2, 
  ExternalLink,
  MoreVertical,
  Clock,
  Calendar
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface NoteEditorProps {
  note: NoteWithContent
}

export function NoteEditor({ note }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title || '')
  const [content, setContent] = useState(note.content)
  const [tags, setTags] = useState(note.tags.join(', '))
  const [isEditing, setIsEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  const { saveNote } = useAppStore()

  useEffect(() => {
    setTitle(note.title || '')
    setContent(note.content)
    setTags(note.tags.join(', '))
    setHasChanges(false)
  }, [note])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    setHasChanges(true)
  }

  const handleContentChange = (value: string) => {
    setContent(value)
    setHasChanges(true)
  }

  const handleTagsChange = (value: string) => {
    setTags(value)
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(Boolean)
      await saveNote(note.id, {
        title,
        content,
        tags: tagsArray
      })
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save note:', error)
    }
  }

  const handleDelete = () => {
    // TODO: Implement delete functionality
    if (confirm('Are you sure you want to delete this note?')) {
      console.log('Deleting note:', note.id)
    }
  }

  const togglePin = () => {
    // TODO: Implement pin functionality
    console.log('Toggling pin for note:', note.id)
  }

  const openUrl = () => {
    if (note.url) {
      window.open(note.url, '_blank')
    }
  }

  return (
    <div className="h-full flex flex-col bg-[rgba(28,28,30,0.66)] backdrop-blur-[24px] rounded-lg border border-[rgba(255,255,255,0.14)] shadow-[0_2px_7px_rgba(0,0,0,0.06)]">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.14)] bg-gradient-to-r from-[rgba(255,255,255,0.10)] to-[rgba(255,255,255,0.04)]">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePin}
            className={cn(
              "p-2 text-[rgba(255,255,255,0.86)] hover:bg-[rgba(255,255,255,0.14)]",
              note.is_pinned && "text-yellow-400"
            )}
          >
            <Star size={16} />
          </Button>
          
          {note.url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={openUrl}
              className="p-2 text-[rgba(255,255,255,0.86)] hover:bg-[rgba(255,255,255,0.14)]"
            >
              <ExternalLink size={16} />
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {hasChanges && (
            <span className="text-xs text-orange-400">
              Unsaved changes
            </span>
          )}
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            size="sm"
            className="bg-[rgba(0,122,255,1)] hover:bg-[rgba(0,122,255,0.8)] text-white"
          >
            <Save size={16} className="mr-2" />
            Save
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="text-[rgba(255,255,255,0.86)] hover:bg-[rgba(255,255,255,0.14)]"
          >
            <MoreVertical size={16} />
          </Button>
        </div>
      </div>

      {/* Note Info */}
      <div className="p-4 border-b border-[rgba(255,255,255,0.14)] bg-gradient-to-r from-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.04)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Calendar size={14} className="text-[rgba(255,255,255,0.55)]" />
            <span className="text-[rgba(255,255,255,0.86)]">
              Created: {formatDate(note.created_at)}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Clock size={14} className="text-[rgba(255,255,255,0.55)]" />
            <span className="text-[rgba(255,255,255,0.86)]">
              Updated: {formatDate(note.updated_at)}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Tag size={14} className="text-[rgba(255,255,255,0.55)]" />
            <span className="text-[rgba(255,255,255,0.86)]">
              Domain: {note.domain}
            </span>
          </div>
          
          {note.url && (
            <div className="flex items-center space-x-2">
              <ExternalLink size={14} className="text-[rgba(255,255,255,0.55)]" />
              <span className="text-[rgba(255,255,255,0.86)] truncate">
                URL: {note.url}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium text-[rgba(255,255,255,0.86)] mb-2">
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Note title (optional)"
            className="text-lg font-medium bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.14)] text-[rgba(255,255,255,0.86)] placeholder-[rgba(255,255,255,0.56)] focus:border-[rgba(0,122,255,1)] focus:ring-[rgba(0,122,255,0.2)]"
          />
        </div>

        {/* Tags Input */}
        <div>
          <label className="block text-sm font-medium text-[rgba(255,255,255,0.86)] mb-2">
            Tags
          </label>
          <div className="relative">
            <Tag size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[rgba(255,255,255,0.55)]" />
            <Input
              value={tags}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="Enter tags separated by commas"
              className="pl-10 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.14)] text-[rgba(255,255,255,0.86)] placeholder-[rgba(255,255,255,0.56)] focus:border-[rgba(0,122,255,1)] focus:ring-[rgba(0,122,255,0.2)]"
            />
          </div>
        </div>

        {/* Content Editor */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-[rgba(255,255,255,0.86)] mb-2">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing your note..."
            className="w-full h-64 p-3 border border-[rgba(255,255,255,0.14)] rounded-md resize-none bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.86)] placeholder-[rgba(255,255,255,0.56)] focus:border-[rgba(0,122,255,1)] focus:ring-[rgba(0,122,255,0.2)]"
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* Editor Footer */}
      <div className="p-4 border-t border-[rgba(255,255,255,0.14)] bg-gradient-to-r from-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[rgba(255,255,255,0.55)]">
            Version {note.version} • {content.length} characters
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="border-[rgba(255,255,255,0.14)] text-[rgba(255,255,255,0.86)] hover:bg-[rgba(255,255,255,0.14)]"
            >
              Cancel
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 size={16} className="mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
