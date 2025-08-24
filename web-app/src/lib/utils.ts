import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    let domain = urlObj.hostname.toLowerCase()
    
    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.slice(4)
    }
    
    return domain
  } catch {
    return url
  }
}

/**
 * Normalize page key for consistent URL comparison
 */
export function normalizePageKey(url: string): string {
  try {
    const urlObj = new URL(url)
    let host = urlObj.hostname.toLowerCase()
    
    // Remove www. prefix
    if (host.startsWith('www.')) {
      host = host.slice(4)
    }
    
    // Remove trailing slash
    let path = urlObj.pathname
    if (path.endsWith('/') && path !== '/') {
      path = path.slice(0, -1)
    }
    
    // Remove hash and search params
    return `${host}${path}`
  } catch {
    return url
  }
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInHours = (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 24) {
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60)
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`
    }
    return `${Math.floor(diffInHours)}h ago`
  } else if (diffInHours < 48) {
    return 'Yesterday'
  } else if (diffInHours < 168) { // 7 days
    return dateObj.toLocaleDateString('en-US', { weekday: 'long' })
  } else {
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      ...options
    })
  }
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

/**
 * Generate note title from content
 */
export function generateNoteTitle(content: string, maxLength: number = 50): string {
  const lines = content.split('\n').filter(line => line.trim())
  const firstLine = lines[0] || ''
  
  if (firstLine.length <= maxLength) {
    return firstLine || 'Untitled Note'
  }
  
  return truncateText(firstLine, maxLength)
}

/**
 * Extract tags from content (lines starting with #)
 */
export function extractTagsFromContent(content: string): string[] {
  const lines = content.split('\n')
  const tags: string[] = []
  
  lines.forEach(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) {
      const tag = trimmed.slice(1).trim()
      if (tag && !tags.includes(tag)) {
        tags.push(tag)
      }
    }
  })
  
  return tags
}

/**
 * Calculate reading time for content
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  return Math.ceil(words / wordsPerMinute)
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * Check if user is on mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Get initials from name or email
 */
export function getInitials(name: string): string {
  if (!name) return '?'
  
  const parts = name.split(/[\s@]/)
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
}
