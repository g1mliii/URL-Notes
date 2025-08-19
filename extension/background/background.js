// URL Notes Extension - Background Script (Service Worker)

// --- Main Event Listeners ---

// Extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  console.log('onInstalled reason:', details.reason);
  setupContextMenus();
  
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
  }
  
  // Always update uninstall URL on install/update
  updateUninstallUrl();
});

// Handle extension icon click to open the side panel
chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  } else {
    console.log('Side Panel API not available in this Chrome version.');
  }
});

// Ensure context menus exist on browser startup (service worker cold start)
chrome.runtime.onStartup.addListener(() => {
  console.log('onStartup: ensuring context menus are created');
  setupContextMenus();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addSelectionToNewNote') {
    addSelectionToNewNote(info, tab);
  } else if (info.menuItemId === 'addSelectionToExistingNote') {
    addSelectionToExistingNote(info, tab);
  }
});

// Update uninstall URL and handle settings changes whenever local storage is modified
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.settings) {
      handleSettingsChange(changes.settings.oldValue, changes.settings.newValue);
    }
    updateUninstallUrl();
  }
});


// --- Feature Implementations ---

// Setup context menus for text selection
function setupContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'addSelectionToNewNote',
        title: 'URL Notes: Add to new note',
        contexts: ['selection']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Context menu create error:', chrome.runtime.lastError.message);
        } else {
          console.log('Context menu (new note) created');
        }
      });
      // Add to existing note
      chrome.contextMenus.create({
        id: 'addSelectionToExistingNote',
        title: 'URL Notes: Add to existing note',
        contexts: ['selection']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Existing-note menu create error:', chrome.runtime.lastError.message);
        } else {
          console.log('Context menu (existing note) created');
        }
      });
    });
  } catch (e) {
    console.warn('setupContextMenus failed:', e);
  }
}

// Also attempt creation immediately in case onInstalled/onStartup didn't fire yet
setupContextMenus();

// Function to handle adding selected text to a new note
async function addSelectionToNewNote(info, tab) {
  const { selectionText, pageUrl } = info;
  const { title, favIconUrl } = tab;
  const domain = new URL(pageUrl).hostname;

  // 1. Prepare display text and Text Fragment URL
  const parts = getClipParts(selectionText, pageUrl);
  if (!parts) {
    console.warn('No selection text found for context menu action');
    return;
  }
  const { displayText, fragmentUrl } = parts;

  // 2. Create the note content (single clickable anchor)
  const noteContent = `- [${displayText}](${fragmentUrl})`;

  // 3. Create the new note object
  const newNote = {
    id: `note_${Date.now()}`,
    url: pageUrl,
    domain: domain,
    title: title || 'Untitled',
    favicon: favIconUrl,
    content: noteContent,
    tags: ['clipping'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 4. Save the note to storage
  try {
    const data = await chrome.storage.local.get(domain);
    const notes = data[domain] || [];
    notes.push(newNote);
    await chrome.storage.local.set({ [domain]: notes });
    console.log('New note saved from selection:', newNote);

    // 5. Open the extension UI to show the result
    openExtensionUi();

  } catch (error) {
    console.error('Failed to save new note from selection:', error);
  }
}

// Function: append selection to most recently updated note for this domain
async function addSelectionToExistingNote(info, tab) {
  const { selectionText, pageUrl } = info;
  const domain = new URL(pageUrl).hostname;
  const parts = getClipParts(selectionText, pageUrl);
  if (!parts) return;
  const { displayText, fragmentUrl } = parts;
  const bullet = `- [${displayText}](${fragmentUrl})`;

  try {
    const data = await chrome.storage.local.get(domain);
    const notes = (data[domain] || []).slice();
    if (notes.length === 0) {
      // No existing note for this domain; fallback to creating a new one
      return addSelectionToNewNote(info, tab);
    }
    // Pick most recently updated
    notes.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    const target = notes[0];
    target.content = (target.content ? `${target.content}\n` : '') + bullet;
    target.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [domain]: notes });
    console.log('Appended selection to existing note:', target.id);
    openExtensionUi();
  } catch (e) {
    console.error('Failed to append to existing note:', e);
  }
}

// Helpers
// Build display text and fragment link consistently
function getClipParts(selectionText, pageUrl) {
  const raw = (selectionText || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const maxWords = 8;
  const words = raw.split(' ');
  const short = words.slice(0, maxWords).join(' ');
  const truncated = words.length > maxWords;
  // Add leading/trailing ellipses if we truncated
  const displayText = `${truncated ? '… ' : ''}${short}${truncated ? ' …' : ''}`;
  const fragmentUrl = `${pageUrl}#:~:text=${encodeURIComponent(short)}`;
  return { displayText, fragmentUrl };
}

function openExtensionUi() {
  // Prefer opening the action popup (Chrome >= MV3). This keeps UX in the same window.
  if (chrome.action && chrome.action.openPopup) {
    chrome.action.openPopup().catch(() => {
      // Fallback to Side Panel if available
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({}).catch(() => {
          // Final fallback: open the popup page in a new tab
          const url = chrome.runtime.getURL('popup/popup.html');
          chrome.tabs.create({ url }).catch(() => {});
        });
      } else {
        const url = chrome.runtime.getURL('popup/popup.html');
        chrome.tabs.create({ url }).catch(() => {});
      }
    });
  } else if (chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({}).catch(() => {
      const url = chrome.runtime.getURL('popup/popup.html');
      chrome.tabs.create({ url }).catch(() => {});
    });
  } else {
    const url = chrome.runtime.getURL('popup/popup.html');
    chrome.tabs.create({ url }).catch(() => {});
  }
}


// --- Utility and Maintenance Functions (largely unchanged) ---

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'contentScriptReady':
      handleContentScriptReady(request.pageInfo, sender.tab);
      break;
    case 'urlChanged':
      handleUrlChange(request.pageInfo, sender.tab);
      break;
    case 'getPageInfo':
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

function handleContentScriptReady(pageInfo, tab) {
  chrome.storage.session.set({ [`pageInfo_${tab.id}`]: { ...pageInfo, tabId: tab.id, timestamp: Date.now() } });
}

function handleUrlChange(pageInfo, tab) {
  chrome.storage.session.set({ [`pageInfo_${tab.id}`]: { ...pageInfo, tabId: tab.id, timestamp: Date.now() } });
  chrome.runtime.sendMessage({ action: 'pageInfoUpdated', pageInfo: pageInfo, tabId: tab.id }).catch(() => {});
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`pageInfo_${tabId}`);
});

chrome.alarms.create('cleanup', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') performCleanup();
});

async function performCleanup() {
  try {
    const sessionData = await chrome.storage.session.get();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const keysToRemove = Object.keys(sessionData).filter(key => key.startsWith('pageInfo_') && sessionData[key].timestamp < oneHourAgo);
    if (keysToRemove.length > 0) {
      await chrome.storage.session.remove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} old session entries`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

function handleSettingsChange(oldSettings, newSettings) {
  console.log('Settings changed:', { oldSettings, newSettings });
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsChanged', settings: newSettings }).catch(() => {});
    });
  });
}

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
  updateUninstallUrl();
});

async function updateUninstallUrl() {
  try {
    const all = await chrome.storage.local.get(null);
    const json = JSON.stringify(all);
    const bytes = new TextEncoder().encode(json).length;
    let noteCount = 0;
    for (const v of Object.values(all)) {
      if (Array.isArray(v)) {
        noteCount += v.length;
      } else if (typeof v === 'object' && v !== null && Array.isArray(v.notes)) {
        noteCount += v.notes.length;
      }
    }

    const params = new URLSearchParams({
      notes: String(noteCount),
      localBytes: String(bytes),
    });

    const uninstallUrl = `https://example.com/uninstall?${params.toString()}`;
    chrome.runtime.setUninstallURL(uninstallUrl);
  } catch (e) {
    console.warn('Failed to set uninstall URL:', e);
  }
}
