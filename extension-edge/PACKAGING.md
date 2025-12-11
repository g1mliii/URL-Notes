# Edge Extension Packaging Guide

## Overview

Edge uses the same Chromium engine as Chrome, so the extension structure and manifest are identical.

## Packaging Process

### Manual Zip (Recommended)

1. Open the `extension-edge` folder in File Explorer
2. Select all files and folders EXCEPT:
   - `package-edge.js`
   - `package-edge.ps1`
   - `test-edge-setup.js`
   - `README.md`
   - `PACKAGING.md`
3. Right-click > "Send to" > "Compressed (zipped) folder"
4. Rename to `anchored-edge-extension-v{version}.zip`

### Using Scripts (Optional)

PowerShell:
```bash
cd extension-edge
powershell -ExecutionPolicy Bypass -File .\package-edge.ps1
```

Node.js:
```bash
cd extension-edge
npm install archiver
node package-edge.js
```

## Testing the Package

1. Open Edge and navigate to `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension-edge` directory
5. Test all functionality

## Distribution

### Microsoft Edge Add-ons Submission

1. Create Partner Center account at https://partner.microsoft.com/dashboard
2. Prepare store listing (can reuse Chrome Web Store materials)
3. Upload the `.zip` file
4. Set privacy policy URL: https://anchored.site/privacy.html
5. Submit for review (typically 1-3 business days)

### Update Process

1. Increment version in `manifest.json`
2. Create new `.zip` package
3. Upload to Partner Center
4. Submit for review

## Troubleshooting

- **Package too large**: Edge has a 100MB limit
- **Manifest errors**: Run validation in Edge DevTools
- **Extension not loading**: Check manifest.json syntax

## Resources

- Edge Add-ons Dashboard: https://partner.microsoft.com/dashboard
- Edge Extension Docs: https://docs.microsoft.com/microsoft-edge/extensions-chromium/
