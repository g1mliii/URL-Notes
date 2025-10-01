# Manual Cleanup List for Public Repository

## Files/Directories to DELETE from Online Repo

### AI Tool Traces (High Priority - Remove These First)
- `.kiro/` - Entire Kiro AI configuration directory
- `.serena/` - Entire Serena AI tool directory

### Test Files and Development Artifacts
- `test-formatting-backup.json`
- `test-preview-conversion.html`
- `debug-timestamp.js`

### Scripts Directory (Development/Deployment Tools)
**Delete entire `scripts/` directory or individual files:**
- `scripts/backup-config.js`
- `scripts/cleanup-old-deployment.js`
- `scripts/delete-old-repo-guide.js` ⚠️ (Kiro-generated)
- `scripts/deploy-production.js`
- `scripts/deploy-with-cache-bust.js`
- `scripts/deploy-with-env.sh`
- `scripts/diagnose-cross-repo-deployment.js`
- `scripts/enable-github-pages.js`
- `scripts/final-production-check.js`
- `scripts/fix-cross-repo-deployment.js`
- `scripts/fix-deployment.js`
- `scripts/make-repo-public-guide.js` ⚠️ (Kiro-generated)
- `scripts/production-validation.js`
- `scripts/setup-direct-deployment.js`
- `scripts/test-cache-busting-protection.js`
- `scripts/test-cache-busting.js`
- `scripts/test-new-deployment.js`
- `scripts/update-cache-version.js`
- `scripts/verify-deployment.js`

### Marketing Directory (Internal Strategy)
**Delete entire `marketing/` directory:**
- `marketing/marketing-strategy.md`
- `marketing/reddit-marketing-schedule.md`
- `marketing/reddit-posts.md`

### Webhook Server (Development Tool)
**Delete entire `webhook-server/` directory:**
- `webhook-server/api/`
- `webhook-server/package.json`
- `webhook-server/README.md`
- `webhook-server/vercel.json`

### Supabase Migrations (Database Schema)
**Delete `supabase/migrations/` directory:**
- Contains database schema that shouldn't be public
- Keep `supabase/functions/` (Edge Functions are okay to be public)

### Documentation to REORGANIZE (Optional)
**Consider moving these to a `/docs` folder or delete if not needed:**
- `DEVELOPMENT.md`
- `EXPORT_FORMATS_GUIDE.md`
- `GOOGLE_AUTH_SETUP.md`
- `GPU_ACCELERATION_PROJECT_SUMMARY.md`
- `IMPORT_SYNC_FIX_SUMMARY.md`
- `PERFORMANCE_OPTIMIZATIONS.md`
- `SECURITY_AUDIT_REPORT.md`

## Files to KEEP (Core Project)
✅ `extension/` - Browser extension code
✅ `extension-firefox/` - Firefox extension code
✅ `supabase/functions/` - Edge Functions (public API)
✅ `css/`, `js/`, `auth/` - Web app code
✅ `*.html` files - Web pages
✅ `package.json`, `manifest.json` - Configuration
✅ `README.md`, `LICENSE` - Documentation
✅ `_layouts/`, `_config.yml` - Jekyll site
✅ `.github/workflows/` - CI/CD (if you want public builds)

## Priority Order for Deletion
1. **Immediate**: `.kiro/`, `.serena/` (AI tool traces)
2. **High**: `scripts/`, `marketing/`, `webhook-server/`
3. **Medium**: Test files, development docs
4. **Low**: Reorganize remaining docs

## Local Workspace Changes Made ✅
- Created `docs/` directory and moved documentation files
- Created `dev-tools/` directory for development scripts and tools
- Moved `scripts/`, `marketing/`, `webhook-server/` to `dev-tools/`
- Deleted test files and development artifacts
- Updated `.gitignore` to reflect new structure
- Created `docs/WORKSPACE_STRUCTURE.md` for reference

## After Manual Deletion
- The updated `.gitignore` will prevent these from syncing back
- You can keep them locally for development in `dev-tools/`
- Future commits won't include these files
- Your workspace is now organized and ready for public release