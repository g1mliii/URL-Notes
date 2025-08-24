# Simplified Sync Framework Implementation

## Overview
This document summarizes the changes made to implement a simplified sync framework for URL Notes that:
- Only syncs latest versions (no version history)
- Implements local priority (local notes take precedence)
- Syncs every 5 minutes or on manual sync
- Tracks deletions for sync
- Restores versions as drafts instead of creating new versions

## Changes Made

### 1. Version History Behavior Changes

#### `extension/popup/modules/notes.js`
- **Modified `restoreVersion` method**: Now opens restored content as a draft instead of creating a new version
- **Draft properties**: Added `isDraft: true`, `draftSource`, and `draftTimestamp` to restored content
- **User notification**: Shows "Version restored as draft - save to keep changes" message

#### `extension/lib/storage.js`
- **Modified `saveNoteVersion` method**: Now only creates versions on manual save, not auto-save
- **Auto-save filtering**: Returns `null` for auto-save operations to prevent version creation
- **Change reason parameter**: Added `changeReason` parameter (defaults to 'manual_save')

### 2. Simplified Sync Engine

#### `extension/lib/sync.js`
- **Removed complex sync methods**: Eliminated `pushToCloud`, `pullFromCloud`, `mergeCloudNotes`, `handleConflict`, etc.
- **Simplified sync logic**: Single `performSync` method that handles all sync operations
- **5-minute sync interval**: Automatic sync every 5 minutes using `syncIntervalMs`
- **Local priority**: Only downloads missing notes from server, never overwrites local notes
- **Single API call**: One sync operation per sync cycle instead of multiple operations

#### Key Methods Added/Modified:
- `performSync()`: Main sync method that handles all operations
- `getLocalDeletions()`: Retrieves unsynced deletions from storage
- `startPeriodicSync()`: Starts 5-minute sync interval
- `manualSync()`: Triggers manual sync from settings

### 3. Deletion Tracking

#### `extension/lib/storage.js`
- **New IndexedDB store**: Added `deletions` store to track note deletions
- **Deletion tracking**: `trackNoteDeletion()` method records deletions for sync
- **Sync status**: `markDeletionsAsSynced()` marks deletions as synced after successful sync
- **Updated deleteNote**: Now tracks deletions when notes are deleted

#### New Methods:
- `trackNoteDeletion(noteId)`: Records deletion for sync
- `getUnsyncedDeletions()`: Retrieves unsynced deletions
- `markDeletionsAsSynced(deletionIds)`: Marks deletions as synced

### 4. Database Schema Simplification

#### `supabase/migrations/003_simplified_sync.sql`
- **Removed version tables**: Dropped `note_versions` and `note_sync_queue` tables
- **Simplified notes table**: Removed version tracking columns (`version`, `parent_version_id`, `sync_status`)
- **Added sync tracking**: New columns `last_synced_at` and `sync_pending`
- **New sync function**: `sync_notes_simple()` function for Edge Function to use
- **Local priority logic**: Database function only returns missing notes, implements local priority

### 5. Edge Function Simplification

#### `supabase/functions/sync-notes/index.ts`
- **Simplified operations**: Only handles `sync` operation (no more `pull`, `push`, `sync_versions`)
- **Single sync call**: Uses `sync_notes_simple` database function for all operations
- **Removed complex logic**: Eliminated conflict resolution, version sync, and complex merge logic

#### Removed:
- `resolve-conflict` Edge Function (no longer needed)
- Complex conflict detection and resolution
- Version history sync logic

### 6. Authentication Fixes

#### `extension/lib/storage.js` and `extension/lib/sync.js`
- **Fixed auth methods**: Updated to use correct custom Supabase client methods
- **Method mapping**: 
  - `window.supabaseClient.auth.getUser()` → `window.supabaseClient.isAuthenticated()`
  - Added proper error handling and logging

### 7. Version History Button Fix

#### `extension/popup/popup.js`
- **Added version history button**: Now shows in duplicate `createNoteElement` method
- **Global exposure**: Exposed `notesManager` globally for version history functionality
- **Premium status**: Button visibility based on premium status

## Benefits of Simplified Approach

### 1. **Performance Improvements**
- Single API call per sync instead of multiple operations
- No version history processing during sync
- Reduced database queries and complexity

### 2. **Simplified Conflict Resolution**
- Local priority eliminates most conflicts
- No complex merge logic needed
- Simpler error handling

### 3. **Reduced API Calls**
- Sync every 5 minutes instead of real-time
- Batch operations in single request
- Better rate limiting compliance

### 4. **Easier Maintenance**
- Simpler codebase with fewer edge cases
- Reduced database complexity
- Clearer sync flow

### 5. **Better User Experience**
- Version restore opens as draft (user can review before saving)
- Local changes are never lost
- Predictable sync behavior

## Sync Flow

### 1. **Automatic Sync (Every 5 minutes)**
```
User makes changes → Changes saved locally → 5-minute timer → Sync triggered
```

### 2. **Manual Sync**
```
User clicks sync button → Immediate sync → Success/error notification
```

### 3. **Sync Process**
```
1. Get local notes (latest versions only)
2. Get local deletions
3. Send to server (encrypted on server)
4. Receive missing notes from server
5. Add missing notes locally (local priority)
6. Mark deletions as synced
7. Update sync timestamp
```

### 4. **Local Priority Logic**
```
- Local notes are never overwritten by server
- Only notes that don't exist locally are downloaded
- Deletions are synced to server
- Server acts as backup, not authoritative source
```

## Migration Notes

### 1. **Database Changes**
- Run `003_simplified_sync.sql` migration
- Version history data will be lost (by design)
- Notes table structure simplified

### 2. **Extension Updates**
- Version history now only local (max 5 versions)
- Restore opens as draft instead of creating new version
- Sync happens every 5 minutes automatically

### 3. **Edge Function Updates**
- Deploy updated `sync-notes` function
- Remove `resolve-conflict` function
- Update any client code that calls old sync methods

## Future Considerations

### 1. **Encryption**
- Notes are encrypted on server during sync
- Local storage remains unencrypted for performance
- Consider client-side encryption for sensitive data

### 2. **Conflict Detection**
- Current approach uses local priority
- Could add simple timestamp-based conflict detection
- User notification for potential conflicts

### 3. **Sync Frequency**
- 5-minute interval is configurable
- Could add adaptive sync based on user activity
- Manual sync always available

### 4. **Version History**
- Local only, max 5 versions
- Could add cloud backup of versions (separate from sync)
- Version restore as draft provides better UX
