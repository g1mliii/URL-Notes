# XSS Protection Testing Guide

## Quick Visual Tests

### 1. **Debug Panel Method** (Easiest)
1. Open dashboard: `https://anchored.site/dashboard?debug=xss`
2. Look for the black debug panel in top-right corner
3. Click "Test XSS" button to run automated test
4. Check console for detailed logs

**Alternative**: Press `Ctrl+Shift+X` on any page to toggle debug panel

### 2. **Browser Console Method**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for these messages:
   - `✅ DOMSanitizer: Using DOMPurify library` (good)
   - `⚠️ DOMSanitizer: Using fallback sanitizer` (still safe, but fallback)
   - `🛡️ DOMSanitizer: Content sanitized` (protection working)

### 3. **Manual Note Editor Test**
1. Create a new note in dashboard
2. In the content editor, paste this malicious content:
   ```html
   <script>alert('XSS Attack!')</script>
   <img src=x onerror=alert('XSS via image')>
   <p onclick="alert('XSS via click')">Click me</p>
   <a href="javascript:alert('XSS via link')">Malicious link</a>
   <p>This is safe content</p>
   ```
3. Save the note
4. View the note - you should see:
   - ✅ No alert popups
   - ✅ "This is safe content" text visible
   - ✅ Malicious scripts/handlers removed

### 4. **Import Test**
1. Create a JSON file with malicious content:
   ```json
   {
     "notes": [{
       "title": "<script>alert('XSS in title')</script>Safe Title",
       "content": "<script>alert('XSS!')</script><p>Safe content</p>",
       "tags": ["<script>alert('tag')</script>safe-tag"]
     }]
   }
   ```
2. Import this file in dashboard
3. Check that scripts are removed but safe content remains

## What to Look For

### ✅ **Protection Working Signs**:
- Console shows: `✅ DOMSanitizer: Using DOMPurify library`
- No JavaScript alert popups when testing malicious content
- Malicious tags (`<script>`, `onerror`, etc.) are removed
- Safe content (text, basic formatting) is preserved
- Console shows sanitization logs when content is cleaned

### ⚠️ **Fallback Mode Signs** (Still Safe):
- Console shows: `⚠️ DOMSanitizer: Using fallback sanitizer`
- Still no JavaScript execution from malicious content
- More aggressive content filtering (may remove more formatting)

### ❌ **Protection Failed Signs** (Needs Investigation):
- JavaScript alert popups appear when testing
- Malicious scripts execute
- Console errors about sanitization failures
- No sanitization logs in console

## Browser DevTools Inspection

### Check Element Inspection:
1. Right-click on note content → "Inspect Element"
2. Look at the HTML structure
3. Verify no dangerous attributes remain:
   - No `onclick`, `onerror`, `onload` attributes
   - No `javascript:` URLs in `href` attributes
   - No `<script>` tags in content

### Network Tab:
1. Open Network tab in DevTools
2. Reload page
3. Check that `purify.min.js` loads successfully
4. Look for any 404 errors on sanitizer files

## Quick Console Commands

Run these in browser console for instant checks:

```javascript
// Check if DOMPurify is loaded
console.log('DOMPurify loaded:', !!window.DOMPurify);

// Check sanitizer status
console.log('Sanitizer initialized:', window.domSanitizer?.isInitialized);

// Test sanitization manually
window.domSanitizer?.sanitizeRichText('<script>alert("test")</script><p>Safe</p>')
  .then(result => console.log('Sanitized:', result));

// Run XSS test (if on dashboard)
window.dashboard?.testXSSProtection();
```

## Production vs Development

- **Development** (`localhost`): Debug panel shows automatically
- **Production** (`anchored.site`): Add `?debug=xss` to URL or use `Ctrl+Shift+X`
- **Console logs**: Always available in both environments

## Expected Results

### Malicious Input:
```html
<script>alert('XSS')</script><p>Hello <strong>World</strong></p>
```

### Expected Output:
```html
<p>Hello <strong>World</strong></p>
```

The script tag should be completely removed, but safe HTML formatting should be preserved.