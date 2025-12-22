# Firefox Extension - Anchored

Browser extension for domain/URL-specific note-taking with zero-knowledge encryption.

## Quick Start

```bash
npm install
npm run build
```

## System Requirements

- Node.js 16+
- npm 7+
- Firefox 109+

## Development Commands

- `npm install` - Install web-ext CLI and development tools
- `npm run build` - Create distribution package (development)
- `npm run build:prod` - Build with linting (production)
- `npm run validate` - Validate extension code
- `npm run dev` - Launch Firefox with extension loaded
- `npm run lint` - Run ESLint validation
- `npm run test` - Open debugging interface

## Build Instructions

For detailed build instructions, system requirements, and verification steps, see [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md).

## Extension Details

- **Manifest Version:** 3
- **Minimum Firefox Version:** 109.0
- **No Build Tools:** Vanilla JavaScript, no webpack/rollup/transpilation
- **No Third-Party Code in Extension:** Only open-source DOMPurify for XSS protection

## Files and Structure

- `manifest.json` - Extension configuration
- `background/background.js` - Service worker
- `content/` - Content scripts
- `popup/` - Popup UI and modules
- `lib/` - Core libraries (storage, sync, encryption, APIs)
- `assets/` - Icons and resources

## Features

- Local-first note storage (IndexedDB)
- Cloud sync with Supabase (encrypted)
- AES-256-GCM encryption
- Domain and page-specific notes
- Rich text editing
- Zero-knowledge architecture

## Support

- Website: https://anchored.site
- Email: support@anchored.site
- Repository: https://github.com/g1mliii/URL-Notes

## License

Proprietary - Anchored
