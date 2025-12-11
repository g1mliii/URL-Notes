# Firefox Extension Packaging Guide

## Prerequisites

1. Install web-ext CLI:
   ```bash
   cd extension-firefox
   npm install
   ```

2. Firefox Add-ons Account:
   - Create account at https://addons.mozilla.org/developers/
   - Generate API credentials at https://addons.mozilla.org/developers/addon/api/key/

## Building

Development build:
```bash
npm run build
```

Production build (includes linting):
```bash
npm run build:prod
```

Validation:
```bash
npm run validate
```

## Signing

Firefox requires all extensions to be signed for installation.

### Listed Distribution (Firefox Add-ons Store)

1. Set up API credentials:
   ```bash
   # Windows (CMD)
   set WEB_EXT_API_KEY=your_api_key_here
   set WEB_EXT_API_SECRET=your_api_secret_here

   # PowerShell
   $env:WEB_EXT_API_KEY="your_api_key_here"
   $env:WEB_EXT_API_SECRET="your_api_secret_here"
   ```

2. Sign the extension:
   ```bash
   npm run sign
   ```

3. Mozilla will review (typically 1-3 days)

### Unlisted Distribution (Self-Hosting)

```bash
npm run sign:unlisted
```

No review required, signed `.xpi` generated immediately.

## Installation

### Signed Extension

1. Download the signed `.xpi` file
2. Drag and drop into Firefox
3. Click "Add" when prompted

### Unsigned (Development Only)

1. Firefox Developer Edition: `about:config` > set `xpinstall.signatures.required` to `false`
2. `about:debugging#/runtime/this-firefox` > "Load Temporary Add-on"
3. Select the `.xpi` file

## Distribution Checklist

- Update version in manifest.json and package.json
- Run `npm run lint` and fix errors
- Test extension in Firefox
- Prepare store listing (can reuse Chrome materials)
- Submit to Firefox Add-ons Developer Hub

## Store Listing

- Extension Name: "Anchored - Notes & Highlights for Websites"
- Homepage: https://anchored.site
- Support email: support@anchored.site
- Privacy policy: https://anchored.site/privacy.html

## Troubleshooting

- **API credentials not found**: Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET environment variables
- **Signing timeout**: Increase timeout in web-ext-config.js
- **Extension won't install**: Check Firefox version (109.0+ required)

## Resources

- Mozilla Extension Workshop: https://extensionworkshop.com/
- web-ext Documentation: https://extensionworkshop.com/documentation/develop/web-ext-command-reference/
- Firefox Add-ons Policies: https://extensionworkshop.com/documentation/publish/add-on-policies/
