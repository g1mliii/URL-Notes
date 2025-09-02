'use client'

import { useState, useRef, useEffect } from 'react'

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
  const [currentColor, setCurrentColor] = useState('#000000')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showCitationDropdown, setShowCitationDropdown] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Load content into contenteditable when note changes
  useEffect(() => {
    if (contentRef.current && selectedNote) {
      contentRef.current.innerHTML = buildContentHtml(selectedNote.content || '')
    }
  }, [selectedNote])

  // Close citation dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-citation-container]')) {
        setShowCitationDropdown(false)
      }
    }

    if (showCitationDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCitationDropdown])

  // Convert markdown-style formatting to HTML
  const buildContentHtml = (content: string): string => {
    let text = content || ''
    
    // Convert formatting markers to HTML
    text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') // Bold
    text = text.replace(/__([^_]+)__/g, '<u>$1</u>') // Underline
    text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>') // Strikethrough
    text = text.replace(/\{color:([^}]+)\}([^{]*)\{\/color\}/g, '<span style="color:$1">$2</span>') // Color
    
    return text.replace(/\n/g, '<br>')
  }

  // Convert HTML back to markdown-style formatting
  const htmlToMarkdown = (html: string): string => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html || ''
    
    // Convert formatting tags to markdown-style markers
    tmp.querySelectorAll('b, strong').forEach(el => {
      const text = el.textContent
      el.replaceWith(document.createTextNode(`**${text}**`))
    })
    
    tmp.querySelectorAll('u').forEach(el => {
      const text = el.textContent
      el.replaceWith(document.createTextNode(`__${text}__`))
    })
    
    tmp.querySelectorAll('s, strike').forEach(el => {
      const text = el.textContent
      el.replaceWith(document.createTextNode(`~~${text}~~`))
    })
    
    tmp.querySelectorAll('span[style*="color"]').forEach(el => {
      const text = el.textContent
      const style = el.getAttribute('style') || ''
      const colorMatch = style.match(/color:\s*([^;]+)/)
      if (colorMatch) {
        const color = colorMatch[1].trim()
        el.replaceWith(document.createTextNode(`{color:${color}}${text}{/color}`))
      } else {
        el.replaceWith(document.createTextNode(text || ''))
      }
    })
    
    return tmp.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
  }

  // Formatting functions
  const toggleFormat = (command: string) => {
    if (contentRef.current) {
      contentRef.current.focus()
      document.execCommand(command, false)
    }
  }

  const applyColor = (color: string) => {
    if (contentRef.current) {
      contentRef.current.focus()
      document.execCommand('foreColor', false, color)
      setCurrentColor(color)
    }
  }

  const handleContentChange = () => {
    if (contentRef.current) {
      setContent(htmlToMarkdown(contentRef.current.innerHTML))
    }
  }

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

  // Citation generation functions
  const generateCitation = (format: string): string => {
    if (!selectedNote) return '';
    
    const noteTitle = title || 'Untitled Note';
    const url = selectedNote.url || '';
    const pageTitle = selectedNote.url || ''; // Assuming url contains page title info
    const domain = selectedNote.domain || '';
    const createdAt = new Date(selectedNote.created_at);
    const year = createdAt.getFullYear();
    const day = createdAt.getDate();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[createdAt.getMonth()];
    
    switch (format) {
      case 'apa':
        return `${pageTitle ? `${pageTitle}. ` : ''}(${year}, ${monthName} ${day}). ${noteTitle}. Retrieved from ${url}`;
      
      case 'mla':
        return `"${pageTitle || noteTitle}." ${domain}, ${day} ${monthName} ${year}, ${url}.`;
      
      case 'chicago':
        return `"${pageTitle || noteTitle}." ${domain}. Accessed ${monthName} ${day}, ${year}. ${url}.`;
      
      case 'harvard':
        return `${pageTitle || noteTitle} (${year}) ${domain}, viewed ${day} ${monthName} ${year}, <${url}>.`;
      
      case 'ieee':
        return `"${pageTitle || noteTitle}," ${domain}, ${monthName} ${day}, ${year}. [Online]. Available: ${url}`;
      
      default:
        return `${pageTitle || noteTitle} - ${url} (accessed ${monthName} ${day}, ${year})`;
    }
  };

  const insertCitationIntoEditor = (citation: string) => {
    if (!contentRef.current) return;
    
    contentRef.current.focus();
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Add line break before citation
      const brElement = document.createElement('br');
      range.insertNode(brElement);
      range.setStartAfter(brElement);
      
      // Create citation element with styling
      const citationElement = document.createElement('span');
      citationElement.textContent = citation;
      citationElement.style.fontStyle = 'italic';
      citationElement.style.color = '#9CA3AF'; // text-secondary equivalent
      range.insertNode(citationElement);
      
      // Move cursor after citation
      range.setStartAfter(citationElement);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Append to end if no selection
      const brElement = document.createElement('br');
      const citationElement = document.createElement('span');
      citationElement.textContent = citation;
      citationElement.style.fontStyle = 'italic';
      citationElement.style.color = '#9CA3AF';
      
      contentRef.current.appendChild(brElement);
      contentRef.current.appendChild(citationElement);
    }
    
    // Update content state
    handleContentChange();
  };

  const copyCitationToClipboard = async (citation: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(citation);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleCitationFormat = async (format: string) => {
    const citation = generateCitation(format);
    if (!citation) return;
    
    // Insert citation into editor
    insertCitationIntoEditor(citation);
    
    // Copy to clipboard
    await copyCitationToClipboard(citation);
    
    // Close dropdown
    setShowCitationDropdown(false);
    
    // Could add a toast notification here if needed
    console.log(`${format.toUpperCase()} citation added and copied to clipboard`);
  };

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

      {/* Formatting Toolbar */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '8px', borderRight: '1px solid rgba(75, 85, 99, 0.3)' }}>
          <button
            onClick={() => toggleFormat('bold')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'rgba(156, 163, 175, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'rgba(156, 163, 175, 0.7)'
            }}
            title="Bold"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            </svg>
          </button>
          
          <button
            onClick={() => toggleFormat('underline')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'rgba(156, 163, 175, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'rgba(156, 163, 175, 0.7)'
            }}
            title="Underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
              <line x1="4" y1="21" x2="20" y2="21"></line>
            </svg>
          </button>
          
          <button
            onClick={() => toggleFormat('strikeThrough')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'rgba(156, 163, 175, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'rgba(156, 163, 175, 0.7)'
            }}
            title="Strikethrough"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 16c0 2.2 1.8 4 4 4s4-1.8 4-4"></path>
              <path d="M6 8c0-2.2 1.8-4 4-4s4 1.8 4 4"></path>
              <line x1="4" y1="12" x2="20" y2="12"></line>
            </svg>
          </button>
        </div>
        
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }} data-citation-container>
          {/* Citation Button */}
          <button
            onClick={() => setShowCitationDropdown(!showCitationDropdown)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'rgba(156, 163, 175, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'rgba(156, 163, 175, 0.7)'
            }}
            title="Add Citation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 15V9a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H8l-4-4z"></path>
              <path d="M8 9v6"></path>
              <path d="M16 9v6"></path>
            </svg>
            <div style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(75, 85, 99, 0.8)',
              border: '1px solid rgba(156, 163, 175, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </div>
          </button>
          
          {/* Citation Dropdown */}
          {showCitationDropdown && (
            <div style={{
              position: 'absolute',
              top: '40px',
              right: '0',
              backgroundColor: 'rgba(31, 41, 55, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.3)',
              borderRadius: '12px',
              padding: '8px',
              zIndex: 1000,
              minWidth: '180px',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(75, 85, 99, 0.3)', marginBottom: '8px' }}>
                <h5 style={{ margin: 0, color: 'white', fontSize: '14px', fontWeight: 600 }}>Generate Citation</h5>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  { format: 'apa', label: 'APA Style' },
                  { format: 'mla', label: 'MLA Style' },
                  { format: 'chicago', label: 'Chicago Style' },
                  { format: 'harvard', label: 'Harvard Style' },
                  { format: 'ieee', label: 'IEEE Style' }
                ].map(({ format, label }) => (
                  <button
                    key={format}
                    onClick={() => handleCitationFormat(format)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(75, 85, 99, 0.2)',
                      border: '1px solid rgba(75, 85, 99, 0.3)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)'
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.3)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              width: '36px',
              height: '32px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'rgba(156, 163, 175, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.4)'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'rgba(156, 163, 175, 0.7)'
            }}
            title="Text Color"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l8 8-8 8H4V11z"></path>
              <rect x="2" y="19" width="20" height="2" fill="currentColor"></rect>
            </svg>
            <div style={{
              width: '20px',
              height: '3px',
              borderRadius: '1px',
              border: '1px solid rgba(75, 85, 99, 0.3)',
              backgroundColor: currentColor,
              position: 'absolute',
              bottom: '4px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}></div>
          </button>
          
          {showColorPicker && (
            <div style={{
              position: 'absolute',
              top: '40px',
              right: '0',
              backgroundColor: 'rgba(31, 41, 55, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              zIndex: 1000,
              minWidth: '180px'
            }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {['#000000', '#ffffff', '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'].map(color => (
                  <div
                    key={color}
                    onClick={() => {
                      applyColor(color)
                      setShowColorPicker(false)
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      backgroundColor: color,
                      cursor: 'pointer',
                      border: '2px solid rgba(75, 85, 99, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgb(59, 130, 246)'
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.3)'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(75, 85, 99, 0.3)' }}>
                <label style={{ fontSize: '12px', color: 'rgba(156, 163, 175, 0.7)', fontWeight: '500' }}>Custom:</label>
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => {
                    applyColor(e.target.value)
                    setShowColorPicker(false)
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: 'transparent'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 p-6">
        <div
          ref={contentRef}
          contentEditable
          onInput={handleContentChange}
          className="w-full h-full bg-transparent border-none outline-none resize-none text-lg leading-relaxed"
          style={{ 
            color: 'white',
            minHeight: '200px'
          }}
          data-placeholder="Start writing your note..."
        />
      </div>

      {/* Editor Footer */}
      <div className="p-10 border-t" style={{ borderColor: 'rgba(75, 85, 99, 0.3)' }}>
        <div className="flex items-center justify-between">
          <div className="text-lg" style={{ color: 'rgb(156, 163, 175)' }}>
            Last updated: {new Date(selectedNote.updated_at).toLocaleString()}
          </div>
          <div className="text-lg" style={{ color: 'rgb(156, 163, 175)' }}>
            {contentRef.current?.textContent?.length || content.length} characters
          </div>
        </div>
      </div>
    </div>
  )
}
