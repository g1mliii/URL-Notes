# URL Notes Extension - Complete Project Specification

## Overview
A browser extension and web application for taking notes on websites, with domain/URL-specific organization, local-first storage, and premium cloud sync features.

### Recent Changes (Aug 20, 2025)
- Popup onboarding moved inline via iframe inside Settings with a Back action. `#onboardingPanel` and iframe styled to fit exactly with no internal scrollbars.
- Header domain/URL visibility refined: larger legible sizes, reduced right padding reserve, domain fully visible while only URL truncates with ellipsis.
- Compact mode tweaks across header and shortcut hints for tighter vertical usage.
- Keyboard shortcuts: Open Popup now Alt+E; New Note remains Alt+N (default). UI reflects hints compactly.
- Help icon added in header with tooltip that lists quick tips/hidden features.
- Settings re-ordered: Font Settings above Help & Onboarding; added button to open Onboarding anytime.
- Domain display simplified by stripping leading `www.` in header.

Updates (Aug 19, 2025)
- Implemented hybrid notes model: notes saved under domain with URL context; filter between "All Notes" and "This Page".
- UI/UX improvements in `extension/popup/`:
  - Note title moved to editor header; compact save button.
  - Obsidian-like editor behavior (monospace, Tab inserts spaces, auto-indent, list continuation).
  - Page indicator badge with tooltip for current page notes.
  - Notes list scrolling with custom scrollbar; spacing reduced.
  - Safe delete button per note: hidden until hover; shows confirm; doesn’t trigger open.
- Header/search spacing tightened for iOS-like compact top bar.
- New Note button hover/background glow now derived from `--accent-*` variables (no hardcoded blue).
- Removed copy-to-clipboard UI beside URL to keep header minimal.
- Added uninstall notice flow (see "Uninstall Notice & Persistence Plan").
  Updates on Aug 18 (later session):
  - Settings panel readability improvements in light mode (reduced transparency, clearer borders/shadows).
    - CSS: `extension/popup/popup.css` light-mode overrides for `.settings-panel`.
  - All Notes live-refresh on storage changes.
    - JS: `extension/popup/popup.js` added `setupStorageChangeListener()` and cache invalidation.
    - Force-refresh All Notes cache after save/delete when `viewMode === 'all'`.
  - Two-tap delete on the same trash icon for notes (no inline confirm box). Non-blocking, consistent in All Notes and Site/Page views.
  - CSS: `.note-delete-btn.confirm` visual state; auto-disarms ~1.6s. JS: `handleTwoTapDelete()` used by per-note delete handlers.
  - Domain deletion synchronized across views and caches (removes domain keys and collapse states, refreshes UI).
  - Tag chip sizing/line-height adjusted to prevent clipping in All Notes.

  Final polish (Aug 19):
  - Domain bulk delete confirm renders inside the domain header's `.domain-actions` container (prevents layout jump and keeps context).
  - Note date pinned to the far right; right edge aligns with the end of the tag box (shared right inset).
  - Trash icon positioned to the left of the date with tight spacing; consistent across All, Site, and Page views.
  - Tags appear only on the right as overlay chips; no left-side tags.
  - Domain delete button is smaller, pinned top-right above tags; domain tags do not overlap.
  - Removed the "Created …" line from the middle of the note editor to avoid clutter.
  - View-specific compact styles applied for "This Page" and "This Site" via `:root[data-view="page|site"]` selectors (reduced paddings, tighter headers, slimmer tags).
  - Dynamic search placeholder reflects active view: "Search All Notes" / "Search This Site" / "Search This Page".
  - Conditional search clear after deletions: if a delete leaves 0 matches for the current query, automatically clear the search and re-render.
  - All Notes per-note delete fixed by rendering note cards as DOM nodes (not HTML strings) to preserve event handlers.
  - This Page filter now groups notes by normalized page identity (ignores hash/fragments and tracking params; host lowercased without `www.`, trailing slash removed). See popup `normalizePageKey()`.
  - Link highlight behavior reverted to stable retry-based messaging (no `tabs.onUpdated` listener, no content-ready handshake); new tabs include `#:~:text=` when possible; content script performs timed/mutation-observer retries.

  Popup maintenance (Aug 18, later-later):
  - Dark mode text contrast fixes across popup: enforce light text for inputs, headers, buttons, and placeholders on dark backgrounds.
  - Settings initialization cleanup to prevent duplicate listeners:
    - `init()` calls `initSettings()` once.
    - `settingsBtn` now only calls `openSettings()` (no re-initialization on each click).
    - Export/Import listeners are registered only in `setupEventListeners()`.
  - Font preferences use `chrome.storage.local` consistently (read/write) for `editorFont` and `editorFontSize`.
  - Removed duplicated `.save-btn` CSS block from `extension/popup/popup.css`.

  UI copy and controls updates (Aug 18, later):
  - Font controls removed from inline editor, restored to Settings panel.
  - Default font label is now "Default" (system stack). "Font Family" label simplified to "Font".
  - Font size slider track/thumb made more visible in light mode.
  - Added live preview inside Settings showing current font and size.
  - Behavior change: font changes no longer apply live while Settings is open; they apply when closing Settings.

  Platform/UX updates (Aug 18, later):
  - Attempted Side Panel-based persistent UI; reverted to classic popup-first UX for broader browser compatibility (Brave/older Chrome fall back).
  - Restored `action.default_popup: popup/popup.html` in `extension/manifest.json`.
  - Removed Side Panel code paths from `extension/background/background.js` to reduce dormant code.
  - Improved link-opening reliability and on-page highlighting:
    - Tab reuse via URL normalization (strip `www.`, trailing slashes, and common tracking params like `utm_*`, `gclid`, `fbclid`).
    - First-load highlighting uses retry-based `chrome.tabs.sendMessage` scheduling; no `tabs.onUpdated` listener and no readiness handshake. New tabs attempt native text fragment (`#:~:text=`) and content script retries with MutationObserver.
  - Ads remain strictly inside the extension UI container (popup) via `extension/lib/ads.js` (CodeFuel integration policy-compliant).

## Tech Stack & Architecture

### Backend: Supabase
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth (email, Google, GitHub)
- **Edge Functions**: Serverless API endpoints for sync and premium features
- **Real-time**: Live sync capabilities for premium users
- **Security**: End-to-end encryption for cloud-stored notes

### Browser Extension: Manifest V3
- **Framework**: Vanilla JavaScript/TypeScript
- **Local Storage**: IndexedDB for notes and file attachments
- **UI**: Modern CSS using custom design tokens (see `STYLE_GUIDE.md`), glassmorphism surfaces, and accent-driven glows
- **Performance**: Virtual scrolling, lazy loading, background indexing

### Web Application: Next.js
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Authentication**: Supabase Auth integration
- **Deployment**: Vercel (free tier sufficient)

### Popup Architecture (Modules & Orchestrator)

- `extension/popup/popup.js` is the orchestrator that initializes modules, wires events, manages `viewMode` (`all|site|page`), and delegates work. It should not implement note rendering, editor helpers, or destructive UI patterns directly.
- Modules under `extension/popup/modules/` own their domains:
  - `notes.js`: grouping, sorting, and rendering of notes (All/Site/Page), domain headers, per-note actions, two-tap delete, and inline domain bulk delete confirmation.
  - `editor.js`: editor lifecycle, HTML↔markdown transforms, caret utilities, paste/link handling, and draft persistence via `EditorManager`.
  - `settings.js`: settings UI, font preferences, applying font styles to note elements.
  - `storage.js`: data access for notes and versions (no DOM knowledge).
  - `theming.js`: theme toggling and token management (no business logic).
  - `utils.js`: stateless helpers (formatting, URL normalization like `normalizePageKey`, etc.).
- Duplication policy: avoid re-implementing module functions in `popup.js` (e.g., `createNoteElement`, `groupNotesByDomain`, `handleTwoTapDelete`, `buildContentHtml`). If temporary duplicates exist during refactor, prefer calling module APIs and mark duplicates for cleanup.

## Uninstall Notice & Persistence Plan

### Uninstall notice (pre-uninstall prompt)
- The background service worker sets an uninstall URL via `chrome.runtime.setUninstallURL(...)` in `extension/background/background.js`.
- The URL includes query params with estimated local note count and storage size to inform users that uninstalling clears local data.
- Landing page (to be built) will:
  - Explain Chrome `storage.sync` quotas and that local data is removed on uninstall.
  - Offer Export (JSON) instructions and link to Import.
  - Soft upsell Premium for cloud sync and unlimited history.

### Persistence strategy
- Short term: Export/Import in Settings (manual JSON backup/restore). No account required.
- Optional: `chrome.storage.sync` for lightweight sync within quota limits (per-note keys; chunking when needed).
- Long term (Premium): Supabase-backed encrypted cloud sync with version history.

### Settings notice (later)
- Add a Storage & Backup section in Settings explaining:
  - Local-first behavior; uninstall clears data.
  - Export/Import tools.
  - Sync quotas if user enables Chrome sync.
  - Benefits of Premium cloud sync.

## Database Schema (Supabase)

```sql
-- Profiles table for user metadata
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  subscription_tier TEXT DEFAULT 'free', -- 'free' | 'premium'
  subscription_expires_at TIMESTAMPTZ,
  storage_used_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes table with encryption support
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  url TEXT, -- null for domain-only notes
  is_url_specific BOOLEAN DEFAULT false,
  title TEXT,
  content_encrypted TEXT NOT NULL, -- AES-256 encrypted content
  content_hash TEXT NOT NULL, -- For conflict resolution
  tags TEXT[] DEFAULT '{}',
  color TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Performance indexes
  CONSTRAINT notes_content_size_check CHECK (length(content_encrypted) <= 100000) -- ~100KB limit
);

-- Version history table (limited for free users)
CREATE TABLE note_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notes_user_domain ON notes(user_id, domain) WHERE is_deleted = false;
CREATE INDEX idx_notes_user_url ON notes(user_id, url) WHERE is_deleted = false AND url IS NOT NULL;
CREATE INDEX idx_notes_updated_at ON notes(updated_at);
CREATE INDEX idx_note_versions_note_id ON note_versions(note_id, version DESC);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- Security policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can manage own notes" ON notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own note versions" ON note_versions FOR ALL USING (auth.uid() = user_id);

-- Function to limit version history for free users
CREATE OR REPLACE FUNCTION enforce_version_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user is free tier and has more than 5 versions
  IF (SELECT subscription_tier FROM profiles WHERE id = NEW.user_id) = 'free' THEN
    -- Delete oldest versions beyond 5
    DELETE FROM note_versions 
    WHERE note_id = NEW.note_id 
    AND id NOT IN (
      SELECT id FROM note_versions 
      WHERE note_id = NEW.note_id 
      ORDER BY version DESC 
      LIMIT 5
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_version_limits
  AFTER INSERT ON note_versions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_version_limits();
```

## Project Structure

```
url-notes/
├── extension/                 # Browser extension
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   ├── popup.css
│   │   ├── modules/
│   │   │   ├── notes.js          # Rendering/grouping and destructive UI patterns
│   │   │   ├── editor.js         # EditorManager and editor lifecycle
│   │   │   ├── settings.js       # Settings UI and font prefs
│   │   │   ├── storage.js        # Data access (local)
│   │   │   ├── theming.js        # Theme tokens and toggling
│   │   │   └── utils.js          # Shared helpers (e.g., normalizePageKey)
│   │   └── components/
│   ├── content/
│   │   └── content.js         # Page detection & injection
│   ├── background/
│   │   └── background.js      # Service worker
│   ├── lib/
│   │   ├── storage.js         # IndexedDB wrapper
│   │   ├── sync.js            # Cloud sync logic
│   │   ├── encryption.js      # Client-side encryption
│   │   ├── api.js             # Supabase client
│   │   └── ads.js             # CodeFuel integration
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   └── dist/                  # Built extension
├── web-app/                   # Next.js web application
│   ├── app/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── notes/
│   │   └── settings/
│   ├── components/
│   │   ├── ui/
│   │   ├── notes/
│   │   └── auth/
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── encryption.js
│   │   └── utils.js
│   └── public/
├── supabase/                  # Database migrations & edge functions
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── functions/
│   │   ├── sync-notes/
│   │   ├── export-data/
│   │   └── cleanup-deleted/
│   └── config.toml
├── shared/                    # Shared types and utilities
│   ├── types.ts
│   ├── constants.ts
│   └── validation.ts
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── SECURITY.md
└── README.md
```

## Feature Comparison: Free vs Premium

### Free Tier
- ✅ **Unlimited local notes** per domain/URL
- ✅ **Domain/URL toggle** functionality
- ✅ **Basic search** within current domain
- ✅ **Simple tagging** (up to 5 tags per note)
- ✅ **Local file attachments** (images, PDFs stored in IndexedDB)
- ✅ **Version history** (last 5 versions per note)
- ✅ **Export** (manual, JSON format only)
- ✅ **CodeFuel ads** (small banner in popup)
- ❌ No cloud sync
- ❌ No web application access
- ❌ No cross-domain search
- ❌ No advanced organization

### Premium Tier ($4.99/month, $39.99/year)
- ✅ **All free features**
- ✅ **Cloud sync** across all devices and browsers
- ✅ **Web application** access with full feature parity
- ✅ **Advanced search** (cross-domain, full-text, regex)
- ✅ **Unlimited version history**
- ✅ **Advanced tagging** (nested tags, smart folders)
- ✅ **Multiple export formats** (JSON, Markdown, HTML, PDF)
- ✅ **Scheduled backups** and restore points
- ✅ **Ad-free experience**
- ✅ **Priority support**
- ✅ **Early access** to new features

## Security & Privacy

### Data Protection
- **Client-side encryption**: All note content encrypted with AES-256 before storage
- **Zero-knowledge architecture**: Server never sees unencrypted content
- **User-controlled keys**: Encryption keys derived from user password
- **Local-first**: Notes work offline, sync when available
- **GDPR compliant**: Full data export and deletion capabilities

### Encryption Implementation
```javascript
// Client-side encryption using Web Crypto API
class NoteEncryption {
  async encryptNote(content, userKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedContent = new TextEncoder().encode(content);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      userKey,
      encodedContent
    );
    return {
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    };
  }
  
  async decryptNote(encryptedData, userKey) {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
      userKey,
      new Uint8Array(encryptedData.encrypted)
    );
    return new TextDecoder().decode(decrypted);
  }
}
```

## Performance Optimizations

### Extension Performance
- **Virtual scrolling** for large note lists
- **Lazy loading** of note content
- **Background indexing** for search
- **Debounced auto-save** (500ms delay)
- **Compressed storage** using LZ-string
- **Memory management** with note content cleanup

### Sync Performance
- **Incremental sync** (only changed notes)
- **Conflict resolution** with last-write-wins + user prompt
- **Batch operations** for bulk sync
- **Connection pooling** for API requests
- **Offline queue** for failed sync attempts

## Monetization Strategy

### CodeFuel Integration (Free Tier)
- **Placement**: Small banner at bottom of popup (300x50px)
- **Frequency**: One impression per popup open, max 5 per hour
- **Targeting**: Contextual based on current domain
- **Revenue share**: ~70% to developer
- **Privacy**: No user tracking, domain-based targeting only

### Premium Conversion Strategy
- **Free trial**: 14-day premium trial on first sign-up
- **Upgrade prompts**: When attempting premium features
- **Value demonstration**: Show sync benefits, advanced search
- **Pricing**: $4.99/month, $39.99/year (33% discount)
- **Payment**: Stripe integration with Supabase

### Cost Structure (Monthly)
- **Supabase**: Free tier (up to 50k MAU, 500MB DB)
- **Vercel**: Free tier (100GB bandwidth)
- **Domain**: ~$12/year
- **Stripe fees**: 2.9% + 30¢ per transaction
- **CodeFuel**: Revenue share model
- **Total fixed costs**: <$5/month until significant scale

## Implementation Phases

### Phase 1: Core Extension (Completed)
1. **Week 1-2**: Basic extension setup
   - Manifest V3 configuration
   - Popup UI with domain/URL detection
   - IndexedDB storage layer
   - Basic CRUD operations

2. **Week 3-4**: Advanced features
   - Domain/URL toggle functionality
   - Search and filtering
   - Local file attachments
   - Version history (limited)

3. **Week 5-6**: Polish and testing
   - Performance optimizations
   - Error handling
   - User testing and feedback
   - Chrome Web Store preparation

Status: Phase 1 goals achieved for the local-first extension MVP with polished popup UI, search/filtering, basic versioning, ads container, uninstall notice plan, and improved highlighting.

### Phase 2: Backend & Authentication (Detailed plan)
1. **Week 1**: Supabase setup
   - Database schema creation
   - RLS policies implementation
   - Authentication configuration

2. **Week 2-3**: Sync system
   - Encryption implementation
   - Cloud sync logic
   - Conflict resolution
   - Offline handling

3. **Week 4**: Testing and optimization
   - Sync performance testing
   - Security audit
   - Error handling improvements

#### Phase 2 – Detailed Tasks
- Supabase project: apply `supabase/migrations/001_initial_schema.sql`; verify RLS and policies.
- Auth: enable Email + Google/GitHub; scaffold client in `extension/lib/api.js`.
- Encryption baseline: ensure `extension/lib/encryption.js` exposes AES-GCM utilities and key derivation.
- Sync engine prototype (premium-gated): incremental upload/download, last-write-wins with basic conflict UI.
- Offline queue + retry with backoff; resume on reconnect.
- Premium gating: hide ads and enable sync when authenticated premium; persist `userTier` in `chrome.storage.local`.
- QA: performance profiling of sync, encryption correctness tests, error surfaces.

 - Reset Password: implement Supabase email-based password reset flow.
   - Add “Forgot password?” link in `settings` Account section (extension) to trigger `auth/recover`.
   - Send email with reset link; for dev, allow reset via Supabase-hosted link; for prod, point to web app route.
   - Handle post-reset sign-in UX in the extension (status message, prompt to log in).

### Phase 3: Web Application (Outline)
1. **Week 1-2**: Core web app
   - Next.js setup with authentication
   - Dashboard and notes management
   - Responsive design

2. **Week 3-4**: Advanced features
   - Advanced search interface
   - Export functionality
   - Settings and preferences

3. **Week 5**: Premium features
   - Subscription management
   - Advanced organization tools
   - Analytics dashboard

### Phase 4: Launch & Monetization (Outline)
1. **Week 1**: CodeFuel integration
   - Ad placement implementation
   - Revenue tracking
   - A/B testing setup

2. **Week 2**: Premium features
   - Stripe integration
   - Subscription management
   - Upgrade flow optimization

3. **Week 3**: Launch preparation
   - Final testing
   - Documentation
   - Marketing materials

## Milestone Plan (Step-by-step Implementation)

### Step 1: Extension MVP (Local-only)
- __Scaffold & Structure__
  - Ensure folders exist: `extension/manifest.json`, `extension/popup/`, `extension/background/`, `extension/content/`, `extension/lib/`.
  - Core libs: `extension/lib/storage.js` (IndexedDB wrapper), `extension/lib/encryption.js` (local only for now), `extension/lib/ads.js` (placeholder CodeFuel), `extension/lib/api.js` (stub for Supabase client).
- __Context detection__
  - `extension/content/content.js`: collect `domain`, `url`, `title`; send to popup via `chrome.runtime` messaging.
- __Storage & Schema__
  - `storage.js`: schema keyed by `domain`, optional `url`, boolean `is_url_specific`, fields: `title`, `content`, `tags[]`, `createdAt`, `updatedAt`, `version`.
  - Indexes: by `domain`, by `url`, by `updatedAt`, by `tags` (aux table or composite index technique).
- __UI (Popup)__
  - Domain vs URL toggle (“This Site” / “This Page”).
  - Notes list (virtualized for perf) and editor pane.
  - Basic search within current domain: debounce input, query secondary index, highlight terms.
  - CodeFuel ad slot in footer (placeholder during dev) in `popup.html` with container `#adContainer`.
  - Versioning: keep last 5 versions per note (local-first). Implement compact history storage table in IndexedDB.
- __Performance__
  - Debounced autosave (≈500ms), lazy-load note bodies, background index build for search, avoid layout thrash.
  - Virtualization for list (windowing) and minimal DOM updates.
- __Polish & Accessibility__
  - Theme tokens in `popup.css` with clear light/dark contrast.
  - Keyboard focus outlines, ARIA labels on buttons, proper button semantics.
  - Back button outlined style, consistent headers, crisp placeholder text.
- __Uninstall & Backup Messaging__
  - Add Settings notice (Storage & Backup) copy about local-only data and export/import.
  - Plan Export/Import UI (actual implementation in Step 1.1 below if time allows).

__Step 1.1: Export/Import (JSON)__
- __Export__ all notes to JSON (schema versioned). File naming: `url-notes-backup-YYYYMMDD.json`.
- __Import__ from JSON with schema validation; choose Merge vs Replace; show counts and errors.
- UI in Settings → Storage & Backup: buttons, status text, and warnings.

### Step 2: Supabase (Auth + Schema)
- __Project setup__
  - Create Supabase project; apply `supabase/migrations/001_initial_schema.sql`.
- __Auth__
  - Enable Email + Google/GitHub providers.
  - Add Supabase client in `extension/lib/api.js` (initialized but sync disabled until Step 3).
- __RLS & Policies__
  - Verify RLS in spec; enable policies for `profiles`, `notes`, `note_versions`.
- __Tier model__
  - Introduce `subscription_tier` in `profiles` and reflect locally via a `userTier` flag in `chrome.storage.local`.

### Step 3: Sync (Premium)
- __Client-side encryption__
  - Derive key from user password (PBKDF2/Argon2 if available), AES-GCM encrypt note content before upload.
  - Store only encrypted payloads in Supabase.
- __Sync engine__
  - Incremental upload/download; last-write-wins + user-visible conflict view.
  - Background sync queue with retry and exponential backoff.
- __Gating__
  - Sync available only when authenticated and `userTier === 'premium'`.
  - Hide ads in premium tier.

### Step 4: Web App (Premium)
- __Next.js app__ (scaffold under `web-app/`)
  - Auth pages, dashboard with cross-domain view, advanced search, export.
  - Settings (encryption key handling, backup tools, session mgmt).
- __Subscription__
  - Stripe/Lemon Squeezy for premium; map license to `subscription_tier` in Supabase.
- __Polish__
  - Responsive UI, keyboard nav, accessibility, dark mode.

### Cross-cutting Tasks and Ideas Captured During UI Work
- __Uninstall flow__: `chrome.runtime.setUninstallURL` to landing page explaining local data loss, Chrome `storage.sync` limits, and Export/Import guidance; premium upsell. Mirror same notice in Settings.
- __CodeFuel Ads__: integrate SDK, real `publisherId`, display logic, contextual targeting, frequency caps (max 5/hour, ≥12m cooldown). Hide for premium.
- __Light/Dark theme polish__: ensured readable colors in light mode for search, note titles, and tags; consistent outlined controls (e.g., back button).
- __Performance improvements__: debounced autosave, lazy loads, background indexing, and list virtualization.
- __Accessibility__: focus outlines, ARIA labels for icon buttons (`themeToggleBtn`, `settingsBtn`, `backBtn`, etc.).
- __Version history (free)__: cap at 5 versions; efficient storage strategy.
- __IndexedDB indices__: domain, url, updatedAt, tags; plan migrations for future schema changes.
- __QA & Store prep__: end-to-end smoke tests, contrast checks, keyboard navigation, prepare Chrome Web Store listing (icons, screenshots, description).

---

## Planned Features and Policies

### Global Notes Tab + Search
- __All Notes view__
  - DECISION: All Notes will be a dedicated, visible tab in `popup/` top navigation (not hidden in Settings) for discoverability.
  - Group by Domain; inside each domain, notes sorted newest first.
  - Domains collapsible (collapse/expand state remembered; persist state in `chrome.storage.local`).
- __Global search toggle__
  - Default scope = current domain/URL only.
  - Toggle to search across all notes.
  - Ranking priority (weighted): Titles > Tags > Content.
    - Suggested weights: title 3.0x, tags 2.0x, content 1.0x; tie-break by `updatedAt` desc.
    - Debounced input (≈250ms) and highlight matched terms in UI.

### AI Features (Premium only)
- __AI Rewrite__
  - Premium-only; no free-tier AI at launch (hide button for free users).
  - DECISION: Provider = Google Gemini, cheapest model (Gemini Flash Lite / 2.0 Flash) for cost control.
  - Fair-use cap ~2,000 rewrites/month (enforced server-side; surfaced in ToS or silent cap).

### Pricing & Features
- __Free tier__
  - Local-only notes (subject to Chrome storage cap).
  - No AI rewrite.
  - Ads (optional later, via CodeFuel).
  - Optional teaser: 5–10 notes sync.
- __Premium ($2.50/month)__
  - Unlimited synced text notes (Supabase/Postgres backend).
  - AI Rewrite (Gemini).
  - Cross-device access.
  - Hybrid URL/domain notes.
  - Global “All Notes” view.
  - No ads.
  - No file uploads (control costs).

### Editor Enhancements
- __Speech-to-Text button__
  - Use Web Speech API (`window.SpeechRecognition`/`webkitSpeechRecognition`) in popup as a progressive enhancement.
  - UX: Mic icon in editor header; tap to start/stop; live transcription into `#noteContentInput` with undo-friendly inserts.
  - Privacy: On-device where available; no server calls unless explicitly using a cloud API (not planned).
  - Fallback: Hide button if API unsupported; show tooltip “Unavailable on this browser”.
  - Limitations: Not in background; requires popup focus; handle errors/timeouts gracefully.
- __Font size/color customization__
  - Global (per-user) preferences stored in `chrome.storage.local.settings`.
  - Options: Font size (Small/Default/Large), Editor text color (preset neutrals only to maintain contrast), Line height.
  - Implementation: Apply CSS variables on `:root` or `.editor-content` (no per-note styles initially to keep performance high).

### Settings: Manual Backup (Free users)
- __Explicit Import UI__
  - Add “Import JSON” button in Settings → Storage & Backup for manual backup upload (free users).
  - Validate schema, show preview counts and dry-run option; support Merge vs Replace with confirmation.
  - This complements Export in Step 1.1 and satisfies uninstall/backup guidance.

### Chrome Storage Cap Handling (Local users)
- __Quota awareness__
  - Chrome `chrome.storage.local` quota ≈ 5MB/extension; notes ~1KB each → cap around 3,000–5,000 notes.
  - Writes may fail when exceeding cap unless handled.
- __UX plan__
  - Add indicator/warning inside extension: “Storage almost full – sync to keep your notes safe”.
  - On cap hit: prompt “You’ve reached local storage limit. Sync with cloud to continue creating notes.” + upgrade CTA.
- __Premium behavior__
  - For premium, store in Supabase/Postgres; local cap not relevant.
  - Sync + clear local cache on upgrade to avoid leftover issues.

### Upgrade Flow (Premium already at/near cap)
- On upgrade:
  - Sync all local notes to Supabase.
  - Clear old local storage; continue writing to cloud.
  - If sync fails (offline), show retry until success and defer clearing until completion.

## Success Metrics

### Technical KPIs
- **Extension performance**: <100ms popup load time
- **Sync reliability**: >99.5% success rate
- **Search speed**: <50ms for local search
- **Storage efficiency**: <1MB per 1000 notes

### Business KPIs
- **User acquisition**: 1000 DAU within 6 months
- **Conversion rate**: 5% free-to-premium conversion
- **Retention**: 70% 30-day retention rate
- **Revenue**: $5000 MRR within 12 months

## Risk Mitigation

### Technical Risks
- **Browser API changes**: Use stable APIs, monitor deprecations
- **Storage limits**: Implement cleanup and compression
- **Sync conflicts**: Robust conflict resolution with user control
- **Performance degradation**: Regular profiling and optimization

### Business Risks
- **Competition**: Focus on unique features (domain/URL toggle, local-first)
- **Platform restrictions**: Follow store guidelines strictly
- **User privacy concerns**: Transparent privacy policy, local-first approach
- **Monetization challenges**: Diversify revenue streams (ads + subscriptions)

## Next Steps

Completed (extension UI polish):
1. Enhanced popup UI, compact header/search.
2. All Notes grouped by domain with popular tags.
3. Inline delete confirmations; domain bulk delete confirm.
4. Settings panel readability (light mode); moved font controls back to Settings with preview.
5. Slider visibility and font preview.

Up next (short-term):
1. Test accessibility contrast in light mode, including slider and preview.
2. Finalize Export/Import copy and error states in Settings.
3. QA CodeFuel AdManager frequency caps and fallback creatives in popup; ensure opt-out for Premium later.
4. Uninstall notice landing page (content + simple host) and link wiring.

Mid-term:
1. Supabase project setup and schema migration.
2. Auth integration and gated Premium UI (hide ads for premium).
3. Sync prototype with client-side encryption.

---

**Last Updated**: August 20, 2025
**Version**: 1.3
**Status**: Phase 1 Completed; Preparing Phase 2
