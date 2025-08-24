'use client'

import { Button } from '@/components/ui/button'
import { Plus, FileText, Globe, Home } from 'lucide-react'

interface EmptyStateProps {
  viewMode: 'all' | 'site' | 'page'
}

export function EmptyState({ viewMode }: EmptyStateProps) {
  const getEmptyStateContent = () => {
    switch (viewMode) {
      case 'all':
        return {
          icon: Home,
          title: 'No notes yet',
          description: 'Start creating notes to organize your web research and thoughts.',
          action: 'Create your first note'
        }
      case 'site':
        return {
          icon: Globe,
          title: 'No notes for this site',
          description: 'You haven\'t created any notes for this domain yet.',
          action: 'Add a note for this site'
        }
      case 'page':
        return {
          icon: FileText,
          title: 'No notes for this page',
          description: 'This page doesn\'t have any notes yet.',
          action: 'Create a note for this page'
        }
      default:
        return {
          icon: FileText,
          title: 'No notes found',
          description: 'Try adjusting your search or filters.',
          action: 'Create a new note'
        }
    }
  }

  const content = getEmptyStateContent()
  const Icon = content.icon

  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-6 border border-white/20">
        <Icon size={32} className="text-white/60" />
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-3">
        {content.title}
      </h3>
      
      <p className="text-white/70 mb-6 max-w-sm mx-auto text-lg leading-relaxed">
        {content.description}
      </p>
      
      <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium">
        <Plus size={16} className="mr-2" />
        {content.action}
      </Button>
      
      {viewMode === 'all' && (
        <div className="mt-8 text-sm text-white/60">
          <p className="font-medium text-white/80 mb-3">Tips for getting started:</p>
          <ul className="space-y-2">
            <li className="flex items-center justify-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
              Install the browser extension for easy note creation
            </li>
            <li className="flex items-center justify-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
              Use tags to organize your notes
            </li>
            <li className="flex items-center justify-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
              Search across all your notes
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
