// NotesManager: handles notes rendering and filter list UI
// Loaded as a plain script; exposes NotesManager as a global class.

class NotesManager {
  constructor(app) {
    this.app = app; // reference to URLNotesApp
  }

  // Public entry: render notes list based on current filter and search
  async render() {
    const { app } = this;
    const notesList = document.getElementById('notesList');
    const searchInput = document.getElementById('searchInput');
    const notesCount = document.getElementById('notesCount');
    if (!notesList) return;

    // Use DocumentFragment for smoother rendering
    const fragment = document.createDocumentFragment();

    // Show empty state if no notes exist
    if (!app.allNotes || app.allNotes.length === 0) {
      this.showEmptyState(notesList, 'No notes yet', 'Create your first note to get started!');
      if (notesCount) notesCount.style.display = 'none';
      return;
    }

    // Only clear if we have notes to clear
    if (notesList.children.length > 0) {
      notesList.innerHTML = '';
    }

    // Safety check: ensure allNotes is available
    if (!app.allNotes || !Array.isArray(app.allNotes)) {
      console.warn('NotesManager.render: app.allNotes is not available, showing empty state');
      this.showEmptyState(notesList, 'Loading notes...');
      if (notesCount) notesCount.style.display = 'none';
      return;
    }

    // 1) Filter
    let filteredNotes = [];

    if (app.filterMode === 'site') {
      // Only filter by site if we have a valid currentSite with domain
      if (app.currentSite && app.currentSite.domain && app.currentSite.domain !== 'localhost') {
        filteredNotes = app.allNotes.filter(n => n.domain === app.currentSite.domain);
      } else {
        // If no valid currentSite, show all notes instead of empty state to prevent pop-in
        filteredNotes = app.allNotes;
        console.log('NotesManager.render: No valid currentSite domain, showing all notes for site filter');
      }
    } else if (app.filterMode === 'page') {
      // Only filter by page if we have a valid currentSite with URL
      if (app.currentSite && app.currentSite.url && app.currentSite.url !== 'http://localhost') {
        const currentKey = app.normalizePageKey(app.currentSite.url);
        filteredNotes = app.allNotes.filter(n => app.normalizePageKey(n.url) === currentKey);
      } else {
        // If no valid currentSite URL, show all notes instead of empty state to prevent pop-in
        filteredNotes = app.allNotes;
        console.log('NotesManager.render: No valid currentSite URL, showing all notes for page filter');
      }
    } else {
      filteredNotes = app.allNotes;
    }

    // 2) Search with simple scoring
    const q = (app.searchQuery || '').toLowerCase();
    if (q) {
      filteredNotes = filteredNotes
        .map(note => {
          let score = 0;
          if (note.domain && note.domain.toLowerCase().includes(q)) score += 4;
          if ((note.title || '').toLowerCase().includes(q)) score += 3;
          if ((note.tags || []).some(t => (t || '').toLowerCase().includes(q))) score += 2;
          if ((note.content || '').toLowerCase().includes(q)) score += 1;
          return { note, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.note);
    }

    // 3) Render list or empty state
    if (filteredNotes.length === 0) {
      this.showEmptyState(notesList, 'No notes found', 'Try a different filter or create a new note.');
      if (notesCount) notesCount.style.display = 'none';
      return;
    }

    // Show counter inline with notes title
    if (notesCount) {
      notesCount.style.display = 'inline';
      notesCount.textContent = `(${filteredNotes.length})`;
    }

    // Don't clear again - already cleared at the beginning

    // Search placeholder is now handled centrally in popup.js to prevent caching conflicts
    // No need to update it here anymore

    if (app.filterMode === 'all_notes') {
      await this.renderGroupedNotes(filteredNotes, notesList);
    } else {
      // Check premium status once for all notes using cached function
      const premiumStatus = await getPremiumStatus();
      const isPremium = premiumStatus.isPremium;

      // Use DocumentFragment for smoother rendering
      for (const note of filteredNotes) {
        const el = await this.createNoteElement(note, isPremium);
        fragment.appendChild(el);
      }

      // Append all notes at once for better performance
      notesList.appendChild(fragment);
    }
  }

  // Render notes grouped by domain for 'All Notes' view
  async renderGroupedNotes(notes, container) {
    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      container.innerHTML = '<div class="empty-state">No notes found</div>';
      const notesCount = document.getElementById('notesCount');
      if (notesCount) notesCount.style.display = 'none';
      return;
    }

    // Show counter for grouped notes
    const notesCount = document.getElementById('notesCount');
    if (notesCount) {
      notesCount.style.display = 'inline';
      notesCount.textContent = `(${notes.length})`;
    }

    // Check premium status once for all notes using cached function
    const premiumStatus = await getPremiumStatus();
    const isPremium = premiumStatus.isPremium;

    const grouped = this.groupNotesByDomain(notes);
    const sortedDomains = Object.keys(grouped).sort();

    // Clear container for new content
    container.innerHTML = '';
    container.classList.add('notes-fade-in');

    // Load saved open domains to prevent visual shift
    let openSet = new Set();
    try {
      const { allNotesOpenDomains } = await chrome.storage.local.get(['allNotesOpenDomains']);
      openSet = new Set(Array.isArray(allNotesOpenDomains) ? allNotesOpenDomains : []);
    } catch (_) {
      // Fallback: empty set
    }

    for (const domain of sortedDomains) {
      const { notes: domainNotes, tags } = grouped[domain];
      const domainGroup = document.createElement('details');
      domainGroup.className = 'domain-group';
      domainGroup.setAttribute('data-domain', domain);

      // Set open state based on cached value
      domainGroup.open = openSet.has(domain);

      const rightDomainTagsHtml = (tags && tags.length > 0) ? `
        <div class="domain-tags domain-tags-right">
          ${tags.map(tag => `<span class="note-tag">${tag}</span>`).join('')}
        </div>
      ` : '';

      domainGroup.innerHTML = `
        <summary class="domain-group-header">
          <div class="domain-header-info">
            <span>${domain} (${domainNotes.length})</span>
          </div>

          ${rightDomainTagsHtml}
        </summary>
        <div class="domain-actions">
          <button class="icon-btn sm glass open-domain-btn" data-domain="${domain}" title="Open ${domain}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15,3 21,3 21,9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <button class="icon-btn sm glass delete-domain-btn" data-domain="${domain}" title="Delete all notes for this domain">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="m19,6v14a2,2,0,0,1-2,2H7a2,2 0,0,1 -2,-2V6m3,0V4a2,2 0,0,1 2,-2h4a2,2 0,0,1 2,2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
        <div class="domain-notes-list"></div>
      `;

      const deleteDomainBtn = domainGroup.querySelector('.delete-domain-btn');
      const openDomainBtn = domainGroup.querySelector('.open-domain-btn');
      const domainNotesList = domainGroup.querySelector('.domain-notes-list');

      // Two-tap delete confirmation - updated for simplified sync
      deleteDomainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.handleTwoTapDelete(deleteDomainBtn, () => this.deleteDomainNotesIndividually(domainNotes));
      });

      if (openDomainBtn) {
        openDomainBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.app.openDomainHomepage(domain);
        });
      }

      // Persist open/close state
      domainGroup.addEventListener('toggle', () => {
        this.saveOpenDomains(container);
      });

      // Process notes sequentially
      for (const n of domainNotes) {
        const noteEl = await this.createNoteElement(n, isPremium);
        noteEl.classList.add('note-item-stagger');
        domainNotesList.appendChild(noteEl);
      }

      container.appendChild(domainGroup);
    }

    // Grouped notes rendered successfully
  }

  groupNotesByDomain(notes) {
    // Safety check: ensure notes is an array
    if (!notes || !Array.isArray(notes)) {
      console.warn('NotesManager.groupNotesByDomain: notes is not an array');
      return {};
    }

    const grouped = notes.reduce((acc, note) => {
      const domain = note.domain || 'No Domain';
      if (!acc[domain]) acc[domain] = { notes: [], tagCounts: {} };
      acc[domain].notes.push(note);
      (note.tags || []).forEach(tag => {
        acc[domain].tagCounts[tag] = (acc[domain].tagCounts[tag] || 0) + 1;
      });
      return acc;
    }, {});

    for (const d in grouped) {
      grouped[d].tags = Object.entries(grouped[d].tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag);
    }
    return grouped;
  }

  async createNoteElement(note, isPremium = false) {
    const { app } = this;
    const el = document.createElement('div');
    el.className = 'note-item';
    el.addEventListener('click', () => app.openNote(note));

    const pageIndicator = (app.filterMode !== 'page' && app.isCurrentPageNote(note)) ?
      '<span class="page-indicator" data-tooltip="Current page note">•</span>' : '';

    // Use passed premium status instead of checking again
    const hasVersionHistory = isPremium;

    // Only log debug info in development mode
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('Creating note element:', {
        noteId: note.id,
        notesStorage: !!window.notesStorage,
        hasCheckPremiumAccess: !!window.notesStorage?.checkPremiumAccess,
        isVersionHistoryAvailableResult: hasVersionHistory,
        premiumStatus: isPremium,
        supabaseClient: !!window.supabaseClient
      });
    }

    el.innerHTML = `
      <div class="note-content">
        <div class="note-main">
          <h4 class="note-title">${pageIndicator}${note.title || 'Untitled'}</h4>
          <div class="note-date-inline">${Utils.formatDate(note.updatedAt)}</div>
          ${(note.tags && note.tags.length > 0) ? `
            <div class="note-tags-inline">
              ${note.tags.slice(0, 3).map(t => `<span class="note-tag-inline">${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="note-sidebar">
          <div class="note-actions">
            <button class="icon-btn sm open-page-btn" data-url="${note.url}" title="Open page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15,3 21,3 21,9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </button>
                             ${hasVersionHistory ? `
               <button class="icon-btn sm version-history-btn" title="Version History">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>
                 </svg>
               </button>
               ` : ''}
              <button class="icon-btn sm delete-note-btn" data-note-id="${note.id}" title="Delete note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="m19,6v14a2,2,0,0,1-2,2H7a2 2 0,0,1 -2,-2V6m3,0V4a2 2 0,0,1 2,-2h4a2 2 0,0,1 2,2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
          </div>
        </div>
      </div>
    `;

    const openBtn = el.querySelector('.open-page-btn');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const displayText = note.title || note.pageTitle || '';
        app.openLinkAndHighlight(note.url, displayText);
      });
    }

    // Add version history button event listener
    const versionBtn = el.querySelector('.version-history-btn');
    if (versionBtn) {
      versionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Version history button clicked for note:', note.id);
        console.log('this.showVersionHistory exists:', !!this.showVersionHistory);
        console.log('this context:', this);
        this.showVersionHistory(note);
      });
    }

    const deleteBtn = el.querySelector('.delete-note-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTwoTapDelete(deleteBtn, () => app.deleteNoteFromList(note.id, true));
      });
    }

    return el;
  }

  handleTwoTapDelete(btn, onConfirm) {
    try {
      const armed = btn.getAttribute('data-armed') === 'true';
      if (armed) {
        btn.removeAttribute('data-armed');
        btn.classList.remove('confirm', 'danger');
        if (btn._confirmTimer) { clearTimeout(btn._confirmTimer); btn._confirmTimer = null; }
        onConfirm && onConfirm();
        return;
      }
      btn.setAttribute('data-armed', 'true');
      btn.classList.add('confirm', 'danger');
      const prevTitle = btn.getAttribute('title') || '';
      btn.setAttribute('data-prev-title', prevTitle);
      btn.setAttribute('title', 'Click again to delete');
      btn._confirmTimer = setTimeout(() => {
        btn.removeAttribute('data-armed');
        btn.classList.remove('confirm', 'danger');
        const pt = btn.getAttribute('data-prev-title');
        if (pt !== null) btn.setAttribute('title', pt);
      }, 2000);
    } catch (_) {
      onConfirm && onConfirm();
    }
  }

  // Add method to show version history
  async showVersionHistory(note) {
    try {
      const versions = await window.notesStorage.getVersionHistory(note.id);

      if (versions.length === 0) {
        // Use the app's notification method instead of window.showToast
        if (this.app && this.app.showNotification) {
          this.app.showNotification('No version history available', 'info');
        } else {
          console.log('No version history available');
        }
        return;
      }

      // Create version history dialog
      const dialog = document.createElement('div');
      dialog.className = 'version-history-dialog';
      dialog.innerHTML = `
        <div class="version-history-content">
          <div class="version-history-header">
            <h3>Version History</h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="version-list">
            ${versions.map((version, index) => `
              <div class="version-item ${index === 0 ? 'current' : ''}">
                <div class="version-header">
                  <span class="version-number">v${version.version}</span>
                  <span class="version-date">${new Date(version.createdAt).toLocaleDateString()}</span>
                  ${index === 0 ? '<span class="current-badge">Current</span>' : ''}
                </div>
                <div class="version-preview">${this.buildPreviewHtml(version.content)}</div>
                <button class="restore-btn" data-version="${version.version}">Restore</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // Add event listeners
      dialog.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(dialog);
      });

      dialog.querySelectorAll('.restore-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const versionNum = parseInt(e.target.dataset.version);
          await this.restoreVersion(note.id, versionNum);
          document.body.removeChild(dialog);
        });
      });

      document.body.appendChild(dialog);

    } catch (error) {
      console.error('Failed to show version history:', error);
      // Use the app's notification method instead of window.showToast
      if (this.app && this.app.showNotification) {
        this.app.showNotification('Failed to load version history', 'error');
      } else {
        console.error('Failed to load version history:', error);
      }
    }
  }

  // Add method to restore a version
  async restoreVersion(noteId, versionNum) {
    try {
      const versions = await window.notesStorage.getVersionHistory(noteId);
      const targetVersion = versions.find(v => v.version === versionNum);

      if (!targetVersion) {
        throw new Error('Version not found');
      }

      // Get current note
      const currentNote = await window.notesStorage.getNote(noteId);
      if (!currentNote) {
        throw new Error('Note not found');
      }

      // Instead of creating a new version, open the restored content as a draft
      // This allows the user to review and manually save if they want to keep it
      const restoredContent = {
        ...currentNote,
        title: targetVersion.title,
        content: targetVersion.content,
        // Don't increment version - this is just a draft
        // Don't update updatedAt - this will happen when they manually save
        isDraft: true,
        draftSource: `Restored from version ${versionNum}`,
        draftTimestamp: new Date().toISOString()
      };

      // Open the note in the editor with restored content
      if (this.app && this.app.openNote) {
        this.app.openNote(restoredContent);
      }

      // Use the app's notification method instead of window.showToast
      if (this.app && this.app.showNotification) {
        this.app.showNotification('Version restored as draft - save to keep changes', 'info');
      }

    } catch (error) {
      console.error('Failed to restore version:', error);
      // Use the app's notification method instead of window.showToast
      if (this.app && this.app.showNotification) {
        this.app.showNotification('Failed to restore version', 'error');
      } else {
        console.error('Failed to restore version:', error);
      }
    }
  }

  buildPreviewHtml(content) {
    try {
      const firstLine = (content || '').split('\n')[0];
      if (!firstLine) return '';
      const escapeHtml = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const bulletMatch = firstLine.match(/^\s*-\s*(.*)$/);
      const line = bulletMatch ? bulletMatch[1] : firstLine;

      const mdLink = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
      let replaced = '';
      let lastIndex = 0;
      let match;
      while ((match = mdLink.exec(line)) !== null) {
        replaced += escapeHtml(line.slice(lastIndex, match.index));
        const text = escapeHtml(match[1]);
        replaced += `${text}`;
        lastIndex = mdLink.lastIndex;
      }
      replaced += escapeHtml(line.slice(lastIndex));

      const bulletPrefix = bulletMatch ? '&#8226; ' : '';
      return `${bulletPrefix}${replaced}`;
    } catch (e) {
      return (content || '').substring(0, 100);
    }
  }

  // Helper method to show empty state
  showEmptyState(notesList, title = 'No notes found', message = 'Try a different filter or create a new note.') {
    let emptyState = document.getElementById('emptyState');
    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.id = 'emptyState';
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
        </div>
        <h4>${title}</h4>
        <p>${message}</p>
      `;
    } else {
      // Update existing empty state
      const titleEl = emptyState.querySelector('h4');
      const messageEl = emptyState.querySelector('p');
      if (titleEl) titleEl.textContent = title;
      if (messageEl) messageEl.textContent = message;
    }

    // Only clear if there are other children to prevent unnecessary clearing
    if (notesList.children.length > 0 && !notesList.querySelector('#emptyState')) {
      notesList.innerHTML = '';
    }
    notesList.appendChild(emptyState);
    emptyState.style.display = 'flex';
  }

  // Save open domains state
  saveOpenDomains(container) {
    try {
      const currentlyOpen = Array.from(container.querySelectorAll('details.domain-group'))
        .filter(d => d.open)
        .map(d => d.getAttribute('data-domain'))
        .filter(Boolean);
      chrome.storage.local.set({ allNotesOpenDomains: currentlyOpen });
    } catch (_) { }
  }



  // Delete domain notes individually (for simplified sync)
  async deleteDomainNotesIndividually(domainNotes) {
    try {
      let deletedCount = 0;

      // Delete each note individually
      for (const note of domainNotes) {
        try {
          await this.app.storageManager.deleteNote(note.id);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete note ${note.id}:`, error);
        }
      }

      // Show success message
      if (deletedCount > 0) {
        this.app.showNotification(`Deleted ${deletedCount} notes`, 'success');
        // Refresh the notes display
        this.render();
      }

    } catch (error) {
      console.error('Error deleting domain notes individually:', error);
      this.app.showNotification('Failed to delete some notes', 'error');
    }
  }
}

// Debug: Check if NotesManager is defined
// NotesManager loaded successfully
