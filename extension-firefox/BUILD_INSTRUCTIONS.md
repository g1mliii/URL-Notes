# Firefox Extension Build Instructions

## Overview

Anchored Firefox extension is built with vanilla JavaScript and requires no transpilation or bundling. The extension runs directly in the browser without any code generation or minification of source files.

## System Requirements

- **Node.js:** 16.0 or higher
- **npm:** 7.0 or higher
- **Operating System:** Windows, macOS, or Linux
- **Firefox:** 109.0 or higher

## Installation Instructions

### 1. Install Node.js and npm

- Download and install Node.js from https://nodejs.org/ (LTS version recommended)
- npm is included with Node.js
- Verify installation:
  ```bash
  node --version
  npm --version
  ```

### 2. Install Build Dependencies

```bash
cd extension-firefox
npm install
```

This installs web-ext CLI and linting tools only. No other dependencies are built into the extension.

## Build Process

### Build for Testing (Development)

```bash
npm run build
```

This creates an unsigned `.zip` file in `web-ext-artifacts/` directory.

### Build for Firefox Add-ons Store (Production)

```bash
npm run build:prod
```

This runs linting first, then creates the package.

### Validation/Linting

```bash
npm run validate
```

This validates the manifest and code structure according to Firefox WebExtensions standards.

## Distribution Package

The build process creates a `.zip` file containing:

```
extension-firefox/
├── manifest.json          (Extension configuration)
├── background/
│   └── background.js      (Service worker)
├── content/
│   ├── content.js         (Content script)
│   └── content.css        (Content styles)
├── popup/
│   ├── popup.html         (Popup UI)
│   ├── popup.js           (Popup controller)
│   ├── popup.css          (Popup styles)
│   ├── dialog.css         (Dialog styles)
│   └── modules/           (Feature modules)
├── lib/
│   ├── storage.js         (IndexedDB wrapper)
│   ├── sync.js            (Supabase sync)
│   ├── encryption.js      (AES-256-GCM encryption)
│   ├── api.js             (Supabase client)
│   ├── browser-api.js     (Cross-browser API abstraction)
│   ├── dompurify.min.js   (XSS sanitization - third-party)
│   └── [other libraries]
└── assets/
    └── icons/             (Extension icons)
```

## Source Code Notes

- **No transpilation:** All JavaScript is ES6+ vanilla JavaScript
- **No bundling:** No webpack, rollup, or similar tools
- **No minification:** Source files are readable and unminified
- **Third-party library:** `dompurify.min.js` is an open-source third-party library (included as-is)
- **No code generation:** No templates or generators are used

## Verification Steps

To verify the build is correct:

1. **Run validation:**
   ```bash
   npm run validate
   ```

2. **Check file structure:**
   ```bash
   unzip web-ext-artifacts/anchored-firefox-*.zip -l
   ```

3. **Verify manifest is valid JSON:**
   ```bash
   cat manifest.json | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf-8')))"
   ```

## Installation for Testing

1. Build the extension:
   ```bash
   npm run build
   ```

2. Rename the `.zip` to `.xpi`:
   ```bash
   mv web-ext-artifacts/anchored-firefox-*.zip web-ext-artifacts/anchored-firefox-1.55.xpi
   ```

3. Open Firefox and go to `about:debugging#/runtime/this-firefox`

4. Click "Load Temporary Add-on" and select the `.xpi` file

## Troubleshooting

- **npm not found:** Ensure Node.js is installed and added to PATH
- **Validation errors:** Run `npm run validate` to see issues
- **Module not found:** Run `npm install` again to ensure dependencies are installed

## Version Information

- **Current Version:** 1.55
- **Manifest Version:** 3
- **Firefox Minimum:** 109.0
- **Last Updated:** December 2024

## Support

For issues or questions:
- Email: support@anchored.site
- Website: https://anchored.site
