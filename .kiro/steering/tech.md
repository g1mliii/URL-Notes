---
inclusion: always
---

# Technology Stack & Development Guidelines

## Core Technology Constraints

### Browser Extension (Manifest V3 Only)
- **No Build System**: Extension must run directly from `/extension/` folder
- **Vanilla JavaScript**: No transpilation, ES6+ features only if supported in target browsers
- **IndexedDB Primary**: Local storage is source of truth, cloud sync is secondary
- **Service Workers**: Use background service workers, never background pages
- **Required Permissions**: storage, activeTab, tabs, alarms, contextMenus, identity, scripting

### Backend Infrastructure
- **Supabase Stack**: PostgreSQL with Row Level Security, Auth, Edge Functions, Real-time
- **TypeScript Edge Functions**: All serverless functions in `/supabase/functions/`
- **Client-Side Encryption**: AES-256-GCM mandatory for all synced content
- **Zero-Knowledge Architecture**: Server never accesses unencrypted user data

## Development Commands

### Database Operations
```bash
# Deploy schema changes
supabase db push

# Reset local development database
supabase db reset

# Generate TypeScript types from schema
supabase gen types typescript --local > types/database.ts
```

### Edge Functions
```bash
# Deploy all functions to production
supabase functions deploy

# Deploy specific function
supabase functions deploy sync-notes

# Local development server
supabase functions serve

# View production logs
supabase functions logs sync-notes
```

### Extension Development
- **No Build Required**: Load `/extension/` folder directly in Chrome
- **Chrome DevTools**: Use `chrome://extensions/` → "Load unpacked"
- **Hot Reload**: Manual refresh required after code changes

## Critical Architecture Rules

### Code Organization
- **Modular Popup**: Each module owns specific UI domains (notes.js, editor.js, settings.js)
- **Library Layer**: Pure functions in `/extension/lib/` with no DOM dependencies  
- **Global Modules**: Use `window.ModuleName = {}` pattern, no ES6 modules
- **Dependency Injection**: Pass dependencies as parameters, avoid global state

### Data Flow Patterns
```
User Action → popup.js → Module → storage.js → IndexedDB
                    ↓
Background Sync: sync.js → api.js → Supabase Edge Functions
```

### Performance Requirements
- **Popup Load**: <200ms initial render
- **Search Results**: <100ms for local queries
- **Offline First**: All core functionality must work without network

### Security Constraints
- **Client-Side Encryption**: All user content encrypted before leaving device
- **Key Derivation**: Use user password + salt for encryption keys
- **No Plaintext Storage**: Never store unencrypted content in cloud
- **Row Level Security**: Database policies enforce user data isolation

## Technology Decisions
- **No Framework**: Vanilla JS for minimal bundle size and direct browser compatibility
- **IndexedDB Over LocalStorage**: Handles large datasets and structured queries
- **Supabase Over Custom Backend**: Reduces infrastructure complexity
- **TypeScript for Edge Functions**: Type safety for server-side logic only