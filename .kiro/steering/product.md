---
inclusion: always
---

# Product Conventions & Rules

URL Notes is a browser extension for domain/URL-specific note-taking with glassmorphism design and local-first architecture.

## Core Product Principles
- **Local-First**: All functionality must work offline; sync is enhancement, not requirement
- **Domain-Centric**: Notes organized by domain ("This Site") or specific URL ("This Page")
- **Zero-Knowledge**: Server never sees unencrypted content; client-side AES-256 encryption mandatory
- **Freemium Model**: Core features free with ads; premium removes ads and adds cloud sync

## User Interface Standards
- **Glassmorphism Design**: Use backdrop-blur, semi-transparent surfaces, subtle shadows
- **Popup-First UX**: Primary interface is 400x600px popup; optimize for this constraint
- **Keyboard Shortcuts**: Alt+E (open popup), Alt+N (new note) - preserve these bindings
- **Responsive Breakpoints**: Support popup (400px), tablet (768px), desktop (1024px+)

## Feature Boundaries
- **Free Tier Limits**: Local storage only, last 5 versions, CodeFuel ads, basic search
- **Premium Features**: Cloud sync, unlimited versions, global search, ad-free, web app access
- **Version History**: Always maintain chronological versions; never overwrite without backup

## Development Rules
- **No Build System**: Extension must load directly from /extension folder
- **Manifest V3**: Use service workers, not background pages; respect new permission model
- **IndexedDB First**: Primary storage is local; cloud is sync destination, not source
- **Modular Architecture**: Popup modules own specific domains (notes.js, editor.js, settings.js)

## Content Guidelines
- **Note Scope**: "This Site" = domain-level, "This Page" = URL-specific
- **Search Behavior**: Free users search current domain/page only; premium gets global search
- **Sync Conflicts**: Last-write-wins with version preservation; never lose user data
- **Ad Integration**: CodeFuel ads in free tier; respectful placement, not intrusive

## Technical Constraints
- **Browser Support**: Chrome, Brave, Edge (Chromium-based only)
- **Storage Limits**: IndexedDB quota management; warn users approaching limits
- **Encryption**: AES-256-GCM for all synced content; keys derived from user password
- **Performance**: Popup must load <200ms; search results <100ms for good UX