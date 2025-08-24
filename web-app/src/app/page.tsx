'use client'

import { useState, useEffect } from 'react'
import { Settings, User, Crown, Bell } from 'lucide-react'
import NoteEditor from '../components/notes/note-editor'

// Define types for notes
interface Note {
  id: number
  title: string
  content: string
  domain: string
  url: string
  tags: string[]
  created_at: Date
  updated_at: Date
}

interface GroupedNotes {
  [key: string]: Note[]
}

export default function Home() {
  // State for filtering and notes
  const [filterMode, setFilterMode] = useState<'all' | 'domain' | 'site'>('all')
  const [notes, setNotes] = useState<Note[]>([])
  const [groupedNotes, setGroupedNotes] = useState<GroupedNotes>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showPremiumDropdown, setShowPremiumDropdown] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)

  // Sample notes data (replace with real data later)
  const sampleNotes: Note[] = [
    {
      id: 1,
      title: 'Meeting Notes - Project Alpha',
      content: 'Discussed timeline for Q1 deliverables and resource allocation. Team agreed on milestones and key deliverables...',
      domain: 'discuss.com',
      url: 'https://discuss.com/meeting',
      tags: ['meeting', 'project'],
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000)
    },
    {
      id: 2,
      title: 'Research Findings - AI Trends',
      content: 'Key insights from latest papers on transformer architectures. Notable improvements in attention mechanisms...',
      domain: 'research.ai',
      url: 'https://research.ai/trends',
      tags: ['ai', 'research'],
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000)
    },
    {
      id: 3,
      title: 'Shopping List',
      content: 'Milk, bread, eggs, vegetables for the week. Need to check pantry for existing items...',
      domain: 'grocery.com',
      url: 'https://grocery.com/list',
      tags: ['personal'],
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      id: 4,
      title: 'Follow-up Discussion',
      content: 'Need to schedule follow-up meeting to discuss implementation details and assign tasks...',
      domain: 'discuss.com',
      url: 'https://discuss.com/followup',
      tags: ['follow-up'],
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000)
    }
  ]

  // Filter, search, and sort notes based on current settings
  useEffect(() => {
    let filteredNotes = [...sampleNotes]
    
    // 1. Search filtering
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredNotes = filteredNotes.filter(note => 
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some(tag => tag.toLowerCase().includes(query)) ||
        note.domain.toLowerCase().includes(query)
      )
    }
    
    // 2. Sort notes
    filteredNotes.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'updated':
          aValue = a.updated_at.getTime()
          bValue = b.updated_at.getTime()
          break
        case 'created':
          aValue = a.created_at.getTime()
          bValue = b.created_at.getTime()
          break
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        default:
          return 0
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
    
    // 3. Group by filter mode
    if (filterMode === 'domain') {
      // Group by domain
      const grouped = filteredNotes.reduce((acc: GroupedNotes, note) => {
        const domain = note.domain || 'No Domain'
        if (!acc[domain]) {
          acc[domain] = []
        }
        acc[domain].push(note)
        return acc
      }, {})
      setGroupedNotes(grouped)
      setNotes([])
    } else if (filterMode === 'site') {
      // Group by site (URL)
      const grouped = filteredNotes.reduce((acc: GroupedNotes, note) => {
        const site = note.url || 'No URL'
        if (!acc[site]) {
          acc[site] = []
        }
        acc[site].push(note)
        return acc
      }, {})
      setGroupedNotes(grouped)
      setNotes([])
    } else {
      // Show all notes
      setNotes(filteredNotes)
      setGroupedNotes({})
    }
  }, [filterMode, searchQuery, sortBy, sortOrder])

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  // Get sort display text
  const getSortDisplayText = () => {
    const orderText = sortOrder === 'asc' ? 'Oldest' : 'Newest'
    switch (sortBy) {
      case 'updated': return `${orderText} Updated`
      case 'created': return `${orderText} Created`
      case 'title': return `Title ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`
      default: return 'Sort By'
    }
  }

  // Render grouped notes
  const renderGroupedNotes = () => {
    return Object.entries(groupedNotes).map(([group, groupNotes]) => (
      <div key={group} className="mb-10">
        <h4 className="text-sm font-medium mb-6 px-4 py-4" style={{ color: 'rgb(156, 163, 175)', backgroundColor: 'rgba(55, 65, 81, 0.1)', borderRadius: '12px' }}>
          {group} ({groupNotes.length} note{groupNotes.length !== 1 ? 's' : ''})
        </h4>
        <div className="space-y-3">
          {groupNotes.map(note => renderNoteItem(note))}
        </div>
      </div>
    ))
  }

  // Handle note selection
  const handleNoteClick = (note: Note) => {
    setSelectedNote(note)
  }

  // Handle note save
  const handleNoteSave = (updatedNote: Note) => {
    // Update the note in our local state
    setNotes(prevNotes => 
      prevNotes.map(note => 
        note.id === updatedNote.id ? updatedNote : note
      )
    )
    setSelectedNote(updatedNote)
  }

  // Handle note close
  const handleNoteClose = () => {
    setSelectedNote(null)
  }

  // Render individual note item
  const renderNoteItem = (note: Note) => (
    <div 
      key={note.id} 
      className="group cursor-pointer transition-all duration-200 hover:bg-gray-800/20" 
      style={{ border: '1px solid rgba(75, 85, 99, 0.3)', backgroundColor: 'rgba(0, 0, 0, 0.1)', borderRadius: '20px', padding: '16px' }}
      onClick={() => handleNoteClick(note)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 max-w-[350px]">
          <h3 className="text-sm font-medium truncate mb-2" style={{ color: 'white' }}>{note.title}</h3>
          <p className="text-xs mb-2 truncate" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>
            {note.content}
          </p>
          <div className="flex items-center space-x-3">
            <span className="text-xs" style={{ color: 'rgb(147, 197, 253)' }}>
              {note.domain}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between h-full ml-6">
          <div className="flex flex-wrap justify-end" style={{ gap: '16px', marginBottom: '20px' }}>
            {note.tags.map(tag => (
              <span key={tag} className="text-xs px-5 py-3 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'rgb(110, 231, 183)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className="text-xs" style={{ color: 'rgb(156, 163, 175)' }}>{formatRelativeTime(note.updated_at)}</span>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded" style={{ color: 'rgb(156, 163, 175)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: 'black', minHeight: '100vh', margin: 0, padding: 0 }}>
      {/* Sophisticated Subtle Background */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 1,
        background: `
          linear-gradient(135deg, rgba(55, 65, 81, 0.25), transparent 40%),
          linear-gradient(45deg, rgba(75, 85, 99, 0.20), transparent 50%),
          linear-gradient(225deg, rgba(107, 114, 128, 0.18), transparent 50%),
          radial-gradient(800px 600px at 20% 20%, rgba(55, 65, 81, 0.15), transparent 70%),
          radial-gradient(600px 400px at 80% 30%, rgba(75, 85, 99, 0.12), transparent 70%),
          radial-gradient(500px 300px at 30% 80%, rgba(107, 114, 128, 0.10), transparent 70%),
          radial-gradient(700px 500px at 85% 85%, rgba(55, 65, 81, 0.08), transparent 70%)
        `
      }}></div>

      {/* Main Content */}
      <div className="relative" style={{ margin: 0, padding: 0, zIndex: 10 }}>
        {/* Header */}
        <header className="border-b border-gray-800/50 px-6 py-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(31, 41, 55, 0.5)', margin: 0, padding: '16px 24px' }}>
          <div className="flex items-center justify-between">
            {/* Left side - Title */}
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold" style={{ color: 'white' }}>
                Notes
              </h1>
            </div>

            {/* Right side - Buttons */}
            <div className="flex items-center" style={{ gap: '20px' }}>
              {/* Premium Button */}
              <div className="relative">
                <button
                  onClick={() => setShowPremiumDropdown(!showPremiumDropdown)}
                  className="px-4 py-2 font-medium rounded-full transition-all duration-200 flex items-center space-x-2"
                  style={{ background: 'linear-gradient(to right, rgb(234, 179, 8), rgb(249, 115, 22))', color: 'black', border: '2px solid rgba(75, 85, 99, 0.8)' }}
                >
                  <Crown className="w-4 h-4" />
                  <span>Get Premium</span>
                </button>

                {/* Premium Dropdown */}
                {showPremiumDropdown && (
                  <div className="absolute mt-2 w-64 rounded-lg shadow-2xl border z-50 dropdown-premium" style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    background: 'rgba(0, 0, 0, 0.9)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    right: '-8px',
                    top: '100%',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold mb-2" style={{ color: 'white' }}>Premium Features</h3>
                      <ul className="space-y-2 text-sm" style={{ color: 'rgb(209, 213, 219)' }}>
                        <li className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Unlimited notes</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Advanced encryption</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Priority sync</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>AI-powered features</span>
                        </li>
                      </ul>
                      <button className="w-full mt-4 px-4 py-2 rounded-lg transition-colors" style={{ backgroundColor: 'rgb(37, 99, 235)', color: 'white' }}>
                        Upgrade Now
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications Button */}
              <button className="w-10 h-10 rounded-full flex items-center justify-center relative transition-all duration-200" style={{ backgroundColor: 'rgba(55, 65, 81, 0.3)', backdropFilter: 'blur(4px)', border: '2px solid rgba(75, 85, 99, 0.8)', color: 'rgb(209, 213, 219)' }}>
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full shadow-lg"></span>
              </button>

              {/* Settings Button */}
              <div className="relative">
                <button
                  onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{ backgroundColor: 'rgba(55, 65, 81, 0.3)', backdropFilter: 'blur(4px)', border: '2px solid rgba(75, 85, 99, 0.8)', color: 'rgb(209, 213, 219)' }}
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Settings Dropdown */}
                {showSettingsDropdown && (
                  <div className="absolute mt-2 w-56 rounded-lg shadow-2xl border z-50 dropdown-settings" style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    background: 'rgba(0, 0, 0, 0.9)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    right: '-8px',
                    top: '100%',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}>
                    <div className="py-2">
                      <button className="w-full text-left px-4 py-2.5 text-sm flex items-center space-x-3 transition-colors hover:bg-gray-700/50 rounded-md mx-2" style={{ color: 'rgb(209, 213, 219)' }}>
                        <Settings size={16} />
                        <span>Preferences</span>
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-sm flex items-center space-x-3 transition-colors hover:bg-gray-700/50 rounded-md mx-2" style={{ color: 'rgb(209, 213, 219)' }}>
                        <span>Keyboard Shortcuts</span>
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-sm flex items-center space-x-3 transition-colors hover:bg-gray-700/50 rounded-md mx-2" style={{ color: 'rgb(209, 213, 219)' }}>
                        <span>Export Data</span>
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-sm flex items-center space-x-3 transition-colors hover:bg-gray-700/50 rounded-md mx-2" style={{ color: 'rgb(209, 213, 219)' }}>
                        <span>About</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Button */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="w-10 h-10 rounded-full transition-all duration-200 border-2 flex items-center justify-center"
                  style={{ border: '2px solid rgba(75, 85, 99, 0.8)', backgroundColor: 'rgba(55, 65, 81, 0.3)', backdropFilter: 'blur(4px)' }}
                >
                  <User className="w-5 h-5" style={{ color: 'rgb(209, 213, 219)' }} />
                </button>

                {/* Profile Dropdown */}
                {showProfileDropdown && (
                  <div className="absolute mt-2 w-56 rounded-lg shadow-2xl border z-50 dropdown-profile" style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    background: 'rgba(0, 0, 0, 0.9)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    right: '-8px',
                    top: '100%',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}>
                    <div className="py-2">
                      <div className="px-4 py-3 text-sm border-b mx-2 rounded-md" style={{ borderBottom: '1px solid rgb(55, 65, 81)' }}>
                        <div className="font-medium" style={{ color: 'white' }}>john@example.com</div>
                        <div className="text-xs" style={{ color: 'rgb(156, 163, 175)' }}>Premium User</div>
                      </div>
                      
                      <button className="w-full text-left px-4 py-2.5 text-sm flex items-center space-x-3 transition-colors hover:bg-gray-700/50 rounded-md mx-2" style={{ color: 'rgb(209, 213, 219)' }}>
                        <User size={16} />
                        <span>Profile</span>
                      </button>
                      
                      <button className="w-full text-left px-4 py-2.5 text-sm flex items-center space-x-3 transition-colors hover:bg-gray-700/50 rounded-md mx-2" style={{ color: 'rgb(209, 213, 219)' }}>
                        <span>Account Settings</span>
                      </button>
                      
                      <button className="w-full text-left px-4 py-2.5 text-sm flex items-center space-x-3 transition-colors hover:bg-gray-700/50 rounded-md mx-2" style={{ color: 'rgb(248, 113, 113)' }}>
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex" style={{ height: 'calc(100vh - 80px)' }}>
          {/* Left Side - Notes Area (1/3 width, resizable) */}
          <div className="w-1/3 min-w-80 max-w-96 border-r border-gray-800/50 flex flex-col" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(8px)' }}>
            {/* Notes Subheader */}
            <div className="p-6 border-b border-gray-800/50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search notes..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-full transition-all duration-200"
                    style={{ 
                      padding: '20px 32px !important',
                      fontSize: '20px !important',
                      backgroundColor: 'rgba(55, 65, 81, 0.2)', 
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      color: 'white',
                      backdropFilter: 'blur(4px)'
                    }}
                  />
                  <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
                    <svg className="w-7 h-7" style={{ color: 'rgb(156, 163, 175)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center justify-center mb-6" style={{ gap: '32px !important' }}>
                {/* Left Side - Sort Button */}
                <div className="relative">
                  <button 
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="rounded-full font-medium transition-all duration-200 flex items-center space-x-2" 
                    style={{ 
                      padding: '8px 16px !important',
                      fontSize: '12px !important',
                      backgroundColor: 'rgba(55, 65, 81, 0.3)', 
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      color: 'white',
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    <span>Sort</span>
                  </button>
                  
                  {/* Sort Dropdown */}
                  {showSortDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-48 rounded-lg shadow-lg z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', border: '1px solid rgba(75, 85, 99, 0.5)' }}>
                      <div className="py-2">
                        <div className="px-4 py-2 text-xs font-medium" style={{ color: 'rgb(156, 163, 175)' }}>Sort By</div>
                        <button 
                          onClick={() => { setSortBy('updated'); setShowSortDropdown(false); }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
                          style={{ color: sortBy === 'updated' ? 'rgb(147, 197, 253)' : 'white' }}
                        >
                          Updated Date
                        </button>
                        <button 
                          onClick={() => { setSortBy('created'); setShowSortDropdown(false); }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
                          style={{ color: sortBy === 'created' ? 'rgb(147, 197, 253)' : 'white' }}
                        >
                          Created Date
                        </button>
                        <button 
                          onClick={() => { setSortBy('title'); setShowSortDropdown(false); }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
                          style={{ color: sortBy === 'title' ? 'rgb(147, 197, 253)' : 'white' }}
                        >
                          Title
                        </button>
                        
                        <div className="border-t border-gray-700 my-2"></div>
                        
                        <div className="px-4 py-2 text-xs font-medium" style={{ color: 'rgb(156, 163, 175)' }}>Order</div>
                        <button 
                          onClick={() => { setSortOrder('desc'); setShowSortDropdown(false); }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
                          style={{ color: sortOrder === 'desc' ? 'rgb(147, 197, 253)' : 'white' }}
                        >
                          Newest First
                        </button>
                        <button 
                          onClick={() => { setSortOrder('asc'); setShowSortDropdown(false); }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
                          style={{ color: sortOrder === 'asc' ? 'rgb(147, 197, 253)' : 'white' }}
                        >
                          Oldest First
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Main Filter Buttons - In Their Own Section */}
                <div className="flex items-center" style={{ 
                  gap: '24px !important',
                  padding: '8px 16px !important',
                  backgroundColor: 'rgba(55, 65, 81, 0.15)',
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '50px',
                  backdropFilter: 'blur(8px)'
                }}>
                  <button 
                    onClick={() => setFilterMode('all')}
                    className={`rounded-full font-medium transition-all duration-200 ${filterMode === 'all' ? 'bg-blue-600' : ''}`}
                    style={{ 
                      padding: '16px 32px !important',
                      fontSize: '18px !important',
                      backgroundColor: filterMode === 'all' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(55, 65, 81, 0.5)', 
                      border: filterMode === 'all' ? '2px solid rgba(59, 130, 246, 0.8)' : '2px solid rgba(75, 85, 99, 0.8)',
                      color: 'white',
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    All Notes
                  </button>
                  <button 
                    onClick={() => setFilterMode('domain')}
                    className={`rounded-full font-medium transition-all duration-200 ${filterMode === 'domain' ? 'bg-blue-600' : ''}`}
                    style={{ 
                      padding: '16px 32px !important',
                      fontSize: '18px !important',
                      backgroundColor: filterMode === 'domain' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(55, 65, 81, 0.2)', 
                      border: filterMode === 'domain' ? '2px solid rgba(59, 130, 246, 0.8)' : '1px solid rgba(75, 85, 99, 0.3)',
                      color: filterMode === 'domain' ? 'white' : 'rgb(156, 163, 175)',
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    By Domain
                  </button>
                  <button 
                    onClick={() => setFilterMode('site')}
                    className={`rounded-full font-medium transition-all duration-200 ${filterMode === 'site' ? 'bg-blue-600' : ''}`}
                    style={{ 
                      padding: '16px 32px !important',
                      fontSize: '18px !important',
                      backgroundColor: filterMode === 'site' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(55, 65, 81, 0.2)', 
                      border: filterMode === 'site' ? '2px solid rgba(59, 130, 246, 0.8)' : '1px solid rgba(75, 85, 99, 0.3)',
                      color: filterMode === 'site' ? 'white' : 'rgb(156, 163, 175)',
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    By Site
                  </button>
                </div>

                {/* Right Side - New Note Button */}
                <button className="rounded-full font-medium transition-all duration-200 flex items-center space-x-3" style={{ 
                  padding: '8px 16px !important',
                  fontSize: '12px !important',
                  background: 'linear-gradient(to right, rgb(59, 130, 246), rgb(37, 99, 235))', 
                  color: 'white',
                  border: '1px solid rgba(75, 85, 99, 0.5)'
                }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New Note</span>
                </button>
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filterMode === 'all' ? (
                // Show all notes in a simple list
                <div className="space-y-3">
                  {notes.map(note => renderNoteItem(note))}
                </div>
              ) : (
                // Show grouped notes
                renderGroupedNotes()
              )}
            </div>
          </div>

          {/* Right Side - Editor */}
          <NoteEditor
            selectedNote={selectedNote}
            onClose={handleNoteClose}
            onSave={handleNoteSave}
          />
        </main>
      </div>
    </div>
  )
}
