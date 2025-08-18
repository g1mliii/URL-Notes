# URL Notes Extension - Complete Project Specification

## Overview
A browser extension and web application for taking notes on websites, with domain/URL-specific organization, local-first storage, and premium cloud sync features.

### Recent Changes (Aug 18, 2025)
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

### Phase 1: Core Extension (4-6 weeks)
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

### Phase 2: Backend & Authentication (3-4 weeks)
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

### Phase 3: Web Application (4-5 weeks)
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

### Phase 4: Launch & Monetization (2-3 weeks)
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

1. **Set up development environment**
2. **Create basic extension structure**
3. **Implement local storage system**
4. **Build popup UI with domain/URL toggle**
5. **Add basic note CRUD operations**
6. **Set up Supabase backend**
7. **Implement authentication system**
8. **Build sync functionality**
9. **Create web application**
10. **Integrate monetization features**

---

**Last Updated**: August 18, 2025
**Version**: 1.1
**Status**: In Progress
