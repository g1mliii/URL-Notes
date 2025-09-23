// Context menu now uses the same storage system as the main extension
// No separate storage abstraction needed

// Keyboard commands
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
        // Best-effort fallback: open the side panel or settings (if configured)
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
// Anchored Extension - Background Script (Service Worker)

// --- Main Event Listeners ---

// Extension installation and updates
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

  // Always update uninstall URL on install/update
  updateUninstallUrl();
});

// Note: No action.onClicked handler needed when default_popup is set in manifest

// Ensure context menus exist on browser startup (service worker cold start)
chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

// Also ensure context menus exist when the service worker starts
setupContextMenus();

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addSelectionToNewNote') {
    addSelectionToNewNote(info, tab);
  } else if (info.menuItemId === 'addSelectionToExistingNote') {
    addSelectionToExistingNote(info, tab);
  } else if (info.menuItemId === 'toggleMultiHighlightMode') {
    toggleMultiHighlightModeFromContextMenu(tab);
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
          // Existing-note menu create error - silently handled
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
          // Separator create error - silently handled
        }
      });

      // Multi-highlight mode toggle (available on both page and selection contexts)
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
    // setupContextMenus failed - silently handled
  }
}

// Remove the immediate call that causes logs on startup
// setupContextMenus();

// Function to handle adding selected text to a new note
async function addSelectionToNewNote(info, tab) {
  const { selectionText, pageUrl } = info;
  const { title, favIconUrl } = tab;

  // Validate that we have a proper URL and domain
  if (!pageUrl || !pageUrl.startsWith('http')) {
    return;
  }

  const domain = new URL(pageUrl).hostname;
  if (!domain || domain === 'localhost') {
    return;
  }

  // 1. Prepare display text and Text Fragment URL
  const parts = getClipParts(selectionText, pageUrl);
  if (!parts) {
    return;
  }
  const { displayText, fragmentUrl } = parts;

  // 2. Create the note content (single clickable anchor)
  const noteContent = `- [${displayText}](${fragmentUrl})`;

  // 3. Create the new note object with proper UUID
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

    // 5. Mark last action so popup can prioritize showing this note
    await chrome.storage.local.set({
      lastAction: {
        type: 'new_from_selection',
        domain,
        noteId: newNote.id,
        ts: Date.now()
      }
    });

    // 6. Open the extension UI to show the result
    openExtensionUi();

  } catch (error) {
    // Failed to save new note from selection - silently handled
  }
}

// Function: append selection to most recently updated note for this domain
async function addSelectionToExistingNote(info, tab) {
  const { selectionText, pageUrl } = info;

  // Validate that we have a proper URL and domain
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
    // Check for cached editor state first (like AI rewrite system)
    const { editorState } = await chrome.storage.local.get(['editorState']);
    let targetNote = null;
    let isDraftNote = false;

    // If there's a draft note, use it (regardless of popup state)
    // This allows appending to drafts even when popup is closed
    if (editorState && editorState.noteDraft) {
      const cachedNote = editorState.noteDraft;

      if (cachedNote.domain === domain) {
        targetNote = { ...cachedNote }; // Copy to avoid modifying original
        isDraftNote = true;
      }
    }

    // If no cached note, get from storage
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
          // No existing note for this domain; fallback to creating a new one
          return addSelectionToNewNote(info, tab);
        }
        // Pick most recently updated
        notes.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        targetNote = notes[0];
      } catch (error) {
        // Context menu: Failed to get notes from storage, creating new note
        return addSelectionToNewNote(info, tab);
      }
    }

    // Additional fallback: if we still don't have a target note, create a new one
    if (!targetNote) {
      return addSelectionToNewNote(info, tab);
    }

    if (isDraftNote) {
      // For draft notes, ONLY update content and timestamp, preserve all other properties
      const updatedDraft = {
        ...targetNote,
        content: (targetNote.content ? `${targetNote.content}\n` : '') + bullet,
        updatedAt: new Date().toISOString()
        // Keep original title, domain, url, pageTitle, etc. from the draft
      };

      // Update the draft in chrome.storage.local to preserve unsaved changes
      editorState.noteDraft = updatedDraft;
      await chrome.storage.local.set({ editorState });

      // Mark last action for draft updates
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

      // Open extension UI to show the result for saved notes
      openExtensionUi();
    }
  } catch (e) {
    // Failed to append to existing note - silently handled
  }
}

// Helpers
// Build display text and fragment link consistently
function getClipParts(selectionText, pageUrl) {
  const raw = (selectionText || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const maxWords = 5;
  const words = raw.split(' ');
  const short = words.slice(0, maxWords).join(' ');
  // Display exactly up to five words without ellipses for concise bullets
  const displayText = short;
  const fragmentUrl = `${pageUrl}#:~:text=${encodeURIComponent(short)}`;
  return { displayText, fragmentUrl };
}

function openExtensionUi() {
  // Prefer opening the action popup (Chrome >= MV3). This keeps UX in the same window.
  if (chrome.action && chrome.action.openPopup) {
    try {
      chrome.action.openPopup();
    } catch (error) {
      // Fallback to creating a new tab
      const url = chrome.runtime.getURL('popup/popup.html');
      chrome.tabs.create({ url }).catch(() => { });
    }
  } else {
    // Fallback for older Chrome versions
    const url = chrome.runtime.getURL('popup/popup.html');
    chrome.tabs.create({ url }).catch(() => { });
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
    case 'ping':
      sendResponse({ status: 'pong', timestamp: Date.now() });
      break;
    case 'addHighlightsToNote':
      // Handle async response properly
      addHighlightsToNote(request.pageInfo, request.highlights, sender.tab)
        .then(() => {
          // Send success response
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
        // User signed in - initialize lastSyncTime but don't start timer yet
        // Wait for tier-changed event to determine if user has premium access
        lastSyncTime = Date.now();
        saveLastSyncTime(); // Save the current time as last sync
        // Note: Don't start timer here - wait for tier-changed event

      } else {
        // User signed out, stop timer
        stopSyncTimer();
      }
      sendResponse({ success: true });
      break;
    case 'restart-sync-timer':
      // Restart timer for next sync cycle
      lastSyncTime = Date.now(); // Mark that we just synced
      saveLastSyncTime(); // Save the updated time
      startSyncTimer();
      sendResponse({ success: true });
      break;
    case 'tier-changed':
      // Handle tier changes (premium status updates)
      // If user lost premium access, stop sync timer
      if (!request.active || request.tier === 'free') {
        stopSyncTimer();
      } else {
        // User gained premium access, start sync timer if not already running
        if (!syncTimer) {
          lastSyncTime = Date.now();
          saveLastSyncTime();
          startSyncTimer();
        }
      }
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
  return true; // Keep message channel open for async responses
});

// --- OAuth Handling ---

// Listen for tab updates to catch OAuth redirects
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check for OAuth callbacks
  if (changeInfo.url) {
    // Check if this looks like an OAuth callback (has access_token or error)
    if (changeInfo.url.includes('access_token=') || changeInfo.url.includes('error=')) {
      finishUserOAuth(changeInfo.url, tabId);
      return;
    }

    // Also check for redirects to the website login-success page
    if (changeInfo.url.includes('anchored.site/login-success') || changeInfo.url.includes('anchored.site/?')) {
      finishUserOAuth(changeInfo.url, tabId);
      return;
    }

    // Check for any anchored.site URL with hash parameters
    if (changeInfo.url.includes('anchored.site') && changeInfo.url.includes('#')) {
      finishUserOAuth(changeInfo.url, tabId);
      return;
    }
  }

  if (changeInfo.url?.startsWith(chrome.identity.getRedirectURL())) {
    console.log('🎯 OAuth redirect detected (exact match), processing...');
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

    // Also try parsing query parameters in case tokens are there
    const urlObj = new URL(url);
    const queryParams = new URLSearchParams(urlObj.search);

    // Try to get tokens from hash first, then query params
    let access_token = hashMap.get('access_token') || queryParams.get('access_token');
    let refresh_token = hashMap.get('refresh_token') || queryParams.get('refresh_token');
    
    console.log('OAuth tokens received:', { 
      hasAccessToken: !!access_token, 
      hasRefreshToken: !!refresh_token,
      refreshTokenValue: refresh_token ? 'present' : 'missing'
    });

    if (!access_token) {
      // Check for error parameters in both hash and query
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
      expires_in: 3600 // Default to 1 hour
    };



    // Store session in chrome.storage.local as fallback (in case popup isn't open)
    await chrome.storage.local.set({
      supabase_session: {
        access_token,
        refresh_token: refresh_token || null,
        user,
        expires_at: Date.now() + (3600 * 1000)
      }
    });



    // Notify any open popups that OAuth is complete
    // Let the popup's Supabase client handle the auth success using handleAuthSuccess
    chrome.runtime.sendMessage({
      action: 'oauth-complete',
      success: true,
      data: authData
    }).then(() => {

    }).catch(() => {
      // Popup likely closed, but session is stored so it will work when popup opens
    });


  } catch (error) {
    console.error('💥 OAuth callback error:', error);
    console.error('💥 Error stack:', error.stack);

    // Keep user on current page for errors
    console.log('❌ OAuth failed, keeping user on current page');

    // Notify the popup that OAuth failed
    chrome.runtime.sendMessage({
      action: 'oauth-complete',
      success: false,
      error: error.message
    }).catch(() => {
      // Popup likely closed, ignore
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

// Global function for debugging - can be called from console
globalThis.debugOAuth = function (url) {
  console.log('Manual OAuth debug for URL:', url);
  finishUserOAuth(url, null);
};

// Background script loaded and ready

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
    // Error during cleanup - silently handled
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
    // Failed to set uninstall URL - silently handled
  }
}

// Function to handle adding multiple highlights to a note
async function addHighlightsToNote(pageInfo, highlights, tab) {
  if (!highlights || highlights.length === 0) {
    return;
  }

  const { domain, url, title } = pageInfo;

  // Validate that we have a proper URL and domain
  if (!url || !url.startsWith('http')) {
    return;
  }

  if (!domain || domain === 'localhost') {
    return;
  }

  // Create note content with all highlights - using same logic as single-selection context menu
  let noteContent = '';
  highlights.forEach((highlight, index) => {
    // Use the full text without shortening, just like the existing context menu feature
    const displayText = highlight.text.replace(/\s+/g, ' ').trim();

    // Create a clickable link for each highlight using the full text
    const fragmentUrl = `${url}#:~:text=${encodeURIComponent(displayText)}`;
    noteContent += `${index + 1}. [${displayText}](${fragmentUrl})\n\n`;
  });

  // Try to append to existing note first (like the single-selection feature does)
  try {
    // Check for cached editor state first (like AI rewrite system)
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

    // If no cached note, check for existing saved notes
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
          // Pick most recently updated
          notes.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
          targetNote = notes[0];
        }
      } catch (error) {
        // Multi-highlight: Failed to get notes from storage - silently handled
      }
    }

    // If we have a target note, append to it
    if (targetNote) {
      if (isDraftNote) {
        // For draft notes, update content and timestamp, preserve all other properties
        const updatedDraft = {
          ...targetNote,
          content: (targetNote.content ? `${targetNote.content}\n\n` : '') + noteContent.trim(),
          updatedAt: new Date().toISOString()
        };

        // Update the draft in chrome.storage.local to preserve unsaved changes
        editorState.noteDraft = updatedDraft;
        await chrome.storage.local.set({ editorState });

        // Mark last action for draft updates
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

        // Update them in storage
        const key = `note_${targetNote.id}`;
        await chrome.storage.local.set({ [key]: targetNote });

        // Send message to popup to refresh the notes list
        chrome.runtime.sendMessage({
          action: 'multi_highlight_note_updated',
          note: targetNote,
          type: 'append_multi_highlights'
        }).catch(() => {
          // Popup might not be open, that's okay
        });

        // Mark last action and open extension to show result
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

        // Open extension UI to show the result for saved notes
        openExtensionUi();
        return;
      }
    }
  } catch (error) {
    // Multi-highlight: Failed to append to existing note, will create new note instead
  }

  // If we couldn't append to existing note, create a new one

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
      // Popup might not be open, that's okay
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
    // Failed to update badge - silently handled
  }
}

// Function to toggle multi-highlight mode from context menu
async function toggleMultiHighlightModeFromContextMenu(tab) {
  if (!tab || !tab.url || !tab.url.startsWith('http')) {
    return;
  }

  try {
    // First check if content script is ready by sending a ping message
    let contentScriptReady = false;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      contentScriptReady = true;
    } catch (error) {
      contentScriptReady = false;
    }

    // If content script is not ready, try to inject it
    if (!contentScriptReady) {
      try {
        if (!chrome.scripting) {
          throw new Error('Scripting API not available');
        }

        // Try to inject the content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });

        // Wait for the script to initialize and try multiple ping attempts
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

    // Now send the toggle message to the content script
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

          // Remove after 3 seconds
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 3000);
        }
      });
    } else {
      // Show disabled notification
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

// Add minimal sync timer logic to background
let syncTimer = null;
let syncInterval = 5 * 60 * 1000; // 5 minutes
let lastSyncTime = 0; // Track when we last synced

// Load lastSyncTime from storage on startup
async function loadLastSyncTime() {
  try {
    const result = await chrome.storage.local.get(['lastSyncTime']);

    if (result.lastSyncTime) {
      const storedTime = result.lastSyncTime;
      const now = Date.now();

      // Validate that the stored time is reasonable
      // Check for obviously invalid timestamps (future dates, extremely old dates, or NaN)
      const currentYear = new Date().getFullYear();
      const storedYear = new Date(storedTime).getFullYear();

      // Check if the stored timestamp is from a future year (like 2025 when we're in 2024)
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
      // Initialize to current time if no stored value
      lastSyncTime = Date.now();
      await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
    }
  } catch (error) {
    console.error('🕐 Background: Error loading lastSyncTime:', error);
    // Fallback to current time
    lastSyncTime = Date.now();
    await saveLastSyncTime(); // Save the fallback time
  }
}

// Save lastSyncTime to storage
async function saveLastSyncTime() {
  try {
    await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
  } catch (error) {
    // Error saving lastSyncTime - silently handled
  }
}

// Clear corrupted lastSyncTime and reset timer
async function resetSyncTimer() {
  try {
    // Remove the corrupted lastSyncTime from storage
    await chrome.storage.local.remove(['lastSyncTime']);

    // Reset to current time
    lastSyncTime = Date.now();
    await saveLastSyncTime();

    // Restart timer
    startSyncTimer();
  } catch (error) {
    // Error resetting sync timer - silently handled
  }
}

// Force clear corrupted storage and reset
async function forceResetSyncTimer() {
  try {
    // Remove the corrupted lastSyncTime from storage
    await chrome.storage.local.remove(['lastSyncTime']);

    // Reset to current time
    lastSyncTime = Date.now();
    await saveLastSyncTime();

    // Restart timer
    startSyncTimer();
  } catch (error) {
    // Error in force reset - silently handled
  }
}

function startSyncTimer() {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }



  // Set a one-time timeout instead of interval
  syncTimer = setTimeout(() => {

    // Send message to popup to trigger sync
    chrome.runtime.sendMessage({ action: 'sync-timer-triggered' }).catch(() => {

      // Popup might be closed, that's okay
      // Mark that we need to sync when popup opens
      // Don't set lastSyncTime here - let the popup handle it when it opens
      // This prevents the invalid future timestamp issue
    });

    // Clear the timer after it fires
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
  loadLastSyncTime().then(() => {


    // Force reset if the timestamp is corrupted, but don't start timer
    const currentYear = new Date().getFullYear();
    const storedYear = new Date(lastSyncTime).getFullYear();

    if (lastSyncTime > Date.now() || storedYear > currentYear) {

      lastSyncTime = 0;
      saveLastSyncTime();
    }
    // Note: Don't start timer here - wait for tier-changed event with premium status
  }).catch(error => {

    // Don't start timer on error - wait for proper auth/premium status
  });
}, 100);


