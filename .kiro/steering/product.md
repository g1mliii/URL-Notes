---
inclusion: always
---

# Product Implementation Guidelines

URL Notes is a browser extension for domain/URL-specific note-taking with glassmorphism design and local-first architecture.

## Critical Architecture Rules

### Local-First Data Flow (MANDATORY)
- **Offline-first**: All features MUST work without network connection
- **IndexedDB primary**: Local storage is source of truth, Supabase is sync destination only
- **Non-blocking UI**: Never block interface on network operations, show cached data immediately
- **Background sync**: Cloud operations happen asynchronously after local operations complete

### Note Storage Model
- **Domain notes**: Store by domain only (`github.com`) for site-wide notes
- **Page notes**: Store by full URL (`github.com/user/repo`) for page-specific notes
- **Dual scoping**: Always provide both "This Site" and "This Page" options in UI
- **URL normalization**: Strip query parameters and fragments for consistent storage keys

### Security Requirements
- **Client-side encryption**: AES-256-GCM encryption before any cloud storage
- **Key derivation**: Use user password + salt, never store keys in plaintext
- **Zero-knowledge**: Server must never access unencrypted user content
- **Local encryption**: Encrypt sensitive data in IndexedDB for additional security

## UI/UX Implementation Standards

### Glassmorphism Design System
```css
/* Required glassmorphism properties */
backdrop-filter: blur(10px);
background: rgba(255,255,255,0.1);
box-shadow: 0 8px 32px rgba(0,0,0,0.1);
border: 1px solid rgba(255,255,255,0.2);
```

### Popup Specifications
- **Fixed size**: 400x600px (never change dimensions)
- **Performance target**: <200ms from click to visible content
- **Keyboard shortcuts**: Alt+E (toggle popup), Alt+N (new note)
- **Responsive breakpoints**: 400px (popup), 768px+ (tablet), 1024px+ (desktop)

## Feature Tier Implementation

### Free Tier Constraints
- Local storage only (no cloud sync)
- Version history: maximum 5 versions per note
- Search scope: current domain/page only
- CodeFuel ads: display respectfully, non-intrusive placement

### Premium Features
- Cloud sync with Supabase
- Unlimited version history
- Global search across all domains
- Ad-free experience
- Web app access

## Data Management Rules

### Version Control
- **Always backup**: Create version before any update operation
- **Chronological order**: Preserve creation timestamps for all versions
- **Conflict resolution**: Last-write-wins strategy with conflict version creation
- **Never lose data**: Create conflict copies rather than overwriting

### Performance Targets
- Popup initialization: <200ms
- Local search results: <100ms
- IndexedDB CRUD operations: <50ms
- Background sync: non-blocking, user-invisible

### Search Implementation
- **Free users**: Domain/page scope only
- **Premium users**: Global search across all stored notes
- **Priority order**: Local results first, then cloud results
- **Fuzzy matching**: Support partial text matching for better UX

## Development Constraints

### Browser Extension Requirements
- **Manifest V3 only**: Use service workers, never background pages
- **No build system**: Code must run directly in browser without transpilation
- **Extension directory**: All extension code in `/extension/` folder only
- **Browser support**: Chrome, Brave, Edge (Chromium-based browsers only)

### Data Access Pattern
```
User Action → popup.js → Module → storage.js → IndexedDB
                    ↓
Background: sync.js → api.js → Supabase (encrypted)
```

### Error Handling
- **Graceful degradation**: Handle IndexedDB quota limits
- **Network failures**: Continue working offline, queue sync operations
- **Encryption errors**: Never expose plaintext, fail securely
- **User feedback**: Show clear error messages for user-actionable issues