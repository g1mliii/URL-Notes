---
inclusion: always
---

# Technology Stack & Development Guidelines

## Critical Constraints (NEVER VIOLATE)

### Browser Extension Architecture
- **Manifest V3 Only**: Service workers required, no background pages
- **No Build System**: Code runs directly from `/extension/` - no transpilation/bundling
- **Vanilla JavaScript**: ES6+ only if universally supported, no frameworks
- **Global Module Pattern**: Export via `window.ModuleName = {}`, no ES6 modules
- **Required Permissions**: storage, activeTab, tabs, alarms, contextMenus, identity, scripting

### Data Architecture
- **Local-First**: IndexedDB is source of truth, Supabase is sync destination only
- **Offline-First**: All core functionality must work without network
- **Client-Side Encryption**: AES-256-GCM mandatory before any cloud storage
- **Zero-Knowledge**: Server never accesses unencrypted user data

## Code Organization Rules

### Module Responsibilities
- **popup.js**: Orchestrator only - initializes modules, routes actions
- **notes.js**: Note rendering, grouping, delete/archive UI
- **editor.js**: Editor lifecycle, content transforms, drafts
- **storage.js**: Data layer only, no DOM manipulation
- **settings.js**: Settings UI and preferences

### Library Layer (`/extension/lib/`)
- **Pure functions only**: No DOM dependencies or side effects
- **Dependency injection**: Pass deps as parameters, avoid globals
- **Single responsibility**: Each file handles one concern

### Mandatory Data Flow
```
User Action → popup.js → Module → storage.js → IndexedDB
                    ↓
Background: sync.js → api.js → Supabase (encrypted)
```

## Performance Requirements
- **Popup Load**: <200ms initial render
- **Local Search**: <100ms for IndexedDB queries
- **Non-blocking UI**: Never block interface on network operations

## Backend Stack
- **Supabase**: PostgreSQL + Row Level Security + Auth + Edge Functions
- **TypeScript Edge Functions**: All serverless code in `/supabase/functions/`
- **Database Migrations**: Add new only, never edit existing migrations

## Development Commands
```bash
# Database operations
supabase db push                    # Deploy schema changes
supabase db reset                   # Reset local database
supabase gen types typescript --local > types/database.ts

# Edge Functions
supabase functions deploy           # Deploy all functions
supabase functions serve           # Local development
supabase functions logs <name>     # View production logs

# Extension testing
# Load /extension/ folder in chrome://extensions/ → "Load unpacked"
```

## Security Requirements
- **Encryption**: All user content encrypted before leaving device
- **Key Management**: Derive from user password + salt, never store plaintext keys
- **Row Level Security**: Database policies enforce user isolation
- **No Plaintext Cloud Storage**: Encrypted data only in Supabase