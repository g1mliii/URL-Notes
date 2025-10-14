# Browser Detection Implementation

## Overview

The browser detection system automatically identifies the user's browser and dynamically updates extension store links throughout the anchored.site website. This ensures users are directed to the correct extension store for their browser.

## Implementation

### Core Module: `js/browser-detection.js`

The browser detection module is a self-contained JavaScript module that:

1. **Detects the user's browser** using User Agent string analysis
2. **Updates extension links** dynamically on page load
3. **Provides browser-specific messaging** for better UX
4. **Handles unsupported browsers** gracefully (e.g., Safari "Coming Soon")

### Supported Browsers

| Browser | Detection Method | Store URL | Status |
|---------|-----------------|-----------|--------|
| Chrome | `Chrome` in UA + `Google` vendor | Chrome Web Store | ✅ Available |
| Firefox | `Firefox` in UA | Firefox Add-ons | ✅ Available |
| Edge | `Edg/` or `Edge/` in UA | Edge Add-ons | ✅ Available |
| Safari | `Safari` in UA + `Apple` vendor | N/A | ⏳ Coming Soon |
| Opera | `OPR` or `Opera` in UA | Chrome Web Store | ✅ Available |
| Brave | Falls back to Chrome | Chrome Web Store | ✅ Available |

### Detection Logic

The module uses a priority-based detection system:

1. **Edge** - Checked first (before Chrome, as Edge UA contains "Chrome")
2. **Firefox** - Unique identifier
3. **Safari** - Checked before Chrome (Safari UA contains "Chrome")
4. **Chrome** - Most common Chromium-based browser
5. **Opera** - Alternative Chromium browser
6. **Unknown** - Fallback to Chrome Web Store

### Integration

The module is integrated into pages via the Jekyll front matter:

```yaml
---
scripts:
  - config.js
  - js/browser-detection.js  # Add this line
  - js/app.js
  # ... other scripts
---
```

### Auto-Initialization

The module automatically initializes on page load and updates all links with the class `chrome-store-link` or primary buttons linking to the Chrome Web Store.

## Usage

### Automatic Link Updates

Any link with the class `chrome-store-link` will be automatically updated:

```html
<a href="https://chromewebstore.google.com/..." 
   class="chrome-store-link" 
   target="_blank">Get Extension</a>
```

### Manual Detection

You can also use the module programmatically:

```javascript
// Get detected browser info
const browser = BrowserDetection.detectBrowser();
console.log(browser.name); // 'chrome', 'firefox', 'edge', etc.

// Get appropriate store URL
const storeUrl = BrowserDetection.getStoreUrl();

// Get browser-specific messaging
const message = BrowserDetection.getBrowserMessage();
console.log(message.title); // "Get Anchored for Firefox"
```

## Store URLs

### Chrome Web Store
```
https://chromewebstore.google.com/detail/anchored-%E2%80%93-notes-highligh/llkmfidpbpfgdgjlohgpomdjckcfkllg
```

### Firefox Add-ons
```
https://addons.mozilla.org/firefox/addon/anchored-notes/
```
**Note:** Update this URL once the Firefox extension is published.

### Edge Add-ons
```
https://microsoftedge.microsoft.com/addons/detail/anchored-notes/
```
**Note:** Update this URL once the Edge extension is published.

### Safari
Not yet available. Shows "Coming Soon" message to users.

## Testing

### Test Page

A comprehensive test page is available at `test-browser-detection.html` which includes:

- Current browser detection display
- Simulated user agent tests
- Browser support matrix
- Live link testing

### Manual Testing

To test browser detection:

1. Open `test-browser-detection.html` in different browsers
2. Verify the detected browser matches your actual browser
3. Check that the "Get Extension" link points to the correct store
4. Test with browser developer tools using different user agent strings

### User Agent Testing

You can test different browsers using Chrome DevTools:

1. Open DevTools (F12)
2. Click the three dots menu → More tools → Network conditions
3. Uncheck "Use browser default" under User agent
4. Select different browsers from the dropdown
5. Refresh the page to see updated detection

## Browser-Specific Behavior

### Chrome/Brave/Opera
- Redirects to Chrome Web Store
- Message: "Get Anchored for Chrome"
- All Chromium-based browsers use the same extension

### Firefox
- Redirects to Firefox Add-ons
- Message: "Get Anchored for Firefox"
- Uses Firefox-specific extension build

### Edge
- Redirects to Edge Add-ons
- Message: "Get Anchored for Edge"
- Uses Edge-specific extension build

### Safari
- Link disabled (cursor: not-allowed, opacity: 0.6)
- Shows alert: "Coming Soon for Safari"
- Message: "Safari support is in development"

## Maintenance

### Updating Store URLs

When Firefox or Edge extensions are published, update the URLs in `js/browser-detection.js`:

```javascript
STORE_URLS: {
  chrome: 'https://chromewebstore.google.com/...',
  firefox: 'YOUR_FIREFOX_ADDON_URL_HERE',
  edge: 'YOUR_EDGE_ADDON_URL_HERE',
  safari: null
}
```

### Adding New Browsers

To add support for a new browser:

1. Add detection logic in `detectBrowser()` method
2. Add store URL to `STORE_URLS` object
3. Add browser-specific messaging in `getBrowserMessage()` method
4. Update documentation and test page

## Performance

- **Lightweight**: ~6KB unminified
- **No dependencies**: Pure vanilla JavaScript
- **Fast execution**: Runs synchronously on page load
- **Non-blocking**: Uses DOMContentLoaded for safe initialization

## Browser Compatibility

The detection module itself works in all modern browsers:
- Chrome 60+
- Firefox 55+
- Edge 79+ (Chromium)
- Safari 11+
- Opera 47+

## Security Considerations

- Uses read-only `navigator.userAgent` and `navigator.vendor`
- No external API calls or data collection
- No cookies or local storage usage
- Safe for Content Security Policy (CSP)

## Future Enhancements

1. **Safari Support**: Add Safari extension when available
2. **Analytics**: Track browser distribution (optional)
3. **A/B Testing**: Test different messaging per browser
4. **Localization**: Add multi-language support for messages
5. **Mobile Detection**: Add iOS/Android app store links

## Troubleshooting

### Links not updating
- Check that `js/browser-detection.js` is loaded before DOM ready
- Verify links have the `chrome-store-link` class
- Check browser console for JavaScript errors

### Wrong browser detected
- Verify user agent string in console: `navigator.userAgent`
- Check detection priority order in `detectBrowser()` method
- Test with actual browser, not just UA spoofing

### Safari shows Chrome store
- This is expected behavior (fallback)
- Safari extension is not yet available
- Users will see "Coming Soon" message when clicking

## Related Files

- `js/browser-detection.js` - Main detection module
- `index.html` - Homepage with browser detection
- `help.html` - Help page with browser detection
- `test-browser-detection.html` - Test suite
- `docs/BROWSER_DETECTION.md` - This documentation

## Requirements Satisfied

This implementation satisfies the following requirements from the Firefox Extension Migration spec:

- **Requirement 6.1**: Browser detection on anchored.site
- **Requirement 6.2**: Dynamic store link routing
- Detects Chrome, Firefox, Edge, Safari, and other browsers
- Updates "Get Extension" button dynamically
- Provides browser-specific messaging
- Handles Safari "Coming Soon" gracefully
- Tested across different user agents
