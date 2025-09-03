# Technology Stack

## Browser Extension (Manifest V3)
- **Framework**: Vanilla JavaScript (no build system required)
- **Storage**: IndexedDB for local notes and file attachments
- **Architecture**: Service worker background script, content scripts, popup UI
- **Permissions**: storage, activeTab, tabs, alarms, contextMenus, identity, scripting

## Backend Infrastructure
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth (email, Google, GitHub)
- **Edge Functions**: TypeScript-based serverless functions for sync operations
- **Real-time**: Supabase real-time subscriptions for live sync
- **Security**: Client-side AES-256 encryption, zero-knowledge architecture

## Development Dependencies
- **Supabase CLI**: For database migrations and edge function deployment
- **Node.js**: Only for development tooling (not required for extension build)

## Common Commands

### Database Operations
```bash
# Deploy database migrations
supabase db push

# Reset local database
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > types/database.ts
```

### Edge Functions
```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy sync-notes

# View function logs
supabase functions logs sync-notes
```

### Extension Development
```bash
# No build step required - load extension directly from /extension folder
# Chrome: chrome://extensions/ -> Load unpacked -> select /extension folder
```

### Testing
```bash
# Run database tests
supabase test db

# Test edge functions locally
supabase functions serve
```

## Architecture Patterns
- **Local-First**: All functionality works offline, sync when available
- **Modular Popup**: Orchestrator pattern with separate modules for notes, editor, settings
- **Event-Driven Sync**: Background sync with conflict resolution
- **Zero-Knowledge**: Server never sees unencrypted content