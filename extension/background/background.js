// Keyboard shortcuts
try {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'create_new_note') {
      try {
        // Flag for popup to open new note immediately
        await chrome.storage.local.set({ lastAction: { type: 'new_note', ts: Date.now() } });
        // Open the popup (command is a user gesture, permitted)
        if (chrome.action && chrome.action.openPopup) {
          await chrome.action.openPopup();
        }
      } catch (e) {
      }
    }
  });
} catch (_) { /* noop */ }

// Open onboarding page on first install
try {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      const url = chrome.runtime.getURL('onboarding.html');
      chrome.tabs.create({ url });
    }
  });
} catch (_) { /* noop */ }


chrome.runtime.onInstalled.addListener(async (details) => {
  setupContextMenus();

  if (details.reason === 'install') {
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


  updateUninstallUrl();
});


chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});


setupContextMenus();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addSelectionToNewNote') {
    addSelectionToNewNote(info, tab);
  } else if (info.menuItemId === 'addSelectionToExistingNote') {
    addSelectionToExistingNote(info, tab);
  } else if (info.menuItemId === 'toggleMultiHighlightMode') {
    toggleMultiHighlightModeFromContextMenu(tab);
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.settings) {
      handleSettingsChange(changes.settings.oldValue, changes.settings.newValue);
    }
    updateUninstallUrl();
  }
});


function setupContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      // Create a parent menu for Anchored
      chrome.contextMenus.create({
        id: 'urlNotesParent',
        title: 'Anchored',
        contexts: ['selection', 'page']
      }, () => {
        if (chrome.runtime.lastError) {
          // Parent menu create error - silently handled
        }
      });

      // Add to new note (only when text is selected)
      chrome.contextMenus.create({
        id: 'addSelectionToNewNote',
        title: 'Add to new note',
        contexts: ['selection'],
        parentId: 'urlNotesParent'
      }, () => {
        if (chrome.runtime.lastError) {
          // Context menu create error - silently handled
        }
      });

      // Add to existing note (only when text is selected)
      chrome.contextMenus.create({
        id: 'addSelectionToExistingNote',
        title: 'Add to existing note',
        contexts: ['selection'],
        parentId: 'urlNotesParent'
      }, () => {
        if (chrome.runtime.lastError) {
 
        }
      });

      // Add separator
      chrome.contextMenus.create({
        id: 'separator1',
        type: 'separator',
        contexts: ['selection', 'page'],
        parentId: 'urlNotesParent'
      }, () => {
        if (chrome.runtime.lastError) {

        }
      });

      chrome.contextMenus.create({
        id: 'toggleMultiHighlightMode',
        title: 'Toggle Multi-Highlight Mode',
        contexts: ['selection', 'page'],
        parentId: 'urlNotesParent'
      }, () => {
        if (chrome.runtime.lastError) {
          // Multi-highlight menu create error - silently handled
        }
      });
    });
  } catch (e) {

  }
}


async function checkNoteLimitBeforeCreate() {
  const FREE_NOTE_LIMIT = 50;

  try {

    const { supabase_session, userTier } = await chrome.storage.local.get(['supabase_session', 'userTier']);
    const isPremium = userTier && userTier !== 'free';
    if (isPremium) {
      return true;
    }

    const allData = await chrome.storage.local.get(null);
    let noteCount = 0;

    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith('note_') && value && !value.is_deleted) {
        noteCount++;
      }
    }

    if (noteCount >= FREE_NOTE_LIMIT) {
      return false;
    }

    return true;
  } catch (error) {
    return true;
  }
}

// Function to handle adding selected text to a new note
async function addSelectionToNewNote(info, tab) {
  const { selectionText, pageUrl } = info;
  const { title, favIconUrl } = tab;

  if (!pageUrl || !pageUrl.startsWith('http')) {
    return;
  }

  const domain = new URL(pageUrl).hostname;
  if (!domain || domain === 'localhost') {
    return;
  }

  // Check note limit before creating new note
  const canCreate = await checkNoteLimitBeforeCreate();
  if (!canCreate) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon128x128.png',
      title: 'Note Limit Reached',
      message: 'You\'ve reached the 50 note limit on the free plan. Upgrade to Premium for unlimited notes!',
      priority: 2
    });
    openExtensionUi();
    return;
  }

  // 1. Prepare display text and Text Fragment URL
  const parts = getClipParts(selectionText, pageUrl);
  if (!parts) {
    return;
  }
  const { displayText, fragmentUrl } = parts;

 
  const noteContent = `- [${displayText}](${fragmentUrl})`;


  const newNote = {
    id: crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    url: pageUrl,
    domain: domain,
    title: title || 'Untitled',
    pageTitle: title || 'Untitled',
    content: noteContent,
    tags: ['clipping'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };

  // 4. Save the note using the same storage system as main extension
  try {
    // Store note in chrome.storage.local with proper key (same as main extension)
    const key = `note_${newNote.id}`;
    await chrome.storage.local.set({ [key]: newNote });


    await chrome.storage.local.set({
      lastAction: {
        type: 'new_from_selection',
        domain,
        noteId: newNote.id,
        ts: Date.now()
      }
    });

 
    openExtensionUi();

  } catch (error) {

  }
}


async function addSelectionToExistingNote(info, tab) {
  const { selectionText, pageUrl } = info;

  
  if (!pageUrl || !pageUrl.startsWith('http')) {
    return;
  }

  const domain = new URL(pageUrl).hostname;
  if (!domain || domain === 'localhost') {
    return;
  }

  const parts = getClipParts(selectionText, pageUrl);
  if (!parts) return;
  const { displayText, fragmentUrl } = parts;
  const bullet = `- [${displayText}](${fragmentUrl})`;

  try {
    
    const { editorState } = await chrome.storage.local.get(['editorState']);
    let targetNote = null;
    let isDraftNote = false;

    // If there's a draft note, use it (regardless of popup state)
    // This allows appending to drafts even when popup is closed
    if (editorState && editorState.noteDraft) {
      const cachedNote = editorState.noteDraft;

      if (cachedNote.domain === domain) {
        targetNote = { ...cachedNote }; 
        isDraftNote = true;
      }
    }

   
    if (!targetNote) {
      try {
        // Use the same storage system as the main extension
        const allKeys = await chrome.storage.local.get(null);
        const notes = [];

        for (const [key, value] of Object.entries(allKeys)) {
          if (key.startsWith('note_') && value && value.domain === domain && !value.is_deleted) {
            notes.push(value);
          }
        }

        if (notes.length === 0) {
          
          return addSelectionToNewNote(info, tab);
        }
        // Pick most recently updated
        notes.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        targetNote = notes[0];
      } catch (error) {
        
        return addSelectionToNewNote(info, tab);
      }
    }

  
    if (!targetNote) {
      return addSelectionToNewNote(info, tab);
    }

    if (isDraftNote) {
      const updatedDraft = {
        ...targetNote,
        content: (targetNote.content ? `${targetNote.content}\n` : '') + bullet,
        updatedAt: new Date().toISOString()
        
      };

      
      editorState.noteDraft = updatedDraft;
      await chrome.storage.local.set({ editorState });

      
      await chrome.storage.local.set({
        lastAction: {
          type: 'append_selection',
          domain,
          noteId: targetNote.id,
          isDraft: true,
          ts: Date.now()
        }
      });

      // Open extension UI to show the appended content
      openExtensionUi();
    } else {
      // For existing saved notes, update content and timestamp
      targetNote.content = (targetNote.content ? `${targetNote.content}\n` : '') + bullet;
      targetNote.updatedAt = new Date().toISOString();

      // Update them in storage
      const key = `note_${targetNote.id}`;
      await chrome.storage.local.set({ [key]: targetNote });

      // Send message to popup to refresh the notes list
      chrome.runtime.sendMessage({
        action: 'context_menu_note_saved',
        note: targetNote,
        type: 'append_selection'
      }).catch(() => {
        // Popup might not be open, that's okay
      });

      // Mark last action and open extension to show result
      await chrome.storage.local.set({
        lastAction: {
          type: 'append_selection',
          domain,
          noteId: targetNote.id,
          isDraft: false,
          ts: Date.now()
        }
      });

      openExtensionUi();
    }
  } catch (e) {
    
  }
}


function getClipParts(selectionText, pageUrl) {
  const raw = (selectionText || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const maxWords = 5;
  const words = raw.split(' ');
  const short = words.slice(0, maxWords).join(' ');
  const displayText = short;
  const fragmentUrl = `${pageUrl}#:~:text=${encodeURIComponent(short)}`;
  return { displayText, fragmentUrl };
}

function openExtensionUi() {
  if (chrome.action && chrome.action.openPopup) {
    try {
      chrome.action.openPopup();
    } catch (error) {
      // Fallback to creating a new tab
      const url = chrome.runtime.getURL('popup/popup.html');
      chrome.tabs.create({ url }).catch(() => { });
    }
  } else {
    const url = chrome.runtime.getURL('popup/popup.html');
    chrome.tabs.create({ url }).catch(() => { });
  }
}


// --- Utility and Maintenance Functions (largely unchanged) ---
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
    case 'ping':
      sendResponse({ status: 'pong', timestamp: Date.now() });
      break;
    case 'addHighlightsToNote':
      addHighlightsToNote(request.pageInfo, request.highlights, sender.tab)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response
    case 'updateBadge':
      updateExtensionBadge(request.text, request.color);
      sendResponse({ success: true });
      break;
    case 'auth-changed':
      // Handle auth changes for sync timer management
      if (request.user) {
        lastSyncTime = Date.now();
        saveLastSyncTime(); 
        startSyncTimer();
      } else {
        stopSyncTimer();
      }
      sendResponse({ success: true });
      break;
    case 'restart-sync-timer':
      lastSyncTime = Date.now(); 
      saveLastSyncTime(); 
      startSyncTimer();
      sendResponse({ success: true });
      break;
    case 'tier-changed':
      

      sendResponse({ success: true });
      break;
    case 'reset-sync-timer':
      // Reset timer due to corrupted data
      resetSyncTimer().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
      break;
    case 'force-reset-sync-timer':
      // Force reset timer due to corrupted data
      forceResetSyncTimer().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
      break;
    case 'popup-opened':
      // Popup opened, check if sync is overdue
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTime;

      if (timeSinceLastSync >= syncInterval) {
        sendResponse({ shouldSync: true, timeSinceLastSync });
      } else {
        sendResponse({ shouldSync: false, timeRemaining: syncInterval - timeSinceLastSync });
      }
      break;
  }
  return true; 
});

// --- OAuth Handling ---


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check for OAuth callbacks
  if (changeInfo.url) {
    if (changeInfo.url.includes('access_token=') || changeInfo.url.includes('error=')) {
      finishUserOAuth(changeInfo.url, tabId);
      return;
    }

    if (changeInfo.url.includes('anchored.site/login-success') || changeInfo.url.includes('anchored.site/?')) {
      finishUserOAuth(changeInfo.url, tabId);
      return;
    }

    if (changeInfo.url.includes('anchored.site') && changeInfo.url.includes('#')) {
      finishUserOAuth(changeInfo.url, tabId);
      return;
    }
  }

  if (changeInfo.url?.startsWith(chrome.identity.getRedirectURL())) {
    finishUserOAuth(changeInfo.url, tabId);
  }
});

/**
 * Method used to finish OAuth callback for user authentication.
 */
async function finishUserOAuth(url, tabId) {
  try {
    // Parse URL hash for tokens (Supabase returns tokens in hash)
    const hashMap = parseUrlHash(url);
    const urlObj = new URL(url);
    const queryParams = new URLSearchParams(urlObj.search);

    let access_token = hashMap.get('access_token') || queryParams.get('access_token');
    let refresh_token = hashMap.get('refresh_token') || queryParams.get('refresh_token');

    lastSyncTime = Date.now();
    await saveLastSyncTime();


    if (!access_token) {
      const error = hashMap.get('error') || queryParams.get('error');
      const error_description = hashMap.get('error_description') || queryParams.get('error_description');
      console.log('❌ No access token found');
      console.log('❌ Error:', error);
      console.log('❌ Error description:', error_description);
      throw new Error(error_description || error || 'No access token found in OAuth response');
    }



    // Get user info from the access token
    const userResponse = await fetch('https://kqjcorjjvunmyrnzvqgr.supabase.co/auth/v1/user', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxamNvcmpqdnVubXlybnp2cWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTc4ODgsImV4cCI6MjA3MTI5Mzg4OH0.l-ZdPOYMNi8x3lBqlemwQ2elDyvoPy-2ZUWuODVviWk'
      }
    });



    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('❌ User fetch failed:', errorText);
      throw new Error(`Failed to get user info: ${userResponse.status} ${errorText}`);
    }

    const user = await userResponse.json();


    // Create auth data object (same format as handleAuthSuccess expects)
    const authData = {
      access_token,
      refresh_token: refresh_token || null,
      user,
      expires_in: 3600 
    };


    await chrome.storage.local.set({
      supabase_session: {
        access_token,
        refresh_token: refresh_token || null,
        user,
        expires_at: Date.now() + (3600 * 1000)
      }
    });

    await chrome.storage.local.set({
      oauthJustCompleted: {
        success: true,
        timestamp: Date.now()
      }
    });

    chrome.runtime.sendMessage({
      action: 'oauth-complete',
      success: true,
      data: authData
    }).then(() => {

    }).catch(() => {
    });


  } catch (error) {
    console.error('OAuth callback error:', error);

    chrome.runtime.sendMessage({
      action: 'oauth-complete',
      success: false,
      error: error.message
    }).catch(() => {
    });
  }
}

/**
 * Helper method used to parse the hash of a redirect URL.
 */
function parseUrlHash(url) {
  const hashParts = new URL(url).hash.slice(1).split('&');
  const hashMap = new Map(
    hashParts.map((part) => {
      const [name, value] = part.split('=');
      return [name, decodeURIComponent(value || '')];
    })
  );
  return hashMap;
}

function handleContentScriptReady(pageInfo, tab) {
  if (!tab || typeof tab.id !== 'number') {
    return;
  }
  chrome.storage.session.set({ [`pageInfo_${tab.id}`]: { ...pageInfo, tabId: tab.id, timestamp: Date.now() } });
}

function handleUrlChange(pageInfo, tab) {
  if (!tab || typeof tab.id !== 'number') {
    return;
  }
  chrome.storage.session.set({ [`pageInfo_${tab.id}`]: { ...pageInfo, tabId: tab.id, timestamp: Date.now() } });
  chrome.runtime.sendMessage({ action: 'pageInfoUpdated', pageInfo: pageInfo, tabId: tab.id }).catch(() => { });
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
    }
  } catch (error) {
  }
}

function handleSettingsChange(oldSettings, newSettings) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsChanged', settings: newSettings }).catch(() => { });
    });
  });
}

chrome.runtime.onStartup.addListener(() => {
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

    const uninstallUrl = `https://anchored.site?${params.toString()}`;
    chrome.runtime.setUninstallURL(uninstallUrl);
  } catch (e) {

  }
}


async function addHighlightsToNote(pageInfo, highlights, tab) {
  if (!highlights || highlights.length === 0) {
    return;
  }

  const { domain, url, title } = pageInfo;

  if (!url || !url.startsWith('http')) {
    return;
  }

  if (!domain || domain === 'localhost') {
    return;
  }

  let noteContent = '';
  highlights.forEach((highlight, index) => {
    const displayText = highlight.text.replace(/\s+/g, ' ').trim();

    const fragmentUrl = `${url}#:~:text=${encodeURIComponent(displayText)}`;
    noteContent += `${index + 1}. [${displayText}](${fragmentUrl})\n\n`;
  });

  try {
    const { editorState } = await chrome.storage.local.get(['editorState']);
    let targetNote = null;
    let isDraftNote = false;

    // If there's a draft note, use it (regardless of popup state)
    if (editorState && editorState.noteDraft) {
      const cachedNote = editorState.noteDraft;

      if (cachedNote.domain === domain) {
        targetNote = { ...cachedNote }; // Copy to avoid modifying original
        isDraftNote = true;
      }
    }

    if (!targetNote) {
      try {
        const allKeys = await chrome.storage.local.get(null);
        const notes = [];

        for (const [key, value] of Object.entries(allKeys)) {
          if (key.startsWith('note_') && value && value.domain === domain && !value.is_deleted) {
            notes.push(value);
          }
        }

        if (notes.length > 0) {
          notes.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
          targetNote = notes[0];
        }
      } catch (error) {
      }
    }

    if (targetNote) {
      if (isDraftNote) {
        const updatedDraft = {
          ...targetNote,
          content: (targetNote.content ? `${targetNote.content}\n\n` : '') + noteContent.trim(),
          updatedAt: new Date().toISOString()
        };

        editorState.noteDraft = updatedDraft;
        await chrome.storage.local.set({ editorState });
        await chrome.storage.local.set({
          lastAction: {
            type: 'append_multi_highlights',
            domain,
            noteId: targetNote.id,
            isDraft: true,
            highlightCount: highlights.length,
            ts: Date.now()
          }
        });

        // Open extension UI to show the appended content
        openExtensionUi();
        return;
      } else {
        // For existing saved notes, update content and timestamp
        targetNote.content = (targetNote.content ? `${targetNote.content}\n\n` : '') + noteContent.trim();
        targetNote.updatedAt = new Date().toISOString();

        const key = `note_${targetNote.id}`;
        await chrome.storage.local.set({ [key]: targetNote });
        chrome.runtime.sendMessage({
          action: 'multi_highlight_note_updated',
          note: targetNote,
          type: 'append_multi_highlights'
        }).catch(() => {
          
        });

        await chrome.storage.local.set({
          lastAction: {
            type: 'append_multi_highlights',
            domain,
            noteId: targetNote.id,
            isDraft: false,
            highlightCount: highlights.length,
            ts: Date.now()
          }
        });

        openExtensionUi();
        return;
      }
    }
  } catch (error) {
    // Multi-highlight: Failed to append to existing note, will create new note instead
  }

  const canCreate = await checkNoteLimitBeforeCreate();
  if (!canCreate) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon128x128.png',
      title: 'Note Limit Reached',
      message: 'You\'ve reached the 50 note limit on the free plan. Upgrade to Premium for unlimited notes!',
      priority: 2
    });
    openExtensionUi();
    return;
  }

  const newNote = {
    id: crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    url: url,
    domain: domain,
    title: title || 'Untitled',
    pageTitle: title || 'Untitled',
    content: noteContent.trim(),
    tags: ['multi-highlight', 'clipping'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };

  try {
    // Store note in chrome.storage.local
    const key = `note_${newNote.id}`;
    await chrome.storage.local.set({ [key]: newNote });

    // Send message to popup to refresh the notes list
    chrome.runtime.sendMessage({
      action: 'multi_highlight_note_updated',
      note: newNote,
      type: 'new_from_multi_highlight'
    }).catch(() => {
    });

    // Mark last action so popup can prioritize showing this note
    await chrome.storage.local.set({
      lastAction: {
        type: 'new_from_multi_highlight',
        domain,
        noteId: newNote.id,
        highlightCount: highlights.length,
        ts: Date.now()
      }
    });

    // Open the extension UI to show the result
    openExtensionUi();

  } catch (error) {
    // Failed to save multi-highlight note - silently handled
  }
}

// Function to update extension badge
function updateExtensionBadge(text, color) {
  try {
    if (chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: text || '' });
    }
    if (chrome.action && chrome.action.setBadgeBackgroundColor && color) {
      chrome.action.setBadgeBackgroundColor({ color: color });
    }
  } catch (error) {
  }
}

// Function to toggle multi-highlight mode from context menu
async function toggleMultiHighlightModeFromContextMenu(tab) {
  if (!tab || !tab.url || !tab.url.startsWith('http')) {
    return;
  }

  try {
    let contentScriptReady = false;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      contentScriptReady = true;
    } catch (error) {
      contentScriptReady = false;
    }

    if (!contentScriptReady) {
      try {
        if (!chrome.scripting) {
          throw new Error('Scripting API not available');
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });

        let pingSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 300 * attempt)); // Progressive delay
            await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            pingSuccess = true;
            break;
          } catch (pingError) {
            if (attempt === 3) {
              throw new Error('Content script not responding after injection');
            }
          }
        }

        if (!pingSuccess) {
          throw new Error('Content script not responding after injection');
        }

        contentScriptReady = true;

      } catch (injectError) {
        // Failed to inject content script for context menu
        // Show error notification in the tab
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: #ef4444;
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              z-index: 10000;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              font-weight: 500;
            `;
            notification.textContent = 'Failed to load multi-highlight feature. Please refresh the page and try again.';
            document.body.appendChild(notification);

            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 5000);
          }
        });
        return;
      }
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggleMultiHighlight' });

    if (response && response.enabled) {
      // Show notification in the tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Create a simple notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
          `;
          notification.textContent = 'Multi-highlight mode enabled! Select text to highlight.';
          document.body.appendChild(notification);

          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 3000);
        }
      });
    } else {

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #6b7280;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
          `;
          notification.textContent = 'Multi-highlight mode disabled.';
          document.body.appendChild(notification);

          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 3000);
        }
      });
    }
  } catch (error) {
    // Failed to toggle multi-highlight mode from context menu - silently handled
  }
}


let syncTimer = null;
let syncInterval = 5 * 60 * 1000; 
let lastSyncTime = 0; 


// Start periodic debug status logging
// Background script loaded

async function loadLastSyncTime() {
  try {
    const result = await chrome.storage.local.get(['lastSyncTime']);
    const now = Date.now();

    if (result.lastSyncTime) {
      const storedTime = result.lastSyncTime;

      // Validate that the stored time is reasonable
      // Check for obviously invalid timestamps (future dates, extremely old dates, or NaN)
      const currentYear = new Date().getFullYear();
      const storedYear = new Date(storedTime).getFullYear();

      if (isNaN(storedTime) || storedTime <= 0 || storedTime > now || storedYear > currentYear) {
        lastSyncTime = now;
        await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
      } else if (storedTime < (now - (24 * 60 * 60 * 1000))) { // More than 24 hours ago
        lastSyncTime = now;
        await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
      } else {
        lastSyncTime = storedTime;
      }
    } else {

      lastSyncTime = Date.now();
      await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
    }
  } catch (error) {
    lastSyncTime = Date.now();
    await saveLastSyncTime(); 
  }
}

async function saveLastSyncTime() {
  try {
    await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
  } catch (error) {
  }
}

// Clear corrupted lastSyncTime and reset timer
async function resetSyncTimer() {
  try {
    await chrome.storage.local.remove(['lastSyncTime']);
    lastSyncTime = Date.now();
    await saveLastSyncTime();
    startSyncTimer();
  } catch (error) {

  }
}


async function forceResetSyncTimer() {
  try {

    await chrome.storage.local.remove(['lastSyncTime']);
    lastSyncTime = Date.now();
    await saveLastSyncTime();
    startSyncTimer();
  } catch (error) {
  }
}

function startSyncTimer() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  // Set a one-time timeout instead of interval
  syncTimer = setTimeout(() => {
    // Send message to popup to trigger sync
    chrome.runtime.sendMessage({ action: 'sync-timer-triggered' }).catch(() => {
      // Popup might be closed, that's okay
      // Mark that we need to sync when popup opens
      // Don't set lastSyncTime here - let the popup handle it when it opens
    });

    syncTimer = null;
  }, syncInterval);
}

function stopSyncTimer() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  // Reset lastSyncTime when stopping timer (e.g., user signs out)
  lastSyncTime = 0;
  saveLastSyncTime();
}

// Initialize sync timer management when extension loads
// Note: Don't start timer automatically - wait for auth and premium status
setTimeout(() => {
  loadLastSyncTime().catch(() => {
    // Error during initialization - handled by loadLastSyncTime
  });
}, 100);


