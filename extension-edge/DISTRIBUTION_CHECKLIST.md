# Edge Extension Distribution Checklist

Use this checklist to ensure a smooth submission to Microsoft Edge Add-ons.

## Pre-Submission Checklist

### Code Preparation
- [ ] All features tested in Microsoft Edge
- [ ] No console errors or warnings
- [ ] Extension loads correctly in edge://extensions/
- [ ] All permissions are necessary and documented
- [ ] Privacy policy and terms of service are up to date
- [ ] Version number incremented in manifest.json

### Testing
- [ ] Create and edit notes functionality works
- [ ] Domain and URL scoping works correctly
- [ ] Sync functionality tested (if premium)
- [ ] Context menus appear and function
- [ ] Keyboard shortcuts work (Alt+E, Alt+N)
- [ ] Popup opens and displays correctly (400x600px)
- [ ] Content script injects properly on all websites
- [ ] Background service worker handles events correctly
- [ ] Offline functionality works (local-first)
- [ ] Premium features gate correctly
- [ ] Cross-browser sync tested (Chrome ↔ Edge)

### Package Creation
- [ ] Create .zip file manually (select all files except docs/scripts, right-click → compress)
- [ ] Name it `anchored-edge-extension-v{version}.zip`
- [ ] Verify .zip file created successfully
- [ ] Check package size (should be under 100MB)
- [ ] Extract and test packaged version
- [ ] Verify all files included correctly
- [ ] No development/documentation files in package (README.md, PACKAGING.md, etc.)

## Store Listing Preparation

### Required Information
- [ ] Extension name: "Anchored - URL Notes"
- [ ] Short description (132 characters max)
- [ ] Detailed description (reuse from Chrome Web Store)
- [ ] Category: Productivity
- [ ] Language: English (primary)
- [ ] Privacy policy URL: https://anchored.site/privacy.html
- [ ] Terms of service URL: https://anchored.site/terms.html

### Visual Assets (Reuse from Chrome)
- [ ] Icon 128x128px (required)
- [ ] Icon 48x48px (required)
- [ ] Screenshots (1280x800 or 640x400, at least 1 required)
- [ ] Promotional images (optional but recommended)
- [ ] Store tile image 1400x560px (optional)

### Privacy and Permissions
- [ ] List all permissions used
- [ ] Explain why each permission is needed
- [ ] Declare data collection practices
- [ ] Confirm zero-knowledge encryption
- [ ] Confirm local-first architecture
- [ ] GDPR compliance confirmed

## Submission Process

### Microsoft Partner Center
- [ ] Account created and verified
- [ ] Developer agreement accepted
- [ ] Payment information added (if applicable)

### Upload and Configure
- [ ] Upload .zip package
- [ ] Fill in all required fields
- [ ] Add store listing description
- [ ] Upload screenshots and icons
- [ ] Set pricing (Free with optional premium)
- [ ] Configure in-app purchases (if applicable)
- [ ] Set availability (all markets or specific)
- [ ] Add support contact information

### Review Submission
- [ ] Review all information for accuracy
- [ ] Check for typos and formatting
- [ ] Verify all links work correctly
- [ ] Confirm screenshots match current version
- [ ] Submit for review

## Post-Submission

### Monitor Review
- [ ] Check Partner Center dashboard daily
- [ ] Respond to any review feedback promptly
- [ ] Address any issues or questions from Microsoft
- [ ] Typical review time: 1-3 business days

### After Approval
- [ ] Verify extension appears in Edge Add-ons store
- [ ] Test installation from store
- [ ] Update website with Edge Add-ons link
- [ ] Update browser detection to show Edge link
- [ ] Announce availability to users
- [ ] Monitor user reviews and ratings
- [ ] Respond to user feedback

## Update Checklist

### For Future Updates
- [ ] Increment version in manifest.json
- [ ] Update changelog/release notes
- [ ] Test all changes in Edge
- [ ] Create new package
- [ ] Upload to Partner Center
- [ ] Submit updated version
- [ ] Monitor review process
- [ ] Verify auto-update works for existing users

## Store Listing Content

### Short Description (132 chars max)
```
Take domain and URL-specific notes with zero-knowledge encryption. Local-first, offline-capable, beautiful design.
```

### Key Features (for detailed description)
- 🔒 Zero-knowledge encryption - Your notes are encrypted before leaving your device
- 📝 Domain & URL-specific notes - Organize notes by website and page
- 💾 Local-first architecture - Works offline, syncs when online
- ☁️ Optional cloud sync - Premium feature for cross-device access
- 🎨 Beautiful glassmorphism design - Modern, elegant interface
- ⚡ Fast and lightweight - Popup loads in under 200ms
- 🔄 Cross-browser sync - Works with Chrome and Firefox versions
- 🎯 Context menus - Quick access from right-click menu
- ⌨️ Keyboard shortcuts - Alt+E to toggle, Alt+N for new note
- 🆓 Free tier available - Core features free forever

### Privacy Highlights
- All notes encrypted with AES-256-GCM before cloud storage
- Zero-knowledge architecture - server never sees unencrypted data
- Local-first - all data stored locally, cloud is optional
- No tracking or analytics on user content
- GDPR compliant

## Support Resources

### Documentation Links
- Extension documentation: https://anchored.site/help.html
- Privacy policy: https://anchored.site/privacy.html
- Terms of service: https://anchored.site/terms.html
- Support email: [your-support-email]

### Developer Resources
- Microsoft Partner Center: https://partner.microsoft.com/dashboard
- Edge Extensions Docs: https://docs.microsoft.com/microsoft-edge/extensions-chromium/
- Edge Developer Support: https://developer.microsoft.com/microsoft-edge/

## Notes

- Edge Add-ons review is typically faster than Chrome Web Store (1-3 days vs 1-2 weeks)
- Edge uses same Chromium engine, so Chrome materials can be reused directly
- Edge has similar policies to Chrome regarding privacy and data collection
- Monitor dashboard for user reviews and respond professionally
- Keep Edge version synchronized with Chrome version for consistency
