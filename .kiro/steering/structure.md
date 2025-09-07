---
inclusion: always
---

# Project Structure & Architecture Rules

## Critical File Locations
- **Extension code**: `/extension/` - Never modify files outside this directory for extension functionality
- **Database**: `/supabase/migrations/` - Schema changes only through migrations
- **Edge functions**: `/supabase/functions/` - TypeScript serverless functions
- **Documentation**: `/guide files/` - Read-only specifications and guides

## Module Architecture (Strict Separation)

### Popup Module Responsibilities
- **popup.js**: Orchestrator ONLY - initializes modules, routes actions, manages view state
- **notes.js**: Owns ALL note rendering, grouping, destructive UI (delete, archive)
- **editor.js**: Owns editor lifecycle, content transforms, draft persistence
- **storage.js**: Data access layer - NO DOM manipulation, pure data operations
- **settings.js**: Settings UI and preferences management

### Library Layer (`/extension/lib/`)
- **storage.js**: IndexedDB wrapper - handles all local data persistence
- **sync.js**: Cloud sync engine - manages Supabase synchronization
- **encryption.js**: Client-side AES-256 encryption for zero-knowledge architecture
- **api.js**: Supabase client wrapper
- **ads.js**: CodeFuel integration for free tier

## Code Organization Rules

### File Naming Conventions
- **Extension modules**: Lowercase descriptive names (notes.js, editor.js)
- **Libraries**: Single-purpose lowercase (storage.js, sync.js)
- **Documentation**: UPPERCASE_WITH_UNDERSCORES.md

### Import/Export Patterns
- **NO build system**: Use direct script tags in manifest.json
- **Global module pattern**: Each module exports via `window.ModuleName = {}`
- **Dependency injection**: Pass dependencies as function parameters
- **No ES6 modules**: Use vanilla JavaScript for browser compatibility

### Data Flow Architecture
```
User Action → popup.js → Module → storage.js → IndexedDB
                    ↓
            Background sync: sync.js → api.js → Supabase
```

## Development Constraints
- **Manifest V3 only**: Use service workers, not background pages
- **No transpilation**: Code must run directly in browser
- **IndexedDB first**: Local storage is primary, cloud is sync destination
- **Modular popup**: Each module owns specific UI domains, no cross-module DOM access

## File Modification Guidelines
- **Extension files**: Modify freely for feature development
- **Supabase migrations**: Only add new migrations, never edit existing ones
- **Documentation**: Read for context, update only when explicitly requested
- **Config files**: Modify package.json only for Supabase CLI dependencies