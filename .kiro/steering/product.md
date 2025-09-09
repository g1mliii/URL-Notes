---
inclusion: always
---

# Product Rules & Implementation Guidelines

URL Notes is a browser extension for domain/URL-specific note-taking with glassmorphism design and local-first architecture.

## Core Architecture Principles

### Local-First Data Flow
- All features MUST work offline; implement cloud sync as optional enhancement
- IndexedDB is source of truth; Supabase is sync destination only
- Never block UI on network operations; show cached data immediately

### Note Organization Model
- **"This Site" notes**: Stored by domain (e.g., `github.com`)
- **"This Page" notes**: Stored by full URL (e.g., `github.com/user/repo`)
- Always provide both scoping options in UI

### Zero-Knowledge Security
- Encrypt ALL user content with AES-256-GCM before cloud storage
- Derive encryption keys from user password + salt
- Server must never access plaintext content

## UI/UX Implementation Rules

### Glassmorphism Design System
- Use `backdrop-filter: blur(10px)` with `background: rgba(255,255,255,0.1)`
- Apply subtle `box-shadow: 0 8px 32px rgba(0,0,0,0.1)`
- Maintain semi-transparent surfaces throughout

### Popup Constraints
- Fixed dimensions: 400x600px - optimize all layouts for this size
- Load time target: <200ms from click to visible content
- Preserve keyboard shortcuts: Alt+E (popup), Alt+N (new note)

### Responsive Behavior
- Popup: 400px (primary interface)
- Tablet: 768px+ (web app access)
- Desktop: 1024px+ (full feature set)

## Feature Implementation Boundaries

### Free Tier Restrictions
- Local storage only (no cloud sync)
- Version history limited to last 5 versions
- Search scope limited to current domain/page
- Display CodeFuel ads (respectful placement)

### Premium Feature Gates
- Cloud sync with Supabase
- Unlimited version history
- Global search across all domains
- Ad-free experience
- Web app access

### Version Management
- Always preserve chronological versions before updates
- Never overwrite without creating backup version
- Implement last-write-wins for sync conflicts

## Development Implementation Rules

### File Organization
- Extension code ONLY in `/extension/` directory
- No build system - code must run directly in browser
- Use Manifest V3 service workers (never background pages)

### Data Access Patterns
- Primary: IndexedDB via `storage.js`
- Secondary: Supabase sync via `sync.js`
- Always check local first, sync in background

### Performance Requirements
- Popup initialization: <200ms
- Local search results: <100ms
- IndexedDB operations: <50ms for basic CRUD

### Browser Compatibility
- Target: Chrome, Brave, Edge (Chromium-based only)
- Use only features supported in Manifest V3
- Handle IndexedDB quota limits gracefully

## Content Handling Rules

### Search Implementation
- Free users: Search current domain/page only
- Premium users: Global search across all stored notes
- Always prioritize local results over cloud

### Sync Conflict Resolution
- Use last-write-wins strategy
- Preserve all versions in conflict scenarios
- Never lose user data - create conflict versions if needed

### Ad Integration Guidelines
- CodeFuel ads for free tier only
- Place ads respectfully (not intrusive to note-taking flow)
- Remove completely for premium users