# Edge Extension Packaging Guide

This guide covers packaging and distributing the Anchored extension for Microsoft Edge.

## Overview

Edge uses the same Chromium engine as Chrome, so the extension structure and manifest are identical. This means:
- ✅ Same Manifest V3 format
- ✅ Same APIs and permissions
- ✅ Same code structure
- ✅ Can reuse Chrome Web Store metadata and screenshots

## Prerequisites

- Node.js installed (for packaging script)
- Microsoft Edge browser for testing
- Microsoft Partner Center account for distribution

## Packaging Process

### Method 1: Manual Zip (Recommended)

The simplest way to package the extension:

1. Open the `extension-edge` folder in File Explorer
2. Select all files and folders EXCEPT:
   - `package-edge.js`
   - `package-edge.ps1`
   - `test-edge-setup.js`
   - `BROWSER_API_MIGRATION_STATUS.md`
   - `README.md`
   - `PACKAGING.md`
   - `DISTRIBUTION_CHECKLIST.md`
3. Right-click → "Send to" → "Compressed (zipped) folder"
4. Rename to `anchored-edge-extension-v{version}.zip`

That's it! The zip file is ready for submission.

### Method 2: Using Scripts (Optional)

If you prefer automation, you can use the provided scripts:

**PowerShell (Windows):**
```bash
cd extension-edge
powershell -ExecutionPolicy Bypass -File .\package-edge.ps1
```

**Node.js (Cross-platform):**
```bash
cd extension-edge
npm install archiver
node package-edge.js
```

### What to Include in the Package

Include these files and folders:
- ✅ All source code (background/, content/, popup/, lib/)
- ✅ Assets and icons
- ✅ manifest.json
- ✅ onboarding.html

Exclude these files:
- ❌ Development files (test-edge-setup.js, package-edge.js)
- ❌ Documentation (README.md, BROWSER_API_MIGRATION_STATUS.md)
- ❌ Build artifacts and logs
- ❌ Version control files

## Testing the Package

### Local Testing

1. Open Edge and navigate to `edge://extensions/`
2. Enable "Developer mode" (toggle in bottom-left)
3. Click "Load unpacked"
4. Select the `extension-edge` directory
5. Test all functionality:
   - Create and edit notes
   - Test domain/URL scoping
   - Verify sync functionality
   - Test premium features
   - Check context menus
   - Verify keyboard shortcuts

### Package Testing

1. Extract the .zip file to a temporary directory
2. Load the extracted directory in Edge
3. Verify the extension works identically to the unpacked version
4. Test installation and update flows

## Distribution

### Microsoft Edge Add-ons Submission

1. **Create Partner Center Account**
   - Go to https://partner.microsoft.com/dashboard
   - Register as an extension developer
   - Complete identity verification

2. **Prepare Store Listing**
   - **Reuse Chrome Web Store materials** (Edge uses same Chromium engine)
   - Extension name: "Anchored - URL Notes"
   - Short description: Same as Chrome version
   - Detailed description: Same as Chrome version
   - Screenshots: Same as Chrome version (1280x800 or 640x400)
   - Promotional images: Same as Chrome version
   - Category: Productivity
   - Language: English (add more as needed)

3. **Upload Package**
   - Upload the `anchored-edge-extension-v{version}.zip` file
   - Edge Add-ons will automatically validate the package
   - Review any validation warnings or errors

4. **Privacy and Compliance**
   - Privacy policy URL: https://anchored.site/privacy.html
   - Terms of service URL: https://anchored.site/terms.html
   - Declare data collection practices (encryption, local-first)
   - Confirm GDPR compliance

5. **Submit for Review**
   - Review all information
   - Submit for Microsoft's review process
   - Typical review time: 1-3 business days

### Update Process

1. Increment version in `manifest.json`
2. Run packaging script to create new .zip
3. Upload new package to Partner Center
4. Submit updated version for review
5. Edge will auto-update installed extensions

## Version Management

### Version Numbering

Follow semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes or major feature additions
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes and minor improvements

Keep Edge version synchronized with Chrome version for consistency.

### Release Checklist

- [ ] Update version in `manifest.json`
- [ ] Test all functionality in Edge
- [ ] Run packaging script
- [ ] Test packaged extension
- [ ] Update changelog/release notes
- [ ] Submit to Edge Add-ons
- [ ] Monitor review process
- [ ] Announce release to users

## Store Listing Best Practices

### Reusing Chrome Materials

Since Edge uses Chromium, you can directly reuse:
- All screenshots from Chrome Web Store
- Promotional images and banners
- Feature descriptions
- User guides and documentation

Only minor adjustments needed:
- Replace "Chrome" with "Edge" in browser-specific text
- Update installation instructions for Edge Add-ons store
- Adjust any Chrome-specific branding references

### Key Selling Points

Highlight in store listing:
- 🔒 Zero-knowledge encryption
- 📝 Domain and URL-specific notes
- 💾 Local-first, offline-capable
- ☁️ Optional cloud sync (premium)
- 🎨 Beautiful glassmorphism design
- ⚡ Fast and lightweight
- 🔄 Cross-browser sync (Chrome ↔ Edge ↔ Firefox)

## Troubleshooting

### Common Issues

**Package too large**
- Edge has a 100MB limit (same as Chrome)
- Current package should be well under this limit
- If needed, optimize images and remove unnecessary files

**Manifest validation errors**
- Edge uses same Manifest V3 as Chrome
- Ensure all required fields are present
- Check permissions are properly declared

**Extension not loading**
- Verify manifest.json syntax
- Check for console errors in Edge DevTools
- Ensure all file paths are correct

**Update not working**
- Increment version number in manifest.json
- Clear Edge extension cache
- Reinstall extension if needed

## Support and Resources

- **Edge Add-ons Dashboard**: https://partner.microsoft.com/dashboard
- **Edge Extension Docs**: https://docs.microsoft.com/microsoft-edge/extensions-chromium/
- **Edge Developer Support**: https://developer.microsoft.com/microsoft-edge/
- **Chromium Extension Docs**: https://developer.chrome.com/docs/extensions/

## Notes

- Edge Add-ons review is typically faster than Chrome Web Store
- Edge has similar policies to Chrome regarding data collection and privacy
- Edge users can also install Chrome extensions, but native Edge listing is preferred
- Monitor Edge Add-ons dashboard for user reviews and ratings
