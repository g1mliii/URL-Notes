# Design Document

## Overview

The Firefox Extension Migration project transforms the existing Chrome-based Anchored extension into a Firefox-compatible version using WebExtensions APIs. This migration maintains complete feature parity while adapting to Firefox's specific extension architecture, security model, and API differences.

The design follows a browser-agnostic approach where possible, with Firefox-specific adaptations isolated to minimize code duplication. The extension maintains the same glassmorphism UI, local-first architecture, and zero-knowledge encryption while leveraging Firefox's WebExtensions standard.

## Architecture

### Browser API Abstraction Layer

**API Compatibility Bridge**
```javascript
// browser-api.js - Unified API layer
const browserAPI = {
  storage: {
    local: {
      get: (keys) => browser.storage.local.get(keys),
      set: (items) => browser.storage.local.set(items),
      remove: (keys) => browser.storage.local.remove(keys)
    }
  },
  tabs: {
    query: (queryInfo) => browser.tabs.query(queryInfo),
    create: (createProperties) => browser.tabs.create(createProperties)
  },
  runtime: {
    sendMessage: (message) => browser.runtime.sendMessage(message),
    onMessage: browser.runtime.onMessage
  }
};
```

**Chrome vs Firefox API Differences**
- Chrome uses `chrome.*` namespace, Firefox uses `browser.*`
- Firefox requires explicit promise handling for async operations
- Firefox has stricter Content Security Policy enforcement
- Firefox background scripts use different lifecycle patterns

### Manifest Adaptation Strategy

**Manifest V2 for Firefox Compatibility**
```json
{
  "manifest_version": 2,
  "name": "Anchored - URL Notes",
  "version": "1.0.0",
  "description": "Take notes on any website with domain/URL organization",
  
  "permissions": [
    "storage",
    "activeTab",
    "tabs",
    "contextMenus",
    "alarms"
  ],
  
  "background": {
    "scripts": ["lib/browser-api.js", "background/background.js"],
    "persistent": false
  },
  
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["lib/browser-api.js", "content/content.js"]
  }],
  
  "browser_action": {
    "default_popup": "popup/popup.html",
    "default_title": "Anchored Notes",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  }
}
```

**Key Manifest Differences**
- Firefox uses `browser_action` instead of `action` (Manifest V3)
- Background scripts array instead of service worker
- Different permission handling for host permissions
- Firefox-specific CSP requirements

### Storage Architecture

**IndexedDB Compatibility Layer**
```javascript
// storage-firefox.js - Firefox-specific storage adapter
class FirefoxStorageAdapter {
  constructor() {
    this.dbName = 'anchored-notes';
    this.version = 1;
  }
  
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Same schema as Chrome version
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('domain', 'domain', { unique: false });
          notesStore.createIndex('url', 'url', { unique: false });
          notesStore.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
  }
}
```

**Storage Quota Management**
- Firefox has different storage quota limits than Chrome
- Implement graceful degradation when quota is exceeded
- Use same cleanup strategies as Chrome version
- Monitor storage usage with Firefox-specific APIs

### Background Script Architecture

**Event-Driven Background Page**
```javascript
// background/background-firefox.js
class FirefoxBackgroundManager {
  constructor() {
    this.setupEventListeners();
    this.initializeAlarms();
  }
  
  setupEventListeners() {
    // Context menu creation
    browser.runtime.onInstalled.addListener(() => {
      this.createContextMenus();
    });
    
    // Message handling from popup/content scripts
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.handleMessage(message, sender);
    });
    
    // Alarm handling for sync operations
    browser.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });
  }
  
  async handleMessage(message, sender) {
    switch (message.type) {
      case 'SYNC_NOTES':
        return await this.syncNotes();
      case 'GET_CURRENT_TAB':
        return await this.getCurrentTab();
      default:
        return { error: 'Unknown message type' };
    }
  }
}
```

**Sync Engine Adaptation**
- Reuse existing sync logic from Chrome version
- Adapt network request handling for Firefox's fetch API
- Maintain same encryption and data format
- Handle Firefox-specific network security restrictions

### UI Component Adaptations

**Popup Interface Compatibility**
```css
/* popup-firefox.css - Firefox-specific styles */
.popup-container {
  width: 400px;
  height: 600px;
  /* Firefox-specific font rendering adjustments */
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: "liga" 1;
}

/* Firefox scrollbar styling */
.notes-list {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

/* Firefox-specific glassmorphism adjustments */
.glass-panel {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px); /* Fallback */
}
```

**Content Script Integration**
```javascript
// content/content-firefox.js
class FirefoxContentScript {
  constructor() {
    this.initializeContentScript();
  }
  
  initializeContentScript() {
    // Firefox-specific DOM ready handling
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupPageIntegration();
      });
    } else {
      this.setupPageIntegration();
    }
  }
  
  setupPageIntegration() {
    // Same functionality as Chrome version
    // Adapted for Firefox's content script security model
    this.injectNoteIndicators();
    this.setupKeyboardShortcuts();
  }
}
```

## Components and Interfaces

### Browser Compatibility Layer

**Unified API Interface**
- Abstract browser-specific APIs behind common interface
- Handle promise vs callback differences between browsers
- Provide fallbacks for unsupported features
- Maintain consistent error handling across browsers

**Permission Management**
- Map Chrome permissions to Firefox equivalents
- Handle Firefox's more granular permission system
- Implement runtime permission requests where needed
- Provide clear user messaging for permission requirements

### Data Migration Strategy

**Cross-Browser Data Compatibility**
```javascript
// migration/firefox-migration.js
class FirefoxMigrationManager {
  async migrateFromChrome() {
    // Check if Chrome extension data exists
    const chromeData = await this.detectChromeData();
    
    if (chromeData) {
      // Import Chrome extension data
      await this.importChromeNotes(chromeData.notes);
      await this.importChromeSettings(chromeData.settings);
      
      // Verify data integrity
      await this.verifyMigration();
    }
  }
  
  async detectChromeData() {
    // Attempt to read Chrome extension storage
    // Handle cross-browser storage access limitations
  }
}
```

**Encryption Compatibility**
- Use identical encryption algorithms and parameters
- Maintain same key derivation process (PBKDF2)
- Ensure encrypted data is interchangeable between browsers
- Handle browser-specific crypto API differences

### Testing Framework

**Firefox-Specific Testing**
```javascript
// tests/firefox-tests.js
class FirefoxTestSuite {
  async runCompatibilityTests() {
    await this.testStorageOperations();
    await this.testBackgroundScriptFunctionality();
    await this.testContentScriptInjection();
    await this.testPopupRendering();
    await this.testSyncOperations();
  }
  
  async testStorageOperations() {
    // Test Firefox IndexedDB implementation
    // Verify data persistence across browser restarts
    // Test storage quota handling
  }
}
```

**Cross-Browser Validation**
- Automated testing across Firefox versions (ESR, stable, beta)
- Performance benchmarking against Chrome version
- UI consistency validation across browsers
- Sync compatibility testing between Chrome and Firefox

## Data Models

### Browser-Agnostic Data Structures

**Note Model (Unchanged)**
```javascript
{
  id: "uuid",
  title: "string",
  content: "string", 
  url: "string",
  domain: "string",
  tags: ["string"],
  created_at: "timestamp",
  updated_at: "timestamp",
  version: "number",
  is_deleted: "boolean"
}
```

**Settings Model (Firefox Adaptations)**
```javascript
{
  // Same core settings as Chrome
  theme: "light|dark|auto",
  sync_enabled: "boolean",
  auto_save: "boolean",
  
  // Firefox-specific settings
  firefox_permissions_granted: "boolean",
  firefox_storage_quota_warning: "boolean",
  firefox_sync_method: "background|manual"
}
```

### Storage Schema Compatibility

**IndexedDB Schema (Identical to Chrome)**
- Same object stores and indexes
- Identical data validation rules
- Compatible encryption format
- Consistent versioning strategy

## Error Handling

### Firefox-Specific Error Scenarios

**Extension Loading Errors**
- Handle Firefox's stricter manifest validation
- Provide clear error messages for permission issues
- Handle CSP violations gracefully
- Manage Firefox's extension update process

**Storage Errors**
- Handle Firefox's storage quota differently than Chrome
- Manage IndexedDB transaction failures
- Handle browser.storage.local quota limits
- Provide user feedback for storage issues

**Network Errors**
- Handle Firefox's CORS restrictions
- Manage different network security policies
- Handle offline scenarios consistently
- Provide retry mechanisms for failed sync operations

### Cross-Browser Error Consistency

**Unified Error Handling**
```javascript
// error-handler-firefox.js
class FirefoxErrorHandler {
  handleStorageError(error) {
    // Map Firefox storage errors to common error types
    // Provide consistent user messaging
    // Log Firefox-specific error details for debugging
  }
  
  handleNetworkError(error) {
    // Handle Firefox network restrictions
    // Provide appropriate user feedback
    // Implement Firefox-compatible retry logic
  }
}
```

## Security Considerations

### Firefox Security Model

**Content Security Policy**
- Adapt to Firefox's stricter CSP enforcement
- Handle inline script restrictions
- Manage resource loading limitations
- Ensure glassmorphism CSS works within CSP constraints

**Permission Security**
- Use minimal required permissions for Firefox
- Handle runtime permission requests appropriately
- Provide clear permission explanations to users
- Implement graceful degradation for denied permissions

**Data Protection**
- Maintain same zero-knowledge encryption architecture
- Use Firefox's secure storage mechanisms
- Handle Firefox's private browsing mode appropriately
- Ensure data isolation between browser profiles

### Cross-Browser Security Consistency

**Encryption Compatibility**
- Use identical encryption algorithms across browsers
- Maintain same key derivation parameters
- Ensure encrypted data format compatibility
- Handle browser-specific crypto API differences

## Performance Optimization

### Firefox-Specific Optimizations

**Memory Management**
- Optimize for Firefox's memory usage patterns
- Handle Firefox's garbage collection differently
- Manage extension lifecycle efficiently
- Monitor Firefox-specific performance metrics

**Rendering Performance**
- Optimize glassmorphism effects for Firefox's rendering engine
- Handle Firefox's font rendering differences
- Optimize CSS for Firefox's layout engine
- Ensure smooth animations in Firefox

**Storage Performance**
- Optimize IndexedDB operations for Firefox
- Handle Firefox's storage I/O patterns
- Implement efficient caching strategies
- Monitor Firefox storage performance

### Cross-Browser Performance Parity

**Benchmarking Strategy**
- Maintain performance parity with Chrome version
- Monitor popup load times across browsers
- Track search performance consistency
- Measure sync operation efficiency

## Migration Timeline

### Phase 1: Core API Migration (Week 1-2)
- Implement browser API abstraction layer
- Adapt manifest.json for Firefox
- Update storage operations for WebExtensions
- Test basic extension loading and functionality

### Phase 2: UI and UX Adaptation (Week 3-4)
- Adapt popup interface for Firefox rendering
- Test glassmorphism effects in Firefox
- Implement Firefox-specific CSS adjustments
- Validate responsive design across Firefox versions

### Phase 3: Background Script Migration (Week 5-6)
- Adapt background script architecture
- Implement Firefox-compatible sync engine
- Test context menu and alarm functionality
- Validate message passing between scripts

### Phase 4: Testing and Optimization (Week 7-8)
- Comprehensive Firefox testing across versions
- Performance optimization and benchmarking
- Cross-browser compatibility validation
- User acceptance testing with Firefox users

### Phase 5: Safari Planning (Week 9-10)
- Document Safari WebExtensions requirements
- Plan Safari-specific API adaptations
- Design three-browser architecture strategy
- Prepare Safari migration specification