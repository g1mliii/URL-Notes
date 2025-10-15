# Firefox Extension Packaging and Distribution Guide

This guide covers the complete process for packaging, signing, and distributing the Anchored Firefox extension.

## Prerequisites

1. **Install web-ext CLI tool**:
   ```bash
   cd extension-firefox
   npm install
   ```

2. **Firefox Add-ons Account**:
   - Create an account at https://addons.mozilla.org/developers/
   - Generate API credentials at https://addons.mozilla.org/developers/addon/api/key/

## Building the Extension

### Development Build
For testing and development:
```bash
npm run build
```
This creates an unsigned `.xpi` file in `web-ext-artifacts/` directory.

### Production Build
For distribution (includes linting):
```bash
npm run build:prod
```

### Validation
Validate the extension before submission:
```bash
npm run validate
```

## Signing the Extension

Firefox requires all extensions to be signed before they can be installed by users (except in Developer Edition with specific settings).

### Option 1: Listed Distribution (Firefox Add-ons Store)

**Recommended for public distribution**

1. **Set up API credentials** (one-time setup):
   ```bash
   # Windows (CMD)
   set WEB_EXT_API_KEY=your_api_key_here
   set WEB_EXT_API_SECRET=your_api_secret_here

   # Windows (PowerShell)
   $env:WEB_EXT_API_KEY="your_api_key_here"
   $env:WEB_EXT_API_SECRET="your_api_secret_here"
   ```

2. **Sign the extension**:
   ```bash
   npm run sign
   ```

3. **Manual review process**:
   - Mozilla will review the extension (typically 1-3 days)
   - You'll receive an email when review is complete
   - Once approved, it will be available on Firefox Add-ons store

### Option 2: Unlisted Distribution (Self-Hosting)

**For beta testing or self-distribution**

1. **Set up API credentials** (same as above)

2. **Sign for unlisted distribution**:
   ```bash
   npm run sign:unlisted
   ```

3. **Automatic signing**:
   - No manual review required
   - Signed `.xpi` file is generated immediately
   - You can distribute this file directly to users

## Installation and Testing

### Installing Unsigned Extension (Development Only)

**Firefox Developer Edition or Nightly**:
1. Open `about:config`
2. Set `xpinstall.signatures.required` to `false`
3. Open `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on"
5. Select the `.xpi` file from `web-ext-artifacts/`

### Installing Signed Extension

**Any Firefox version**:
1. Download the signed `.xpi` file
2. Open Firefox
3. Drag and drop the `.xpi` file into Firefox
4. Click "Add" when prompted

### Testing with web-ext

Run the extension in a temporary Firefox profile:
```bash
npm run dev
```

Run with debugging tools:
```bash
npm run test
```

## Update Process

### Version Updates

1. **Update version in manifest.json**:
   ```json
   {
     "version": "1.17"
   }
   ```

2. **Update version in package.json**:
   ```json
   {
     "version": "1.17.0"
   }
   ```

3. **Build and sign**:
   ```bash
   npm run build:prod
   npm run sign
   ```

### Automatic Updates

Firefox automatically checks for updates if:
- Extension is installed from Firefox Add-ons store (listed)
- Extension includes `update_url` in manifest (unlisted)

For unlisted extensions, add to manifest.json:
```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "anchored@anchored.site",
      "update_url": "https://your-domain.com/updates.json"
    }
  }
}
```

## Distribution Checklist

### Before Submission

- [ ] Update version number in manifest.json and package.json
- [ ] Run `npm run lint` - fix all errors
- [ ] Test extension functionality in Firefox
- [ ] Test on multiple Firefox versions (ESR, Stable, Beta)
- [ ] Verify all permissions are necessary and documented
- [ ] Update CHANGELOG.md with new features/fixes
- [ ] Prepare store listing materials (see below)

### Store Listing Materials

**Reuse from Chrome Web Store with these adjustments**:

1. **Extension Name**: "Anchored – Notes & Highlights for Websites"
2. **Short Description** (250 chars max):
   ```
   Take contextual notes tied to websites. Highlight text and save notes linked to pages you visit. Local-first with optional cloud sync.
   ```

3. **Full Description**:
   - Copy from Chrome Web Store listing
   - Replace "Chrome" with "Firefox" where applicable
   - Mention Firefox-specific features if any

4. **Screenshots**:
   - Reuse Chrome Web Store screenshots
   - Ensure they show Firefox UI elements (optional but recommended)
   - Minimum 1 screenshot, maximum 10
   - Recommended size: 1280x800 or 640x400

5. **Promotional Images**:
   - Icon: 128x128px (already in assets/icons/)
   - Promotional tile: 440x280px (optional)

6. **Categories**:
   - Primary: Productivity
   - Secondary: Web Development (if applicable)

7. **Support Information**:
   - Homepage: https://anchored.site
   - Support email: support@anchored.site
   - Support site: https://anchored.site/help.html

### Submission Process

1. **Go to Firefox Add-ons Developer Hub**:
   https://addons.mozilla.org/developers/

2. **Submit New Add-on**:
   - Upload signed `.xpi` file
   - Fill in listing information
   - Upload screenshots and promotional images
   - Set privacy policy URL
   - Submit for review

3. **Review Timeline**:
   - Initial review: 1-3 business days
   - Updates: Usually faster (hours to 1 day)
   - Complex extensions may take longer

## Troubleshooting

### Build Errors

**Error: Missing manifest.json**
```bash
# Ensure you're in the extension-firefox directory
cd extension-firefox
npm run build
```

**Error: Invalid manifest**
```bash
# Validate manifest
npm run lint
```

### Signing Errors

**Error: API credentials not found**
```bash
# Set environment variables
set WEB_EXT_API_KEY=your_key
set WEB_EXT_API_SECRET=your_secret
```

**Error: Signing timeout**
```bash
# Increase timeout in web-ext-config.js
# Default is 900000ms (15 minutes)
```

### Installation Errors

**Error: Extension could not be installed**
- Ensure extension is signed (or signatures disabled in Developer Edition)
- Check Firefox version meets minimum requirement (109.0+)
- Verify manifest.json is valid

**Error: Extension ID conflict**
- Uninstall existing version first
- Clear Firefox extension cache
- Restart Firefox

## Security Best Practices

### API Credentials

**Never commit API credentials to version control**:
- Use environment variables
- Add `.env` to `.gitignore`
- Use CI/CD secrets for automated builds

### Code Signing

- Always sign extensions before distribution
- Use listed distribution for public releases
- Use unlisted distribution for beta testing only

### Privacy

- Document all permissions in store listing
- Explain why each permission is needed
- Follow Mozilla's privacy policy requirements

## Continuous Integration

### GitHub Actions Example

```yaml
name: Build and Sign Firefox Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd extension-firefox
          npm install
      
      - name: Build extension
        run: |
          cd extension-firefox
          npm run build:prod
      
      - name: Sign extension
        env:
          WEB_EXT_API_KEY: ${{ secrets.FIREFOX_API_KEY }}
          WEB_EXT_API_SECRET: ${{ secrets.FIREFOX_API_SECRET }}
        run: |
          cd extension-firefox
          npm run sign
      
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: firefox-extension
          path: extension-firefox/web-ext-artifacts/*.xpi
```

## Resources

- **Mozilla Extension Workshop**: https://extensionworkshop.com/
- **web-ext Documentation**: https://extensionworkshop.com/documentation/develop/web-ext-command-reference/
- **Firefox Add-ons Policies**: https://extensionworkshop.com/documentation/publish/add-on-policies/
- **Manifest V2 Documentation**: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json

## Support

For issues with packaging or distribution:
- Check Mozilla's Extension Workshop
- Visit Firefox Add-ons Developer Forum
- Contact Mozilla Add-ons team via developer hub
