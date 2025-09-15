# Cache Busting System

This document explains the cache busting system implemented to resolve aggressive browser caching issues.

## Problem

The website was experiencing strong caching issues, particularly in Brave browser, where users were seeing older versions of the site even after updates were deployed.

## Solution

We implemented a multi-layered cache busting system:

### 1. Dynamic Version Parameters

All CSS and JavaScript files now use dynamic version parameters based on Jekyll's build time:

```html
<!-- Before -->
<link rel="stylesheet" href="/css/main.css?v=20250904t">
<script src="/js/app.js?v=20250904c"></script>

<!-- After -->
<link rel="stylesheet" href="/css/main.css?v={{ site.time | date: '%Y%m%d%H%M%S' }}">
<script src="/js/app.js?v={{ site.time | date: '%Y%m%d%H%M%S' }}">
```

### 2. Reduced Cache Headers

Updated `_headers` file to use more reasonable cache durations:

- **CSS/JS files**: 24 hours (was 1 year)
- **Images**: 1 week  
- **HTML files**: No cache
- **JSON files**: No cache

### 3. Client-Side Cache Detection

Added `js/cache-buster.js` that:

- Detects when user has outdated cached version
- Shows notification prompting user to refresh
- Provides "Refresh Now" button for immediate update
- Auto-dismisses after 10 seconds

### 4. Cache Version Meta Tag

Added meta tag to track cache version:

```html
<meta name="cache-version" content="{{ site.time | date: '%Y%m%d%H%M%S' }}">
```

### 5. Deployment Scripts

Created utility scripts for managing cache versions:

- `scripts/update-cache-version.js` - Updates cache version manually
- `scripts/deploy-with-cache-bust.js` - Deployment with automatic cache busting

## Usage

### Automatic (Recommended)

Every time the site is built/deployed, cache versions are automatically updated using Jekyll's `site.time` variable.

### Manual Cache Bust

If you need to force a cache update:

```bash
# Update cache version
node scripts/update-cache-version.js

# Or deploy with cache busting
node scripts/deploy-with-cache-bust.js --commit
```

### For Users Experiencing Cache Issues

Users will automatically see a notification when their cached version is outdated. They can:

1. Click "Refresh Now" for immediate update
2. Click "Later" to dismiss (will show again next visit)
3. Wait 10 seconds for auto-dismiss

## Technical Details

### Cache Strategy

- **CSS/JS**: 24-hour cache with version parameters
- **Images**: 1-week cache (rarely change)
- **HTML**: No cache (always fresh)
- **Dynamic versioning**: Based on build timestamp

### Note Storage Protection

**CRITICAL**: The cache busting system is designed to preserve all user data:

#### Protected localStorage Keys:
- **Note Storage**: `anchored_notes_*`, `anchored_sync_queue`, `anchored_last_sync`, `anchored_change_count`, `anchored_meta`
- **Authentication**: `supabase_session`, `userTier`, `profileLastChecked`, `subscriptionLastChecked`
- **Subscription Data**: `cachedSubscription`, `subscriptionCacheTime`
- **Encryption**: `encryptionKeyLastChecked`, `cachedKeyMaterial`, `cachedSalt`
- **User Preferences**: `theme`, `upgradeBannerDismissed`
- **Monitoring**: `anchored_debug`, `anchored_errors`, `anchored_health_checks`

#### Only Removed Keys:
- **Cache Version**: `anchored-cache-version` (the only key removed during cache refresh)

#### Safety Mechanisms:
1. **Explicit Protection List**: All user data keys are explicitly protected
2. **Double-Check Validation**: Keys are verified against protection list before removal
3. **Logging**: All preserved keys are logged for verification
4. **Test Function**: `window.CacheBuster.testNoteStorageProtection()` can verify protection works

### Browser Compatibility

The cache busting system works across all modern browsers:

- Chrome/Chromium (including Brave)
- Firefox
- Safari
- Edge

### Performance Impact

- Minimal: Only adds small version parameter to URLs
- Client-side detection runs once per page load
- No impact on actual site functionality
- **Zero impact on note storage or retrieval**

## Monitoring

Cache version information is included in:

- `health.json` endpoint
- Browser console logs (when cache refresh needed)
- Meta tag in page source

## Troubleshooting

### If Users Still See Old Version

1. Check if cache version is updating in `health.json`
2. Verify `_headers` file is being applied
3. Run manual cache bust script
4. Check browser developer tools for 304 vs 200 responses

### For Developers

1. Always test cache busting after major updates
2. Monitor `health.json` for cache version changes
3. Use browser dev tools to verify version parameters
4. Test in incognito/private mode to bypass cache
5. **Test note storage protection**: Run `window.CacheBuster.testNoteStorageProtection()` in console

### Testing Note Storage Protection

To verify that cache busting doesn't affect note storage:

```javascript
// Run in browser console
window.CacheBuster.testNoteStorageProtection()
```

This test will:
1. Create sample note storage data
2. Simulate cache clearing process
3. Verify all note data is preserved
4. Confirm only cache version is removed
5. Clean up test data
6. Return pass/fail results

## Files Modified

- `_layouts/default.html` - Dynamic version parameters
- `_headers` - Reduced cache durations  
- `js/cache-buster.js` - Client-side detection
- `health.json` - Cache version tracking
- `scripts/update-cache-version.js` - Manual cache busting
- `scripts/deploy-with-cache-bust.js` - Deployment helper

## Future Improvements

- Service worker for more advanced caching control
- Automatic cache warming for critical resources
- A/B testing for cache strategies
- Integration with CI/CD for automatic cache busting