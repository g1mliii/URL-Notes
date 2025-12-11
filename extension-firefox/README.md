# Firefox Extension

This directory contains the Firefox version of the Anchored browser extension.

## Quick Setup

1. Install Firefox Developer Edition
2. Install web-ext CLI: `npm install --global web-ext`
3. Run development server: `npm run dev`

## Firefox vs Chrome

Firefox uses WebExtensions APIs (`browser.*` namespace) instead of Chrome APIs (`chrome.*`), requiring API migration and Manifest V2 instead of V3.

## Development Commands

- `npm run dev` - Launch Firefox with extension loaded
- `npm run build` - Create distribution package
- `npm run lint` - Validate extension code
- `npm run test` - Open debugging interface

## Testing

Run `node test-firefox-setup.js` to validate the development environment setup.

For build instructions, see `BUILD_INSTRUCTIONS.md`.
For packaging and distribution, see `PACKAGING.md`.
