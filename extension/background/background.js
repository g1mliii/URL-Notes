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
// URL Notes Extension - Background Script (Service Worker)

// --- Main Event Listeners ---

// Extension installation and updates
chrome.runtime.onInstalled.addListener(async (details) => {
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

// Note: No action.onClicked handler needed when default_popup is set in manifest

// Ensure context menus exist on browser startup (service worker cold start)
chrome.runtime.onStartup.addListener(() => {
  console.log('onStartup: ensuring context menus are created');
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
      // Create a parent menu for URL Notes
      chrome.contextMenus.create({
        id: 'urlNotesParent',
        title: 'URL Notes',
        contexts: ['selection', 'page']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Parent menu create error:', chrome.runtime.lastError.message);
        } else {
          console.log('Parent menu created');
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
          console.warn('Context menu create error:', chrome.runtime.lastError.message);
        } else {
          console.log('Context menu (new note) created');
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
          console.warn('Existing-note menu create error:', chrome.runtime.lastError.message);
        } else {
          console.log('Context menu (existing note) created');
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
          console.warn('Separator create error:', chrome.runtime.lastError.message);
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
          console.warn('Multi-highlight menu create error:', chrome.runtime.lastError.message);
        } else {
          console.log('Context menu (multi-highlight) created');
        }
      });
    });
  } catch (e) {
    console.warn('setupContextMenus failed:', e);
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
    console.error('Context menu: Invalid pageUrl:', pageUrl);
    return;
  }
  
  const domain = new URL(pageUrl).hostname;
  if (!domain || domain === 'localhost') {
    console.error('Context menu: Invalid domain:', domain);
    return;
  }
  
  console.log('Context menu: Creating note for domain:', domain, 'from URL:', pageUrl);

  // 1. Prepare display text and Text Fragment URL
  const parts = getClipParts(selectionText, pageUrl);
  if (!parts) {
    console.warn('No selection text found for context menu action');
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
    console.log('Context menu: New note saved to chrome.storage.local with key:', key);
    
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
    console.error('Failed to save new note from selection:', error);
  }
}

// Function: append selection to most recently updated note for this domain
async function addSelectionToExistingNote(info, tab) {
  const { selectionText, pageUrl } = info;
  
  // Validate that we have a proper URL and domain
  if (!pageUrl || !pageUrl.startsWith('http')) {
    console.error('Context menu: Invalid pageUrl:', pageUrl);
    return;
  }
  
  const domain = new URL(pageUrl).hostname;
  if (!domain || domain === 'localhost') {
    console.error('Context menu: Invalid domain:', domain);
    return;
  }
  
  console.log('Context menu: Adding to existing note for domain:', domain, 'from URL:', pageUrl);
  
  const parts = getClipParts(selectionText, pageUrl);
  if (!parts) return;
  const { displayText, fragmentUrl } = parts;
  const bullet = `- [${displayText}](${fragmentUrl})`;

  try {
    // Check for cached editor state first (like AI rewrite system)
    const { editorState } = await chrome.storage.local.get(['editorState']);
    let targetNote = null;
    let isDraftNote = false;
    
    console.log('Context menu: Raw editorState from storage:', editorState);
    
    // If there's a draft note, use it (regardless of popup state)
    // This allows appending to drafts even when popup is closed
    if (editorState && editorState.noteDraft) {
      const cachedNote = editorState.noteDraft;
      console.log('Context menu: Found draft in storage:', { 
        open: editorState.open, 
        wasEditorOpen: editorState.wasEditorOpen,
        hasDraft: !!editorState.noteDraft,
        draftDomain: cachedNote?.domain,
        targetDomain: domain,
        domainsMatch: cachedNote?.domain === domain
      });
      
      if (cachedNote.domain === domain) {
        targetNote = { ...cachedNote }; // Copy to avoid modifying original
        isDraftNote = true;
        console.log('Context menu: Appending to open draft note for domain:', domain);
      } else {
        console.log('Context menu: Domain mismatch - draft domain:', cachedNote.domain, 'vs target domain:', domain);
      }
    } else {
      console.log('Context menu: No editorState or draft found:', { 
        hasEditorState: !!editorState, 
        isOpen: editorState?.open, 
        hasDraft: !!editorState?.noteDraft,
        editorStateKeys: editorState ? Object.keys(editorState) : []
      });
      
      // Check if popup might be in the process of opening
      if (!editorState || !editorState.open) {
        console.log('Context menu: Popup appears to be closed, will create new note instead');
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
        
        console.log('Context menu: Found notes in storage:', notes.length, 'for domain:', domain);
        
        if (notes.length === 0) {
          // No existing note for this domain; fallback to creating a new one
          console.log('Context menu: No existing notes found, creating new note');
          return addSelectionToNewNote(info, tab);
        }
        // Pick most recently updated
        notes.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        targetNote = notes[0];
        console.log('Context menu: Using most recent note:', targetNote.id);
      } catch (error) {
        console.error('Context menu: Failed to get notes from storage, creating new note:', error);
        return addSelectionToNewNote(info, tab);
      }
    }
    
    // Additional fallback: if we still don't have a target note, create a new one
    if (!targetNote) {
      console.log('Context menu: Fallback: no target note found, creating new note');
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
      console.log('Context menu: Updated draft note with appended content, preserved original properties');
      
      // Send message to popup to refresh the editor content
      chrome.runtime.sendMessage({
        action: 'context_menu_draft_updated',
        note: updatedDraft,
        type: 'append_to_draft'
      }).catch(() => {
        // Popup might not be open, that's okay
      });
      
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
      console.log('Context menu: Appended to existing saved note:', targetNote.id);
      
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
    console.error('Failed to append to existing note:', e);
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
      chrome.tabs.create({ url }).catch(() => {});
    }
  } else {
    // Fallback for older Chrome versions
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
    case 'ping':
      console.log('Background script received ping, responding with pong');
      sendResponse({ status: 'pong', timestamp: Date.now() });
      break;
    case 'addHighlightsToNote':
      console.log('Background script received addHighlightsToNote message:', request);
      // Handle async response properly
      addHighlightsToNote(request.pageInfo, request.highlights, sender.tab)
        .then(() => {
          console.log('addHighlightsToNote completed successfully');
          // Send success response
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('Error in addHighlightsToNote:', error);
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
        // User signed in, start timer and initialize lastSyncTime
        console.log('🕐 Background: User signed in, starting sync timer...');
        lastSyncTime = Date.now();
        saveLastSyncTime(); // Save the current time as last sync
        startSyncTimer();
      } else {
        // User signed out, stop timer
        console.log('🕐 Background: User signed out, stopping sync timer...');
        stopSyncTimer();
      }
      sendResponse({ success: true });
      break;
    case 'restart-sync-timer':
      // Restart timer for next sync cycle
      console.log('🕐 Background: Received restart-sync-timer message, restarting timer...');
      lastSyncTime = Date.now(); // Mark that we just synced
      saveLastSyncTime(); // Save the updated time
      startSyncTimer();
      sendResponse({ success: true });
      break;
    case 'reset-sync-timer':
      // Reset timer due to corrupted data
      console.log('🕐 Background: Received reset-sync-timer message...');
      resetSyncTimer().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('🕐 Background: Error in reset-sync-timer:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
      break;
    case 'force-reset-sync-timer':
      // Force reset timer due to corrupted data
      console.log('🕐 Background: Received force-reset-sync-timer message...');
      forceResetSyncTimer().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('🕐 Background: Error in force-reset-sync-timer:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
      break;
    case 'popup-opened':
      // Popup opened, check if sync is overdue
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTime;
      console.log('🕐 Background: popup-opened handler - lastSyncTime:', lastSyncTime, '(', new Date(lastSyncTime), '), timeSinceLastSync:', timeSinceLastSync, 'ms');
      
      if (timeSinceLastSync >= syncInterval) {
        console.log('🕐 Background: Popup opened, sync overdue by', Math.round(timeSinceLastSync / 1000), 'seconds, triggering sync...');
        sendResponse({ shouldSync: true, timeSinceLastSync });
      } else {
        console.log('🕐 Background: Popup opened, sync not due yet,', Math.round((syncInterval - timeSinceLastSync) / 1000), 'seconds remaining');
        sendResponse({ shouldSync: false, timeRemaining: syncInterval - timeSinceLastSync });
      }
      break;
    default:
      console.log('Unknown action:', request.action);
  }
  return true; // Keep message channel open for async responses
});

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

// Function to handle adding multiple highlights to a note
async function addHighlightsToNote(pageInfo, highlights, tab) {
  console.log('addHighlightsToNote called with:', { pageInfo, highlights, tab });
  
  if (!highlights || highlights.length === 0) {
    console.warn('No highlights provided');
    return;
  }

  const { domain, url, title } = pageInfo;
  
  // Validate that we have a proper URL and domain
  if (!url || !url.startsWith('http')) {
    console.error('Invalid pageUrl:', url);
    return;
  }
  
  if (!domain || domain === 'localhost') {
    console.error('Invalid domain:', domain);
    return;
  }
  
  console.log('Adding', highlights.length, 'highlights to note for domain:', domain);

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
    
    console.log('Multi-highlight: Raw editorState from storage:', editorState);
    
    // If there's a draft note, use it (regardless of popup state)
    if (editorState && editorState.noteDraft) {
      const cachedNote = editorState.noteDraft;
      console.log('Multi-highlight: Found draft in storage:', { 
        open: editorState.open, 
        wasEditorOpen: editorState.wasEditorOpen,
        hasDraft: !!editorState.noteDraft,
        draftDomain: cachedNote?.domain,
        targetDomain: domain,
        domainsMatch: cachedNote?.domain === domain
      });
      
      if (cachedNote.domain === domain) {
        targetNote = { ...cachedNote }; // Copy to avoid modifying original
        isDraftNote = true;
        console.log('Multi-highlight: Appending to open draft note for domain:', domain);
      } else {
        console.log('Multi-highlight: Domain mismatch - draft domain:', cachedNote.domain, 'vs target domain:', domain);
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
        
        console.log('Multi-highlight: Found notes in storage:', notes.length, 'for domain:', domain);
        
        if (notes.length > 0) {
          // Pick most recently updated
          notes.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
          targetNote = notes[0];
          console.log('Multi-highlight: Using most recent note:', targetNote.id);
        }
      } catch (error) {
        console.error('Multi-highlight: Failed to get notes from storage:', error);
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
        console.log('Multi-highlight: Updated draft note with appended highlights, preserved original properties');
        
        // Send message to popup to refresh the editor content
        chrome.runtime.sendMessage({
          action: 'context_menu_draft_updated',
          note: updatedDraft,
          type: 'append_multi_highlights'
        }).catch(() => {
          // Popup might not be open, that's okay
        });
        
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
        console.log('Multi-highlight: Appended to existing saved note:', targetNote.id);
        
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
    console.error('Multi-highlight: Failed to append to existing note, will create new note instead:', error);
  }

  // If we couldn't append to existing note, create a new one
  console.log('Multi-highlight: Creating new note for highlights');
  
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
    console.log('Multi-highlight note saved with key:', key);
    
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
    console.error('Failed to save multi-highlight note:', error);
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
    console.warn('Failed to update badge:', error);
  }
}

// Function to toggle multi-highlight mode from context menu
async function toggleMultiHighlightModeFromContextMenu(tab) {
  if (!tab || !tab.url || !tab.url.startsWith('http')) {
    console.error('Invalid tab for multi-highlight toggle');
    return;
  }

  try {
    // First check if content script is ready by sending a ping message
    let contentScriptReady = false;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      contentScriptReady = true;
      console.log('Content script is ready for context menu toggle');
    } catch (error) {
      console.warn('Content script not ready, attempting to inject:', error);
      contentScriptReady = false;
    }
    
    // If content script is not ready, try to inject it
    if (!contentScriptReady) {
      try {
        console.log('Attempting to inject content script for context menu...');
        
        if (!chrome.scripting) {
          throw new Error('Scripting API not available');
        }
        
        // Try to inject the content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
        
        console.log('Content script injection successful for context menu, waiting for initialization...');
        
        // Wait for the script to initialize and try multiple ping attempts
        let pingSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 300 * attempt)); // Progressive delay
            await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            console.log(`Context menu: Content script ping successful on attempt ${attempt}`);
            pingSuccess = true;
            break;
          } catch (pingError) {
            console.log(`Context menu: Ping attempt ${attempt} failed:`, pingError);
            if (attempt === 3) {
              throw new Error('Content script not responding after injection');
            }
          }
        }
        
        if (!pingSuccess) {
          throw new Error('Content script not responding after injection');
        }
        
        console.log('Content script injected and ready for context menu');
        contentScriptReady = true;
        
      } catch (injectError) {
        console.error('Failed to inject content script for context menu:', injectError);
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
    console.error('Failed to toggle multi-highlight mode from context menu:', error);
  }
}

// Add minimal sync timer logic to background
let syncTimer = null;
let syncInterval = 5 * 60 * 1000; // 5 minutes
let lastSyncTime = 0; // Track when we last synced

// Load lastSyncTime from storage on startup
async function loadLastSyncTime() {
  console.log('🕐 Background: loadLastSyncTime function started');
  try {
    console.log('🕐 Background: Attempting to get lastSyncTime from chrome.storage.local...');
    
    // First, let's see what's actually in storage
    const allStorage = await chrome.storage.local.get(null);
    console.log('🕐 Background: All storage keys:', Object.keys(allStorage));
    
    const result = await chrome.storage.local.get(['lastSyncTime']);
    console.log('🕐 Background: Storage result for lastSyncTime:', result);
    
    if (result.lastSyncTime) {
      const storedTime = result.lastSyncTime;
      const now = Date.now();
      
      console.log('🕐 Background: Validation - storedTime:', storedTime, 'now:', now, 'storedTime > now:', storedTime > now);
      console.log('🕐 Background: Validation - storedTime date:', new Date(storedTime), 'now date:', new Date(now));
      
      // Validate that the stored time is reasonable
      // Check for obviously invalid timestamps (future dates, extremely old dates, or NaN)
      const currentYear = new Date().getFullYear();
      const storedYear = new Date(storedTime).getFullYear();
      
      // Check if the stored timestamp is from a future year (like 2025 when we're in 2024)
      if (isNaN(storedTime) || storedTime <= 0 || storedTime > now || storedYear > currentYear) {
        console.log('🕐 Background: Stored lastSyncTime is invalid (future year, NaN, or too old), resetting to current time');
        console.log('🕐 Background: Current year:', currentYear, 'Stored year:', storedYear);
        lastSyncTime = now;
        await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
      } else if (storedTime < (now - (24 * 60 * 60 * 1000))) { // More than 24 hours ago
        console.log('🕐 Background: Stored lastSyncTime is too old (>24 hours), resetting to current time');
        lastSyncTime = now;
        await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
      } else {
        lastSyncTime = storedTime;
        console.log('🕐 Background: Loaded valid lastSyncTime from storage:', lastSyncTime, '(', new Date(lastSyncTime), ')');
      }
    } else {
      // Initialize to current time if no stored value
      console.log('🕐 Background: No stored lastSyncTime found, initializing to current time...');
      lastSyncTime = Date.now();
      await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
      console.log('🕐 Background: Initialized lastSyncTime to current time:', lastSyncTime, '(', new Date(lastSyncTime), ')');
    }
  } catch (error) {
    console.error('🕐 Background: Error loading lastSyncTime:', error);
    // Fallback to current time
    console.log('🕐 Background: Using fallback time...');
    lastSyncTime = Date.now();
    await saveLastSyncTime(); // Save the fallback time
  }
  console.log('🕐 Background: loadLastSyncTime function completed, final lastSyncTime:', lastSyncTime, '(', new Date(lastSyncTime), ')');
}

// Save lastSyncTime to storage
async function saveLastSyncTime() {
  try {
    console.log('🕐 Background: Saving lastSyncTime to storage:', lastSyncTime, '(', new Date(lastSyncTime), ')');
    await chrome.storage.local.set({ lastSyncTime: lastSyncTime });
    console.log('🕐 Background: Successfully saved lastSyncTime to storage');
    
    // Verify the save worked
    const verify = await chrome.storage.local.get(['lastSyncTime']);
    console.log('🕐 Background: Verification - retrieved from storage:', verify.lastSyncTime, '(', new Date(verify.lastSyncTime), ')');
  } catch (error) {
    console.error('🕐 Background: Error saving lastSyncTime:', error);
  }
}

// Clear corrupted lastSyncTime and reset timer
async function resetSyncTimer() {
  console.log('🕐 Background: Resetting sync timer due to corrupted data...');
  try {
    // Remove the corrupted lastSyncTime from storage
    await chrome.storage.local.remove(['lastSyncTime']);
    console.log('🕐 Background: Removed corrupted lastSyncTime from storage');
    
    // Reset to current time
    lastSyncTime = Date.now();
    await saveLastSyncTime();
    
    // Restart timer
    startSyncTimer();
  } catch (error) {
    console.error('🕐 Background: Error resetting sync timer:', error);
  }
}

// Force clear corrupted storage and reset
async function forceResetSyncTimer() {
  console.log('🕐 Background: Force resetting sync timer...');
  try {
    // Get all storage and log what we find
    const allStorage = await chrome.storage.local.get(null);
    console.log('🕐 Background: Current storage before force reset:', Object.keys(allStorage));
    
    // Remove the corrupted lastSyncTime from storage
    await chrome.storage.local.remove(['lastSyncTime']);
    console.log('🕐 Background: Force removed lastSyncTime from storage');
    
    // Reset to current time
    lastSyncTime = Date.now();
    await saveLastSyncTime();
    
    // Restart timer
    startSyncTimer();
  } catch (error) {
    console.error('🕐 Background: Error in force reset:', error);
  }
}

function startSyncTimer() {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  
  console.log('🕐 Background: Starting sync timer for 5 minutes...');
  console.log('🕐 Background: startSyncTimer called with lastSyncTime:', lastSyncTime, '(', new Date(lastSyncTime), ')');
  
  // Set a one-time timeout instead of interval
  syncTimer = setTimeout(() => {
    console.log('🕐 Background: Timer fired! Sending sync-timer-triggered message...');
    
    // Send message to popup to trigger sync
    chrome.runtime.sendMessage({ action: 'sync-timer-triggered' }).catch(() => {
      // Popup might be closed, that's okay
      console.log('🕐 Background: Popup closed, sync message not delivered');
      // Mark that we need to sync when popup opens
      // Don't set lastSyncTime here - let the popup handle it when it opens
      // This prevents the invalid future timestamp issue
    });
    
    // Clear the timer after it fires
    syncTimer = null;
    console.log('🕐 Background: Timer cleared, waiting for restart message...');
  }, syncInterval);
}

function stopSyncTimer() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
    console.log('🕐 Background: Timer stopped');
  }
  // Reset lastSyncTime when stopping timer (e.g., user signs out)
  lastSyncTime = 0;
  saveLastSyncTime();
}

// Start timer when extension loads
console.log('🕐 Background: Extension loaded, starting initial sync timer...');
console.log('🕐 Background: About to load lastSyncTime from storage...');

// Add a small delay to ensure storage is ready
setTimeout(() => {
  loadLastSyncTime().then(() => {
    console.log('🕐 Background: loadLastSyncTime completed, lastSyncTime is now:', lastSyncTime, '(', new Date(lastSyncTime), ')');
    
    // Force reset if the timestamp is still corrupted after validation
    const currentYear = new Date().getFullYear();
    const storedYear = new Date(lastSyncTime).getFullYear();
    
    if (lastSyncTime > Date.now() || storedYear > currentYear) {
      console.log('🕐 Background: Timestamp still corrupted after validation (future date or future year), forcing reset...');
      console.log('🕐 Background: Current year:', currentYear, 'Stored year:', storedYear);
      forceResetSyncTimer().then(() => {
        console.log('🕐 Background: Force reset completed, timer should now work correctly');
      });
    } else {
      startSyncTimer();
    }
  }).catch(error => {
    console.error('🕐 Background: Error in loadLastSyncTime:', error);
    // Fallback: start timer anyway
    startSyncTimer();
  });
}, 100);


