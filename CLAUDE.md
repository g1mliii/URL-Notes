# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anchored** (formerly URL Notes) is a browser extension and web app for domain/URL-specific note-taking with zero-knowledge encryption. The project features a glassmorphism ocean-themed UI, local-first architecture with cloud sync, and a $2.50/month premium tier.

- Live Web App: https://anchored.site
- Chrome Extension: https://chromewebstore.google.com/detail/anchored
- Tech Stack: Vanilla JS (no build system), IndexedDB, Supabase, Manifest V3

## Development Commands

### Supabase Backend
```bash
supabase start                                      # Start local Supabase
supabase db push                                    # Deploy schema changes
supabase db reset                                   # Reset local database
supabase gen types typescript --local > types/database.ts
supabase functions deploy                           # Deploy all Edge Functions
supabase functions serve                            # Local development
supabase functions logs <name>                      # View production logs
```

### Extension Development
```bash
# Load /extension/ folder in chrome://extensions/ → "Load unpacked"
# No build system - code runs directly in browser
```

### Cache Management
```bash
npm run cache:bust                                  # Update cache version
npm run cache:deploy                                # Deploy with cache bust
npm run cache:deploy:commit                         # Deploy and commit
```

## Critical Architecture Constraints

### MANDATORY Rules - Never Violate

#### Local-First Data Flow
- **Offline-first**: ALL features MUST work without network connection
- **IndexedDB is source of truth**: Supabase is sync destination only
- **Non-blocking UI**: Never block interface on network operations
- **Background sync**: Cloud operations happen asynchronously after local operations complete

#### Browser Extension Requirements
- **Manifest V3 only**: Use service workers, never background pages
- **No build system**: Code must run directly in browser without transpilation
- **Extension directory**: All extension code in `/extension/` folder only
- **Global module pattern**: Export via `window.ModuleName = {}`, no ES6 modules
- **Vanilla JavaScript**: ES6+ only if universally supported, no frameworks

#### Security Requirements
- **Client-side encryption**: AES-256-GCM encryption before any cloud storage
- **Key derivation**: Use user password + salt, never store keys in plaintext
- **Zero-knowledge**: Server must never access unencrypted user content
- **XSS protection**: Sanitize all user input using DOMPurify before rendering

#### Note Storage Model
- **Domain notes**: Store by domain only (`github.com`) for site-wide notes
- **Page notes**: Store by full URL (`github.com/user/repo`) for page-specific notes
- **Dual scoping**: Always provide both "This Site" and "This Page" options in UI
- **URL normalization**: Strip query parameters and fragments for consistent storage keys

## Code Organization

### Mandatory Data Flow Pattern
```
User Action → popup.js → Module → storage.js → IndexedDB
                    ↓
Background: sync.js → api.js → Supabase (encrypted)
```

### Module Responsibilities (Strict Separation)
- **popup.js**: Orchestrator only - initializes modules, routes actions (no business logic)
- **notes.js**: Note rendering, grouping, delete/archive UI
- **editor.js**: Editor lifecycle, content transforms, drafts
- **storage.js**: Data layer only, no DOM manipulation
- **settings.js**: Settings UI and preferences

### Library Layer (`/extension/lib/`)
- **storage.js**: IndexedDB wrapper for local persistence
- **sync.js**: Supabase cloud synchronization
- **encryption.js**: AES-256-GCM client-side encryption
- **api.js**: Supabase client wrapper
- **ads.js**: CodeFuel integration for free tier

### File Modification Policy
- **Extension files**: Modify freely for features
- **Supabase migrations**: Add new migrations only, never edit existing
- **Documentation files**: Read-only unless explicitly requested
- **Config files**: Supabase CLI dependencies only

## UI/UX Standards

### Glassmorphism Design System
All UI components must use ocean-themed glassmorphism:
```css
backdrop-filter: blur(10px);
background: rgba(255,255,255,0.1);
box-shadow: 0 8px 32px rgba(0,0,0,0.1);
border: 1px solid rgba(255,255,255,0.2);
```

### Color Palette
- Deep Ocean Blues: `#1B4F72`, `#2E86AB` (depth and stability)
- Aqua Accents: `#A8DADC`, `#457B9D` (highlights)
- Glass Surfaces: Translucent panels with ocean-blue backdrop blur

### Popup Specifications
- **Fixed size**: 400x600px (never change dimensions)
- **Performance target**: <200ms from click to visible content
- **Keyboard shortcuts**: Alt+E (toggle popup), Alt+N (new note)

## Performance Targets

- Popup initialization: <200ms
- Local search results: <100ms
- IndexedDB CRUD operations: <50ms
- Background sync: non-blocking, user-invisible
- Global search (premium): <500ms for up to 10,000 notes

## Feature Tiers

### Free Tier
- Local storage only (no cloud sync)
- Version history: maximum 5 versions per note
- Search scope: current domain/page only
- Tags: maximum 5 per note
- CodeFuel ads displayed respectfully

### Premium Tier ($2.50/month)
- Cloud sync with Supabase
- Unlimited version history
- Global search across all domains
- Unlimited tags per note
- Ad-free experience
- Web app access
- Advanced export formats (PDF, Word, Markdown, HTML, JSON)

## Data Management

### Version Control Rules
- **Always backup**: Create version before any update operation
- **Chronological order**: Preserve creation timestamps for all versions
- **Conflict resolution**: Last-write-wins strategy with conflict version creation
- **Never lose data**: Create conflict copies rather than overwriting

### Error Handling
- **Graceful degradation**: Handle IndexedDB quota limits
- **Network failures**: Continue working offline, queue sync operations
- **Encryption errors**: Never expose plaintext, fail securely
- **User feedback**: Show clear error messages for user-actionable issues

## Premium Features Implementation

### Current Premium Features in Development
Located in `.kiro/specs/premium-features/`:

1. **Global Search Engine** - Cross-domain search with filters
2. **Note Linking System** - Bidirectional `[[Note Title]]` links
3. **Citation Manager** - Academic citations (APA, MLA, Chicago, Harvard, IEEE)
4. **Smart Collections** - Rule-based automatic categorization
5. **Unlimited Version History** - Full revision tracking
6. **Advanced Export** - Multiple formats with metadata preservation
7. **Note Sharing** - Secure share links with read-only access
8. **File Attachments** - Encrypted file storage (10MB limit per file)
9. **Voice Notes** - Recording and transcription
10. **Unlimited Tags** - No tag limits for premium users

### Premium Feature Requirements
All premium features must:
- Check subscription status before access
- Display upgrade prompts for free users
- Work offline where applicable
- Encrypt sensitive data before cloud storage
- Use browser APIs (not Chrome-specific)
- Sanitize all user input to prevent XSS
- Implement graceful degradation
- Maintain local-first architecture

## Browser Compatibility

- **Chrome** 90+ (Primary target)
- **Brave** (Chromium-based, compatible)
- **Microsoft Edge** 90+ (Chromium-based, compatible)
- **Firefox** - Separate build in `/extension-firefox/`
- **Edge** - Separate build in `/extension-edge/`

### Cross-Browser API Usage
Use `browser.*` APIs instead of `chrome.*` where possible for cross-browser compatibility:
```javascript
// Good
const tabs = await browser.tabs.query({ active: true });

// Avoid (Chrome-specific)
const tabs = await chrome.tabs.query({ active: true });
```

## Security Best Practices

### XSS Protection Strategy
1. **Input Sanitization**: All user input sanitized using DOMPurify
2. **Content Security Policy**: Strict CSP headers in manifest.json
3. **Safe DOM Manipulation**: Use safe DOM utilities for HTML insertion
4. **Link Validation**: All note links validated before rendering
5. **Metadata Validation**: Citation metadata sanitized before storage

### Encryption Flow
```javascript
// Encrypt before cloud storage
const encrypted = await window.noteEncryption.encryptData(data, userKey);

// Decrypt after retrieval
const decrypted = await window.noteEncryption.decryptData(encrypted, userKey);
```

## Common Pitfalls to Avoid

1. **Don't add build systems**: Code runs directly in browser
2. **Don't use ES6 modules**: Use global `window.ModuleName` pattern
3. **Don't block UI on network**: Always show cached data immediately
4. **Don't store unencrypted data in cloud**: Encrypt first
5. **Don't modify existing migrations**: Add new migrations only
6. **Don't change popup dimensions**: Fixed at 400x600px
7. **Don't skip XSS sanitization**: Always sanitize user input
8. **Don't use Chrome-specific APIs**: Use browser.* for cross-browser compatibility
9. **Don't break local-first flow**: IndexedDB is always source of truth
10. **Don't add frameworks**: Vanilla JS only

## Development Workflow

1. **Make changes in `/extension/`**: All extension code goes here
2. **Test locally**: Load unpacked extension in chrome://extensions/
3. **Database changes**: Add new migration in `/supabase/migrations/`
4. **Edge Functions**: TypeScript code in `/supabase/functions/`
5. **Deploy database**: `supabase db push`
6. **Deploy functions**: `supabase functions deploy`

## Project Structure

```
/extension/              # Browser extension (Manifest V3)
  /popup/               # Popup UI and modules
    popup.js            # Main orchestrator
    /modules/           # Feature modules (notes, editor, settings)
    /css/              # Glassmorphism styles
  /lib/                # Pure functions, no DOM dependencies
    storage.js         # IndexedDB wrapper
    sync.js            # Supabase sync
    encryption.js      # AES-256-GCM encryption
    api.js             # Supabase client
  manifest.json        # Extension configuration
/supabase/             # Backend infrastructure
  /migrations/         # Database schema (add new only)
  /functions/          # TypeScript Edge Functions
/docs/                 # Documentation
/.kiro/                # Amazon Kiro steering files
  /steering/           # Product, structure, tech guidelines
  /specs/             # Feature requirements and design
```

## Testing Premium Features

### Premium Feature Checklist
- [ ] Feature properly gated behind subscription check
- [ ] Graceful degradation for free users
- [ ] Upgrade prompts are clear and actionable
- [ ] Feature works offline (where applicable)
- [ ] Data syncs correctly to cloud
- [ ] XSS protection is effective
- [ ] Performance impact is minimal
- [ ] Cross-browser compatibility verified

## Additional Context

- **Repository**: https://github.com/g1mliii/URL-Notes
- **Support**: support@anchored.site
- **License**: Proprietary (UNLICENSED)
- **Pricing**: Free tier + $2.50/month premium
- **Backend**: Supabase (PostgreSQL + Row Level Security + Auth)
- **Encryption**: Zero-knowledge architecture with client-side AES-256-GCM
