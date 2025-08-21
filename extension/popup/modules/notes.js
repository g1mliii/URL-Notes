// NotesManager: handles notes rendering and filter list UI
// Loaded as a plain script; exposes NotesManager as a global class.

class NotesManager {
  constructor(app) {
    this.app = app; // reference to URLNotesApp
  }

  // Public entry: render notes list based on current filter and search
  render() {
    const { app } = this;
    const notesList = document.getElementById('notesList');
    const searchInput = document.getElementById('searchInput');
    let emptyState = document.getElementById('emptyState');
    if (!notesList) return;
    notesList.innerHTML = '';

    // 1) Filter
    let filteredNotes = [];
    if (app.filterMode === 'site') {
      filteredNotes = app.allNotes.filter(n => n.domain === (app.currentSite && app.currentSite.domain));
    } else if (app.filterMode === 'page') {
      const currentKey = app.normalizePageKey(app.currentSite && app.currentSite.url);
      filteredNotes = app.allNotes.filter(n => app.normalizePageKey(n.url) === currentKey);
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
          <h4>No notes found</h4>
          <p>Try a different filter or create a new note.</p>
        `;
      }
      notesList.innerHTML = '';
      notesList.appendChild(emptyState);
      emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    notesList.innerHTML = '';

    // Search placeholder is now handled centrally in popup.js to prevent caching conflicts
    // No need to update it here anymore

    if (app.filterMode === 'all_notes') {
      this.renderGroupedNotes(filteredNotes);
    } else {
      filteredNotes.forEach(note => {
        const el = this.createNoteElement(note);
        notesList.appendChild(el);
      });
    }
  }

  // Render notes grouped by domain for 'All Notes' view
  renderGroupedNotes(notes) {
    const notesList = document.getElementById('notesList');
    const grouped = this.groupNotesByDomain(notes);
    const sortedDomains = Object.keys(grouped).sort();

    notesList.innerHTML = '';
    notesList.classList.add('notes-fade-in');

    // Load saved open domains IMMEDIATELY to prevent visual shift
    let openSet = new Set();
    try {
      // Use synchronous storage access for immediate restoration
      chrome.storage.local.get(['allNotesOpenDomains'], ({ allNotesOpenDomains }) => {
        openSet = new Set(Array.isArray(allNotesOpenDomains) ? allNotesOpenDomains : []);
        // Continue with rendering after getting cached state
        this.renderDomainGroups(notesList, grouped, sortedDomains, openSet);
      });
    } catch (_) {
      // Fallback: render without persistence
      this.renderDomainGroups(notesList, grouped, sortedDomains, openSet);
    }
  }

  // NEW: Separate method to render domain groups with cached open state
  renderDomainGroups(notesList, grouped, sortedDomains, openSet) {
    const { app } = this; // Get app reference from this instance
    
    // Debounced saver to avoid thrashing
    const saveOpenDomains = Utils.debounce(() => {
      try {
        const currentlyOpen = Array.from(notesList.querySelectorAll('details.domain-group'))
          .filter(d => d.open)
          .map(d => d.getAttribute('data-domain'))
          .filter(Boolean);
        chrome.storage.local.set({ allNotesOpenDomains: currentlyOpen });
      } catch (_) {}
    }, 120);

    sortedDomains.forEach(domain => {
      const { notes: domainNotes, tags } = grouped[domain];
      const domainGroup = document.createElement('details');
      domainGroup.className = 'domain-group';
      domainGroup.setAttribute('data-domain', domain);
      const domainIndex = sortedDomains.indexOf(domain);
      
      // Set open state immediately based on cached value to prevent visual shift
      domainGroup.open = app.searchQuery ? (domainIndex < 2) : openSet.has(domain);

      const rightDomainTagsHtml = (tags && tags.length > 0) ? `
        <div class="domain-tags domain-tags-right">
          ${tags.map(tag => `<span class=\"note-tag\">${tag}</span>`).join('')}
        </div>
      ` : '';

      domainGroup.innerHTML = `
        <summary class="domain-group-header">
          <div class="domain-header-info">
            <span>${domain} (${domainNotes.length})</span>
          </div>
          <div class="domain-actions">
            <button class="icon-btn sm glass open-domain-btn" data-domain="${domain}" title="Open ${domain}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            <button class="icon-btn sm glass delete-domain-btn" data-domain="${domain}" title="Delete all notes for this domain">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2,0,0,1-2,2H7a2,2 0,0,1 -2,-2V6m3,0V4a2,2 0,0,1 2,-2h4a2,2 0,0,1 2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
          ${rightDomainTagsHtml}
        </summary>
        <div class="domain-notes-list"></div>
      `;

      const deleteDomainBtn = domainGroup.querySelector('.delete-domain-btn');
      const openDomainBtn = domainGroup.querySelector('.open-domain-btn');
      const domainNotesList = domainGroup.querySelector('.domain-notes-list');

      // Two-tap delete confirmation
      deleteDomainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.handleTwoTapDelete(deleteDomainBtn, () => app.deleteNotesByDomain(domain, true));
      });

      if (openDomainBtn) {
        openDomainBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          app.openDomainHomepage(domain);
        });
      }

      // Persist open/close on toggle
      domainGroup.addEventListener('toggle', () => {
        saveOpenDomains();
      });

      domainNotes.forEach(n => {
        const noteEl = this.createNoteElement(n);
        noteEl.classList.add('note-item-stagger');
        domainNotesList.appendChild(noteEl);
      });
      notesList.appendChild(domainGroup);
    });
  }

  groupNotesByDomain(notes) {
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
        .sort(([,a],[,b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag);
    }
    return grouped;
  }

  createNoteElement(note) {
    const { app } = this;
    const el = document.createElement('div');
    el.className = 'note-item';
    el.addEventListener('click', () => app.openNote(note));

    const pageIndicator = (app.filterMode !== 'page' && app.isCurrentPageNote(note)) ?
      '<span class="page-indicator" data-tooltip="Current page note">•</span>' : '';

    el.innerHTML = `
      <div class="note-content">
        <div class="note-main">
          <h4 class="note-title">${pageIndicator}${note.title || 'Untitled'}</h4>
          <div class="note-date-inline">${Utils.formatDate(note.updatedAt)}</div>
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
              ${window.notesStorage?.isVersionHistoryAvailable ? `
              <button class="icon-btn sm version-history-btn" title="Version History">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>
                </svg>
              </button>
              ` : ''}
              <button class="icon-btn sm delete-note-btn" data-note-id="${note.id}" title="Delete note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="m19,6v14a2,2,0,0,1-2,2H7a2,2 0,0,1 -2,-2V6m3,0V4a2,2 0,0,1 2,-2h4a2,2 0,0,1 2,2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
          </div>
        </div>
        ${(note.tags && note.tags.length > 0) ? `<div class="note-tags">${note.tags.map(t => `<span class=\"note-tag\">${t}</span>`).join('')}</div>` : ''}
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

  // Add method to show version history
  async showVersionHistory(note) {
    try {
      const versions = await window.notesStorage.getVersionHistory(note.id);
      
      if (versions.length === 0) {
        window.showToast('No version history available', 'info');
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
      window.showToast('Failed to load version history', 'error');
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
      
      // Create new version with restored content
      const restoredNote = {
        ...currentNote,
        title: targetVersion.title,
        content: targetVersion.content,
        version: currentNote.version + 1,
        updatedAt: new Date().toISOString()
      };
      
      // Save the restored note
      await window.notesStorage.saveNote(restoredNote);
      
      // Refresh the UI
      window.eventBus?.emit('notes:updated', { noteId });
      
      window.showToast('Version restored successfully', 'success');
      
    } catch (error) {
      console.error('Failed to restore version:', error);
      window.showToast('Failed to restore version', 'error');
    }
  }
}
