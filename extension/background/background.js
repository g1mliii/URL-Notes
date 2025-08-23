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
