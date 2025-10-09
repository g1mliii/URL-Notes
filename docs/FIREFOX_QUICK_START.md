# Firefox Extension Quick Start Guide

## 🚀 Getting Started

### 1. Install Firefox Developer Edition
```bash
# Download from: https://www.mozilla.org/en-US/firefox/developer/
# Or use package manager (Windows):
winget install Mozilla.Firefox.DeveloperEdition
```

### 2. Install Dependencies (Already Done)
```bash
npm install --global web-ext  # ✅ Already installed (v8.10.0)
```

### 3. Start Development
```bash
cd extension-firefox
npm run dev
```

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Launch Firefox with extension loaded |
| `npm run build` | Create distribution package |
| `npm run lint` | Validate extension code |
| `npm run test` | Open debugging interface |

## 🔍 Testing Checklist

### Basic Functionality
- [ ] Extension loads without errors
- [ ] Popup opens (400x600px)
- [ ] Notes can be created/edited
- [ ] Local storage works
- [ ] Context menus appear

### Firefox-Specific
- [ ] WebExtensions APIs work
- [ ] No console errors
- [ ] UI renders correctly
- [ ] Performance is acceptable

## 📁 Directory Structure ✅

```
extension-firefox/
├── manifest.json          ✅ Firefox-compatible
├── popup/                 ✅ UI components
├── background/            ✅ Service worker
├── content/               ✅ Content scripts
├── lib/                   ✅ Core libraries
├── assets/                ✅ Icons and resources
├── package.json           ✅ Development config
├── web-ext-config.js      ✅ Firefox settings
└── test-firefox-setup.js  ✅ Validation script
```

## 🎯 Next Steps

1. **Install Firefox Developer Edition**
2. **Run `npm run dev` to test**
3. **Proceed with Firefox-specific development tasks**

## 🆘 Need Help?

- Check [Firefox Development Guide](FIREFOX_DEVELOPMENT.md) for detailed instructions
- Run `node test-firefox-setup.js` to validate setup
- Visit Firefox WebExtensions documentation