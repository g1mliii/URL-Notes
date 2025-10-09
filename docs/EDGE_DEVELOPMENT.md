# Edge Extension Development Guide

## Overview

The `extension-edge/` directory contains the Microsoft Edge-compatible version of the Anchored extension. Edge uses the same Chromium engine as Chrome, so the extension code is largely identical with minimal Edge-specific adaptations.

## Development Setup

### Prerequisites

1. **Microsoft Edge Developer Edition** (recommended) or stable Edge
   - Download from: https://www.microsoft.com/en-us/edge/business/download
   - Developer Edition provides better debugging tools and early access to features

2. **Edge Developer Tools**
   - Built into Edge browser (F12 or right-click → Inspect)
   - Extension debugging available in Developer Tools

### Loading the Extension for Development

1. Open Microsoft Edge
2. Navigate to `edge://extensions/`
3. Enable "Developer mode" toggle (top-right corner)
4. Click "Load unpacked"
5. Select the `extension-edge` directory
6. The extension should now appear in your extensions list

### Development Workflow

#### Testing and Debugging

1. **Extension Popup Debugging**:
   - Right-click the extension icon → "Inspect popup"
   - Or open popup and press F12

2. **Background Script Debugging**:
   - Go to `edge://extensions/`
   - Find Anchored extension
   - Click "Inspect views: background page"

3. **Content Script Debugging**:
   - Open any webpage
   - Press F12 → Sources tab
   - Find content scripts under "Content scripts" section

#### Live Reload During Development

1. Make changes to extension files in `extension-edge/`
2. Go to `edge://extensions/`
3. Click the refresh icon on the Anchored extension card
4. Test your changes immediately

### Edge-Specific Considerations

#### Manifest V3 Compatibility
- Edge supports Manifest V3 (same as Chrome)
- No manifest changes needed from Chrome version
- Service workers work identically to Chrome

#### API Compatibility
- Edge uses `chrome.*` APIs (same as Chrome)
- WebExtensions APIs are identical to Chrome
- No browser API abstraction needed for Edge

#### Performance Characteristics
- Similar performance to Chrome (same Chromium engine)
- Memory usage patterns identical to Chrome
- Storage quotas and limits same as Chrome

#### Edge Add-ons Store Requirements
- Extensions must be packaged as .zip files
- Same security requirements as Chrome Web Store
- Edge-specific metadata can be added to manifest

### Testing Checklist

Before submitting to Edge Add-ons store, verify:

- [ ] Extension loads without errors in Edge
- [ ] All popup functionality works correctly
- [ ] Background script operates properly
- [ ] Content scripts inject and function on all websites
- [ ] Storage operations work (IndexedDB, chrome.storage)
- [ ] Sync functionality operates correctly
- [ ] Premium features function properly
- [ ] Keyboard shortcuts work as expected
- [ ] Context menus appear and function
- [ ] Extension updates properly when reloaded

### Edge Add-ons Store Submission

1. **Package Extension**:
   ```bash
   # Create zip file of extension-edge directory
   # Exclude development files (.md, tests, etc.)
   ```

2. **Edge Partner Center**:
   - Register at: https://partner.microsoft.com/en-us/dashboard/microsoftedge
   - Upload packaged extension
   - Fill out store listing details
   - Submit for review

3. **Store Listing Requirements**:
   - Extension name: "Anchored – Notes & Highlights for Websites"
   - Description: Same as Chrome Web Store
   - Screenshots: Edge-specific if UI differs
   - Privacy policy: Same as Chrome version

### Troubleshooting

#### Common Edge Development Issues

1. **Extension Won't Load**:
   - Check manifest.json syntax
   - Verify all file paths exist
   - Check Edge developer console for errors

2. **Popup Not Opening**:
   - Verify popup.html path in manifest
   - Check for JavaScript errors in popup
   - Ensure popup dimensions are appropriate

3. **Background Script Issues**:
   - Check service worker registration
   - Verify event listeners are properly set up
   - Monitor background script console for errors

4. **Content Script Problems**:
   - Verify matches patterns in manifest
   - Check for CSP violations on target sites
   - Ensure content script loads at correct timing

### Edge vs Chrome Differences

#### Minimal Differences Expected
- UI rendering: Identical (same Chromium engine)
- API behavior: Identical (same WebExtensions implementation)
- Performance: Nearly identical
- Security model: Same as Chrome

#### Potential Edge-Specific Considerations
- Edge Add-ons store policies may differ from Chrome Web Store
- Edge enterprise features may affect extension behavior
- Edge sync may have different characteristics than Chrome sync

### Development Commands

```bash
# No build process needed - direct file editing

# Testing
# Load extension-edge/ in edge://extensions/

# Debugging
# Use Edge DevTools (F12) for all debugging needs

# Packaging for store
# Create zip of extension-edge/ directory (exclude .md files)
```

## Next Steps

After completing Edge development setup:

1. Test all core functionality in Edge
2. Verify performance parity with Chrome version
3. Document any Edge-specific behaviors discovered
4. Prepare for Edge Add-ons store submission
5. Plan cross-browser testing between Chrome and Edge versions