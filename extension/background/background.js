// URL Notes Extension - Background Script (Service Worker)

// Extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('URL Notes extension installed');
    // Set default settings
    chrome.storage.local.set({
      settings: {
        theme: 'auto',
        defaultMode: 'domain',
        autoSave: true,
        showAds: true
      }
    });
  } else if (details.reason === 'update') {
    console.log('URL Notes extension updated');
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'contentScriptReady':
      // Content script is ready, store page info if needed
      handleContentScriptReady(request.pageInfo, sender.tab);
      break;
      
    case 'urlChanged':
      // URL changed in SPA, update page info
      handleUrlChange(request.pageInfo, sender.tab);
      break;
      
    case 'getPageInfo':
      // Popup requesting page info
      if (sender.tab) {
        sendResponse({
          domain: new URL(sender.tab.url).hostname,
          url: sender.tab.url,
          title: sender.tab.title,
          favicon: sender.tab.favIconUrl
        });
      }
      break;
      
    default:
      console.log('Unknown action:', request.action);
  }
  
  return true; // Keep message channel open for async responses
});

// Handle content script ready
function handleContentScriptReady(pageInfo, tab) {
  // Store recent page info for quick access
  chrome.storage.session.set({
    [`pageInfo_${tab.id}`]: {
      ...pageInfo,
      tabId: tab.id,
      timestamp: Date.now()
    }
  });
}

// Handle URL changes in SPAs
function handleUrlChange(pageInfo, tab) {
  // Update stored page info
  chrome.storage.session.set({
    [`pageInfo_${tab.id}`]: {
      ...pageInfo,
      tabId: tab.id,
      timestamp: Date.now()
    }
  });
  
  // Notify popup if it's open
  chrome.runtime.sendMessage({
    action: 'pageInfoUpdated',
    pageInfo: pageInfo,
    tabId: tab.id
  }).catch(() => {
    // Ignore errors if popup isn't open
  });
}

// Clean up session storage when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`pageInfo_${tabId}`);
});

// Handle extension icon click (fallback if popup fails)
chrome.action.onClicked.addListener((tab) => {
  // This shouldn't normally be called since we have a popup
  // But it's here as a fallback
  console.log('Extension icon clicked for tab:', tab.url);
});

// Periodic cleanup of old data
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    performCleanup();
  }
});

// Clean up old session data and perform maintenance
async function performCleanup() {
  try {
    // Clean up old session data
    const sessionData = await chrome.storage.session.get();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const keysToRemove = [];
    for (const [key, value] of Object.entries(sessionData)) {
      if (key.startsWith('pageInfo_') && value.timestamp < oneHourAgo) {
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.session.remove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} old session entries`);
    }
    
    // TODO: Add more cleanup tasks as needed
    // - Clean up old notes (soft deleted)
    // - Compress large note content
    // - Update search indexes
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  // React to storage changes if needed
  if (namespace === 'local') {
    // Local storage changed (notes, settings, etc.)
    for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
      if (key === 'settings') {
        handleSettingsChange(oldValue, newValue);
      }
    }
  }
});

// Handle settings changes
function handleSettingsChange(oldSettings, newSettings) {
  console.log('Settings changed:', { oldSettings, newSettings });
  
  // Notify all tabs about settings change
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'settingsChanged',
        settings: newSettings
      }).catch(() => {
        // Ignore errors for tabs without content scripts
      });
    });
  });
}

// Error handling
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker suspending...');
});

// Service worker lifecycle management for Manifest V3
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
});
