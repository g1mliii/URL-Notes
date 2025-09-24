---
inclusion: always
---

# Project Structure & Architecture

## File Organization Rules

### Critical Directories
- `/extension/` - Browser extension code (Manifest V3, vanilla JS)
- `/supabase/migrations/` - Database schema changes only
- `/supabase/functions/` - TypeScript Edge Functions
- Root files - Web app and configuration

### Module Separation (Strict)
- **popup.js** - Orchestrator only: initializes modules, routes actions
- **notes.js** - Note rendering, grouping, delete/archive UI
- **editor.js** - Editor lifecycle, content transforms, drafts
- **storage.js** - Data layer only, no DOM manipulation
- **settings.js** - Settings UI and preferences

### Library Layer (`/extension/lib/`)
- **storage.js** - IndexedDB wrapper for local persistence
- **sync.js** - Supabase cloud synchronization
- **encryption.js** - AES-256-GCM client-side encryption
- **api.js** - Supabase client wrapper
- **ads.js** - CodeFuel integration

## Code Standards

### JavaScript Patterns
- **No build system** - Direct browser execution only
- **Global modules** - Export via `window.ModuleName = {}`
- **Dependency injection** - Pass deps as parameters, avoid globals
- **Vanilla JS only** - No ES6 modules, maintain browser compatibility

### Data Flow (Mandatory)
```
User Action → popup.js → Module → storage.js → IndexedDB
                    ↓
Background: sync.js → api.js → Supabase (encrypted)
```

### Naming Conventions
- Extension modules: lowercase (notes.js, editor.js)
- Libraries: single-purpose lowercase (storage.js, sync.js)
- Documentation: UPPERCASE_WITH_UNDERSCORES.md

## Development Constraints

### Architecture Rules
- **Local-first** - IndexedDB is source of truth, cloud is sync only
- **Module isolation** - No cross-module DOM access
- **Manifest V3** - Service workers only, no background pages
- **Zero build** - Code runs directly in browser

### File Modification Policy
- Extension files: Modify freely for features
- Supabase migrations: Add new only, never edit existing
- Documentation: Read-only unless explicitly requested
- Config files: Supabase CLI dependencies only