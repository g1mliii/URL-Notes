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

    // Update search placeholder to reflect scope
    if (searchInput) {
      const map = {
        all_notes: 'Search all notes...',
        site: 'Search site notes...',
        page: 'Search page notes...'
      };
      searchInput.placeholder = map[app.filterMode] || 'Search notes...';
    }

    if (app.filterMode === 'all_notes') {
      this.renderGroupedNotes(filteredNotes);
    } else {
      filteredNotes.forEach(note => {
        const el = this.createNoteElement(note);
        notesList.appendChild(el);
      });
    }
  }

  // Group + render for All Notes view
  renderGroupedNotes(notes) {
    const { app } = this;
    const notesList = document.getElementById('notesList');
    if (!notesList) return;
    const grouped = this.groupNotesByDomain(notes);
    const sortedDomains = Object.keys(grouped).sort();

    notesList.innerHTML = '';

    sortedDomains.forEach(domain => {
      const { notes: domainNotes, tags } = grouped[domain];
      const domainGroup = document.createElement('details');
      domainGroup.className = 'domain-group';
      const domainIndex = sortedDomains.indexOf(domain);
      domainGroup.open = app.searchQuery && domainIndex < 2;

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
          <div class="domain-actions">
            <button class="icon-btn sm glass open-domain-btn" data-domain="${domain}" title="Open ${domain}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            <button class="icon-btn sm glass delete-domain-btn" data-domain="${domain}" title="Delete all notes for this domain">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
          ${rightDomainTagsHtml}
        </summary>
        <div class="domain-notes-list"></div>
      `;

      const deleteDomainBtn = domainGroup.querySelector('.delete-domain-btn');
      const openDomainBtn = domainGroup.querySelector('.open-domain-btn');
      const domainNotesList = domainGroup.querySelector('.domain-notes-list');

      // Two-tap delete confirmation (same pattern as note cards/editor)
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

      domainNotes.forEach(n => domainNotesList.appendChild(this.createNoteElement(n)));
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
              <button class="icon-btn sm delete-note-btn" data-note-id="${note.id}" title="Delete note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
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
}
