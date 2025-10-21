# Build Instructions for Anchored Firefox Extension

## Overview
This extension uses **no build process**. All source code is unminified and ready to use directly.

## Third-Party Libraries
The only minified file is:
- **DOMPurify 3.0.5** (`lib/dompurify.min.js`)
  - Official release: https://github.com/cure53/DOMPurify/releases/tag/3.0.5
  - Direct download: https://cdn.jsdelivr.net/npm/dompurify@3.0.5/dist/purify.min.js
  - License: Apache 2.0 / MPL 2.0
  - Purpose: XSS prevention and HTML sanitization

## Build Steps

### Prerequisites
- None required (no build tools needed)

### Instructions
1. The extension is ready to use as-is
2. All files in the submission are the actual source files
3. No compilation, transpilation, or bundling is performed

### To Test Locally
```bash
# Install web-ext (optional, for testing)
npm install -g web-ext

# Run in Firefox
web-ext run --source-dir .
```

### To Create Distribution Package
```bash
# Simply zip the following directories and files:
# - assets/
# - background/
# - content/
# - lib/
# - popup/
# - manifest.json
# - onboarding.html

# On Windows PowerShell:
Compress-Archive -Path assets,background,content,lib,popup,manifest.json,onboarding.html -DestinationPath anchored-firefox.zip

# On Linux/Mac:
zip -r anchored-firefox.zip assets background content lib popup manifest.json onboarding.html
```

## File Structure
```
extension-firefox/
├── assets/           # Icons and images (unmodified)
├── background/       # Background scripts (unminified)
├── content/          # Content scripts (unminified)
├── lib/              # Libraries including DOMPurify
├── popup/            # Popup UI and modules (unminified)
├── manifest.json     # Extension manifest
└── onboarding.html   # Onboarding page
```

## Verification
All JavaScript files except `lib/dompurify.min.js` are human-readable source code.
You can verify DOMPurify by comparing the SHA-256 hash with the official release.

## Notes
- No Node.js required
- No npm packages required
- No build tools required
- Extension runs directly from source files
