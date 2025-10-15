# Edge Extension Quick Start Guide

## Creating the Package (Simple Method)

1. **Open the extension-edge folder** in File Explorer

2. **Select these files and folders:**
   - ✅ `assets/` folder
   - ✅ `background/` folder
   - ✅ `content/` folder
   - ✅ `lib/` folder
   - ✅ `popup/` folder
   - ✅ `manifest.json`
   - ✅ `onboarding.html`

3. **DO NOT include:**
   - ❌ `package-edge.js`
   - ❌ `test-edge-setup.js`
   - ❌ `README.md`
   - ❌ `PACKAGING.md`
   - ❌ `DISTRIBUTION_CHECKLIST.md`
   - ❌ `QUICK_START.md`
   - ❌ `BROWSER_API_MIGRATION_STATUS.md`

4. **Create the zip:**
   - Right-click on the selected files
   - Choose "Send to" → "Compressed (zipped) folder"
   - Rename to `anchored-edge-extension-v1.16.zip` (use current version from manifest.json)

5. **Test the package:**
   - Extract the zip to a temporary folder
   - Open Edge and go to `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extracted folder
   - Test all functionality

## Submitting to Edge Add-ons

1. **Go to Microsoft Partner Center:**
   - Visit https://partner.microsoft.com/dashboard
   - Sign in or create an account

2. **Upload your package:**
   - Click "New submission"
   - Upload the .zip file
   - Fill in the store listing details

3. **Reuse Chrome materials:**
   - Copy description from Chrome Web Store
   - Use same screenshots and icons
   - Same privacy policy and terms

4. **Submit for review:**
   - Review all information
   - Click "Submit"
   - Wait 1-3 business days for approval

## Testing in Edge

**Load unpacked extension:**
1. Open Edge
2. Go to `edge://extensions/`
3. Enable "Developer mode" (bottom-left toggle)
4. Click "Load unpacked"
5. Select the `extension-edge` folder
6. Test all features

**Test the packaged version:**
1. Extract your .zip file
2. Load the extracted folder as unpacked extension
3. Verify everything works identically

## Key Information

- **Extension Name:** Anchored - URL Notes
- **Version:** Check `manifest.json` for current version
- **Category:** Productivity
- **Privacy Policy:** https://anchored.site/privacy.html
- **Support:** [your-support-email]

## Common Issues

**Package too large?**
- Edge limit is 100MB
- Current package should be ~2-5MB
- Make sure you didn't include unnecessary files

**Extension won't load?**
- Check manifest.json syntax
- Verify all file paths are correct
- Look for console errors in Edge DevTools

**Submission rejected?**
- Read the feedback carefully
- Common issues: missing privacy policy, unclear permissions
- Fix and resubmit

## Next Steps

After approval:
- ✅ Test installation from Edge Add-ons store
- ✅ Update your website with Edge Add-ons link
- ✅ Announce to users
- ✅ Monitor reviews and ratings

For detailed information, see `PACKAGING.md` and `DISTRIBUTION_CHECKLIST.md`.
