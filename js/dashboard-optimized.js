// Dashboard Performance Optimizations
class DashboardOptimizer {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.renderQueue = [];
        this.isRendering = false;
        this.virtualScrollContainer = null;
        this.visibleRange = { start: 0, end: 50 }; // Show only 50 items initially
        this.itemHeight = 120; // Approximate height of each note card
        this.init();
    }

    init() {
        this.optimizeEventListeners();
        this.setupVirtualScrolling();
        this.optimizeFiltering();
        this.setupRequestIdleCallback();
    }

    // Debounce and throttle event listeners
    optimizeEventListeners() {
        const dashboard = this.dashboard;

        // Replace multiple event listeners with delegated ones
        this.setupEventDelegation();

        // Optimize search with better debouncing
        this.optimizeSearchHandlers();

        // Optimize auto-save with better throttling
        this.optimizeAutoSave();
    }

    setupEventDelegation() {
        // Single event listener for all note card interactions
        const notesGrid = document.getElementById('notesGrid');
        if (notesGrid) {
            notesGrid.addEventListener('click', this.handleNoteGridClick.bind(this), { passive: true });
            notesGrid.addEventListener('change', this.handleNoteGridChange.bind(this), { passive: true });
        }
    }

    handleNoteGridClick(e) {
        const noteCard = e.target.closest('.note-card');
        if (!noteCard) return;

        const noteId = noteCard.dataset.noteId;
        if (!noteId) return;

        // Handle different click targets
        if (e.target.matches('.note-checkbox')) {
            return; // Let change handler deal with this
        }

        // Open note editor
        this.dashboard.showNoteEditor(noteId);
    }

    handleNoteGridChange(e) {
        if (e.target.matches('.note-checkbox')) {
            const noteId = e.target.dataset.noteId;
            this.dashboard.toggleNoteSelection(noteId);
        }
    }

    optimizeSearchHandlers() {
        const searchInputs = ['mainSearchInput', 'searchInput'];

        searchInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                // Remove existing listeners and add optimized one
                const optimizedHandler = this.debounce((value) => {
                    this.queueRender(() => this.dashboard.handleSearch(value));
                }, 150); // Reduced debounce time but with queued rendering

                input.addEventListener('input', (e) => optimizedHandler(e.target.value), { passive: true });
            }
        });
    }

    optimizeAutoSave() {
        const autoSaveElements = ['noteTitle', 'noteContent', 'noteUrl'];

        autoSaveElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                // Throttled auto-save instead of debounced
                const throttledSave = this.throttle(() => {
                    this.queueRender(() => this.dashboard.handleAutoSave());
                }, 1000);

                element.addEventListener('input', throttledSave, { passive: true });
                element.addEventListener('blur', () => this.dashboard.handleAutoSave(), { passive: true });
            }
        });
    }

    // Virtual scrolling for large note lists
    setupVirtualScrolling() {
        const notesGrid = document.getElementById('notesGrid');
        if (!notesGrid) return;

        // Create virtual scroll container
        this.virtualScrollContainer = document.createElement('div');
        this.virtualScrollContainer.className = 'virtual-scroll-container';
        this.virtualScrollContainer.style.cssText = `
      height: 100%;
      overflow-y: auto;
      position: relative;
    `;

        // Wrap existing grid
        const parent = notesGrid.parentNode;
        parent.insertBefore(this.virtualScrollContainer, notesGrid);
        this.virtualScrollContainer.appendChild(notesGrid);

        // Add scroll listener with throttling
        const throttledScroll = this.throttle(() => {
            this.updateVisibleRange();
        }, 16); // ~60fps

        this.virtualScrollContainer.addEventListener('scroll', throttledScroll, { passive: true });
    }

    updateVisibleRange() {
        if (!this.virtualScrollContainer) return;

        const scrollTop = this.virtualScrollContainer.scrollTop;
        const containerHeight = this.virtualScrollContainer.clientHeight;

        const start = Math.floor(scrollTop / this.itemHeight);
        const visibleCount = Math.ceil(containerHeight / this.itemHeight);
        const buffer = 10; // Render extra items for smooth scrolling

        this.visibleRange = {
            start: Math.max(0, start - buffer),
            end: Math.min(this.dashboard.filteredNotes.length, start + visibleCount + buffer * 2)
        };

        this.queueRender(() => this.renderVisibleNotes());
    }

    renderVisibleNotes() {
        const notesGrid = document.getElementById('notesGrid');
        if (!notesGrid || !this.dashboard.filteredNotes) return;

        const { start, end } = this.visibleRange;
        const visibleNotes = this.dashboard.filteredNotes.slice(start, end);

        // Create document fragment for efficient DOM manipulation
        const fragment = document.createDocumentFragment();

        // Add spacer for items above visible range
        if (start > 0) {
            const topSpacer = document.createElement('div');
            topSpacer.style.height = `${start * this.itemHeight}px`;
            topSpacer.className = 'virtual-spacer-top';
            fragment.appendChild(topSpacer);
        }

        // Render visible notes
        visibleNotes.forEach(note => {
            const noteCard = this.createOptimizedNoteCard(note);
            fragment.appendChild(noteCard);
        });

        // Add spacer for items below visible range
        const remaining = this.dashboard.filteredNotes.length - end;
        if (remaining > 0) {
            const bottomSpacer = document.createElement('div');
            bottomSpacer.style.height = `${remaining * this.itemHeight}px`;
            bottomSpacer.className = 'virtual-spacer-bottom';
            fragment.appendChild(bottomSpacer);
        }

        // Replace content efficiently
        notesGrid.innerHTML = '';
        notesGrid.appendChild(fragment);
    }

    createOptimizedNoteCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.dataset.noteId = note.id;

        const isSelected = this.dashboard.selectedNotes.has(note.id);
        if (isSelected) {
            card.classList.add('selected');
        }

        // Use template literals with minimal DOM manipulation
        card.innerHTML = this.getNoteCardTemplate(note, isSelected);

        return card;
    }

    getNoteCardTemplate(note, isSelected) {
        const title = this.escapeHtml(note.title);
        const preview = this.escapeHtml(note.preview);
        const url = note.url ? this.escapeHtml(this.truncateUrl(note.url)) : '';
        const tags = note.tags && note.tags.length > 0
            ? note.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')
            : '';

        return `
      <div class="note-card-selection">
        <input type="checkbox" class="note-checkbox" ${isSelected ? 'checked' : ''} data-note-id="${note.id}">
      </div>
      <div class="note-card-content">
        <div class="note-card-header">
          <div class="note-card-title">${title}</div>
          <div class="note-card-date">${note.formattedDate}</div>
        </div>
        <div class="note-card-preview">${preview}</div>
        ${url ? `<div class="note-card-url">${url}</div>` : ''}
        ${tags ? `<div class="note-card-tags">${tags}</div>` : ''}
      </div>
    `;
    }

    // Optimize filtering with better algorithms
    optimizeFiltering() {
        const originalApplyFilters = this.dashboard.applyFilters.bind(this.dashboard);

        this.dashboard.applyFilters = () => {
            this.queueRender(() => {
                // Use more efficient filtering
                this.applyOptimizedFilters();
            });
        };
    }

    applyOptimizedFilters() {
        let filtered = this.dashboard.notes;
        const filter = this.dashboard.currentFilter;

        // Early return if no filters
        if (!filter.domain && !filter.dateRange && !filter.search) {
            this.dashboard.filteredNotes = filtered;
            this.renderNotes();
            return;
        }

        // Apply filters in order of selectivity (most selective first)
        if (filter.search) {
            const searchTerm = filter.search.toLowerCase();
            filtered = filtered.filter(note => {
                return note.title.toLowerCase().includes(searchTerm) ||
                    note.content.toLowerCase().includes(searchTerm) ||
                    note.domain.toLowerCase().includes(searchTerm) ||
                    note.url.toLowerCase().includes(searchTerm) ||
                    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
            });
        }

        if (filter.domain) {
            filtered = filtered.filter(note => note.domain === filter.domain);
        }

        if (filter.dateRange) {
            const cutoffDate = this.getDateRangeCutoff(filter.dateRange);
            if (cutoffDate) {
                filtered = filtered.filter(note => new Date(note.updatedAt) >= cutoffDate);
            }
        }

        this.dashboard.filteredNotes = filtered;
        this.renderNotes();
    }

    getDateRangeCutoff(dateRange) {
        const now = new Date();
        switch (dateRange) {
            case 'today':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate());
            case 'week':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case 'month':
                return new Date(now.getFullYear(), now.getMonth(), 1);
            default:
                return null;
        }
    }

    renderNotes() {
        if (this.dashboard.filteredNotes.length > 100) {
            // Use virtual scrolling for large lists
            this.updateVisibleRange();
        } else {
            // Use normal rendering for small lists
            this.dashboard.renderNotes();
        }
    }

    // Render queue system for smooth interactions
    queueRender(renderFn) {
        this.renderQueue.push(renderFn);
        if (!this.isRendering) {
            this.processRenderQueue();
        }
    }

    processRenderQueue() {
        if (this.renderQueue.length === 0) {
            this.isRendering = false;
            return;
        }

        this.isRendering = true;

        // Use requestIdleCallback for non-critical renders
        const processNext = (deadline) => {
            while (deadline.timeRemaining() > 0 && this.renderQueue.length > 0) {
                const renderFn = this.renderQueue.shift();
                try {
                    renderFn();
                } catch (error) {
                    console.error('Render function error:', error);
                }
            }

            if (this.renderQueue.length > 0) {
                this.requestIdleCallback(processNext);
            } else {
                this.isRendering = false;
            }
        };

        this.requestIdleCallback(processNext);
    }

    setupRequestIdleCallback() {
        // Polyfill for requestIdleCallback
        this.requestIdleCallback = window.requestIdleCallback || ((cb) => {
            const start = Date.now();
            return setTimeout(() => {
                cb({
                    didTimeout: false,
                    timeRemaining() {
                        return Math.max(0, 50 - (Date.now() - start));
                    }
                });
            }, 1);
        });
    }

    // Utility functions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateUrl(url, maxLength = 50) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    }
}

// Auto-initialize optimizer when dashboard is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for dashboard to be initialized
    const initOptimizer = () => {
        if (window.dashboard) {
            window.dashboardOptimizer = new DashboardOptimizer(window.dashboard);
            console.log('🚀 Dashboard optimizer initialized');
        } else {
            setTimeout(initOptimizer, 100);
        }
    };

    setTimeout(initOptimizer, 500);
});

window.DashboardOptimizer = DashboardOptimizer;