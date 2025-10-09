# Firefox Extension Development Workflow

## Prerequisites

1. **Firefox Developer Edition** (Recommended)
   - Download from: https://www.mozilla.org/en-US/firefox/developer/
   - Provides better debugging tools and extension development features

2. **web-ext CLI Tool** (Already installed)
   - Global installation: `npm install --global web-ext`
   - Version: 8.10.0

## Development Commands

### Start Development Server
```bash
cd extension-firefox
npm run dev
```
This will:
- Launch Firefox Developer Edition
- Load the extension automatically
- Enable auto-reload on file changes
- Open debugging tools

### Build Extension
```bash
cd extension-firefox
npm run build
```
Creates a distributable .zip file in `web-ext-artifacts/`

### Lint Extension
```bash
cd extension-firefox
npm run lint
```
Validates manifest.json and checks for common issues

### Test Extension
```bash
cd extension-firefox
npm run test
```
Launches Firefox with debugging page open

## Manual Testing Workflow

### Loading Extension Manually
1. Open Firefox
2. Navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select `extension-firefox/manifest.json`

### Debugging Steps
1. **Console Logging**: Check Browser Console (Ctrl+Shift+J)
2. **Extension Inspector**: Use "Inspect" button in about:debugging
3. **Background Script**: Debug in Extension Inspector
4. **Content Scripts**: Debug in regular DevTools on target pages
5. **Popup**: Right-click popup → "Inspect Element"

## Firefox-Specific Testing Areas

### Core Functionality
- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly (400x600px)
- [ ] Notes can be created, edited, and deleted
- [ ] Local storage works (IndexedDB)
- [ ] Domain/URL detection works correctly

### Browser API Compatibility
- [ ] `browser.storage.local` operations
- [ ] `browser.tabs.query` functionality
- [ ] `browser.runtime.sendMessage` communication
- [ ] Context menu creation and handling
- [ ] Alarm/timer functionality

### UI/UX Testing
- [ ] Glassmorphism effects render correctly
- [ ] Font rendering matches design
- [ ] Responsive layout works
- [ ] Keyboard shortcuts function
- [ ] Animations are smooth

### Performance Testing
- [ ] Popup loads within 200ms
- [ ] Local search responds within 100ms
- [ ] Memory usage stays reasonable
- [ ] No console errors or warnings

## Troubleshooting

### Common Issues
1. **Extension won't load**: Check manifest.json syntax
2. **API errors**: Verify WebExtensions API usage
3. **Storage issues**: Check IndexedDB permissions
4. **UI rendering**: Verify CSS compatibility with Firefox

### Debug Tools
- **Browser Console**: `Ctrl+Shift+J`
- **Extension Inspector**: about:debugging → Inspect
- **Network Monitor**: F12 → Network tab
- **Storage Inspector**: F12 → Storage tab

## Firefox Version Testing

Test across these Firefox versions:
- **ESR (Extended Support Release)**: Minimum supported version
- **Stable**: Current stable release
- **Beta**: Upcoming features testing
- **Developer Edition**: Latest development features

## Performance Monitoring

Monitor these metrics:
- Extension startup time
- Popup render time
- Memory usage
- Storage operation speed
- Network request performance