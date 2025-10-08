// Onboarding Tooltips Module
// Provides interactive tooltips for new users to understand UI elements

class OnboardingTooltips {
    constructor() {
        this.tooltips = [];
        this.currentTooltipIndex = 0;
        this.isActive = false;
        this.storageKey = 'onboardingTooltipsShown';
        this.tooltipContainer = null;

        // Define tooltip configurations for different UI elements
        this.tooltipConfigs = [
            {
                id: 'search-tooltip',
                target: '#searchInput',
                title: 'Search Your Notes',
                content: 'Search across all your notes. Use filters below to search specific sites or pages.',
                position: 'bottom',
                delay: 500
            },
            {
                id: 'filter-tooltip',
                target: '.filter-container',
                title: 'Filter Your Notes',
                content: 'Switch between "This Page" (current URL), "This Site" (domain), or "All Notes" to organize your view.',
                position: 'bottom',
                delay: 1000
            },
            {
                id: 'add-note-tooltip',
                target: '#addNoteBtn',
                title: 'Create New Note',
                content: 'Click here to create a new note for the current page. You can also use Alt+N shortcut.',
                position: 'bottom',
                delay: 1500
            },
            {
                id: 'settings-tooltip',
                target: '#settingsBtn',
                title: 'Settings & Account',
                content: 'Access settings, manage your account, export/import notes, and upgrade to premium.',
                position: 'bottom',
                delay: 2000
            },
            {
                id: 'multi-highlight-tooltip',
                target: '#multiHighlightBtn',
                title: 'Multi-Highlight Mode',
                content: 'Toggle multi-highlight mode to select multiple text snippets from web pages at once.',
                position: 'bottom',
                delay: 2500
            }
        ];


    }

    // Initialize the onboarding tooltips system
    async init() {
        // Check if user has already seen tooltips
        const hasSeenTooltips = await this.hasSeenTooltips();
        if (hasSeenTooltips) {
            return;
        }

        // Create tooltip container
        this.createTooltipContainer();

        // Show tooltips after a brief delay to let UI settle
        setTimeout(() => {
            this.startOnboarding();
        }, 1000);
    }

    // Check if user has already seen the onboarding tooltips
    async hasSeenTooltips() {
        try {
            const result = await chrome.storage.local.get([this.storageKey]);
            return result[this.storageKey] === true;
        } catch (error) {
            console.warn('Failed to check onboarding status:', error);
            return false;
        }
    }

    // Mark tooltips as seen
    async markTooltipsAsSeen() {
        try {
            await chrome.storage.local.set({ [this.storageKey]: true });
        } catch (error) {
            console.warn('Failed to save onboarding status:', error);
        }
    }

    // Create the tooltip container element
    createTooltipContainer() {
        if (this.tooltipContainer) {
            return;
        }

        this.tooltipContainer = document.createElement('div');
        this.tooltipContainer.id = 'onboarding-tooltip-container';

        // Create tooltip elements using DOM methods to avoid XSS issues
        const tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        tooltip.id = 'onboarding-tooltip';
        tooltip.style.display = 'none';

        const content = document.createElement('div');
        content.className = 'tooltip-content';

        // Header
        const header = document.createElement('div');
        header.className = 'tooltip-header';

        const title = document.createElement('h4');
        title.className = 'tooltip-title';
        title.id = 'tooltip-title';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tooltip-close';
        closeBtn.id = 'tooltip-close';
        closeBtn.title = 'Skip onboarding';
        // Create SVG using DOM methods for XSS safety
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '12');
        svg.setAttribute('height', '12');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');

        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', '18');
        line1.setAttribute('y1', '6');
        line1.setAttribute('x2', '6');
        line1.setAttribute('y2', '18');

        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', '6');
        line2.setAttribute('y1', '6');
        line2.setAttribute('x2', '18');
        line2.setAttribute('y2', '18');

        svg.appendChild(line1);
        svg.appendChild(line2);
        closeBtn.appendChild(svg);

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Text
        const text = document.createElement('p');
        text.className = 'tooltip-text';
        text.id = 'tooltip-text';

        // Actions
        const actions = document.createElement('div');
        actions.className = 'tooltip-actions';

        const skipBtn = document.createElement('button');
        skipBtn.className = 'tooltip-btn tooltip-skip';
        skipBtn.id = 'tooltip-skip';
        skipBtn.textContent = 'Skip Tour';

        const progress = document.createElement('div');
        progress.className = 'tooltip-progress';
        const progressText = document.createElement('span');
        progressText.id = 'tooltip-progress-text';
        progressText.textContent = `1 of ${this.tooltipConfigs.length}`;
        progress.appendChild(progressText);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'tooltip-btn tooltip-next';
        nextBtn.id = 'tooltip-next';
        nextBtn.textContent = 'Next';

        actions.appendChild(skipBtn);
        actions.appendChild(progress);
        actions.appendChild(nextBtn);

        // Arrow
        const arrow = document.createElement('div');
        arrow.className = 'tooltip-arrow';
        arrow.id = 'tooltip-arrow';

        // Assemble
        content.appendChild(header);
        content.appendChild(text);
        content.appendChild(actions);
        tooltip.appendChild(content);
        tooltip.appendChild(arrow);
        this.tooltipContainer.appendChild(tooltip);

        document.body.appendChild(this.tooltipContainer);
        this.addTooltipStyles();
        this.setupTooltipEventListeners();
    }

    // Add CSS styles for tooltips
    addTooltipStyles() {
        if (document.getElementById('onboarding-tooltip-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'onboarding-tooltip-styles';
        style.textContent = `
      #onboarding-tooltip-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10000;
      }

      .onboarding-tooltip {
        position: absolute;
        background: var(--bg-primary, #ffffff);
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 8px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        max-width: 260px;
        min-width: 220px;
        pointer-events: auto;
        z-index: 10001;
        backdrop-filter: blur(10px);
        background: rgba(255, 255, 255, 0.98);
      }

      @media (prefers-color-scheme: dark) {
        .onboarding-tooltip {
          background: rgba(30, 30, 30, 0.95);
          border-color: rgba(255, 255, 255, 0.1);
        }
      }

      .tooltip-content {
        padding: 16px;
      }

      .tooltip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .tooltip-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #111827);
      }

      .tooltip-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: var(--text-secondary, #6b7280);
        transition: all 0.2s ease;
      }

      .tooltip-close:hover {
        background: var(--bg-secondary, #f3f4f6);
        color: var(--text-primary, #111827);
      }

      .tooltip-text {
        margin: 0 0 16px 0;
        font-size: 13px;
        line-height: 1.4;
        color: var(--text-secondary, #6b7280);
      }

      .tooltip-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .tooltip-btn {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }

      .tooltip-skip {
        background: none;
        color: var(--text-secondary, #6b7280);
        border-color: var(--border-color, #e5e7eb);
      }

      .tooltip-skip:hover {
        background: var(--bg-secondary, #f3f4f6);
        color: var(--text-primary, #111827);
      }

      .tooltip-next {
        background: var(--accent-primary, #3b82f6);
        color: white;
        border-color: var(--accent-primary, #3b82f6);
      }

      .tooltip-next:hover {
        background: var(--accent-secondary, #2563eb);
      }

      .tooltip-progress {
        font-size: 11px;
        color: var(--text-secondary, #6b7280);
        font-weight: 500;
      }

      .tooltip-arrow {
        position: absolute;
        width: 0;
        height: 0;
        border: 8px solid transparent;
      }

      .tooltip-arrow.top {
        bottom: -16px;
        left: 50%;
        transform: translateX(-50%);
        border-top-color: var(--bg-primary, #ffffff);
      }

      .tooltip-arrow.bottom {
        top: -16px;
        left: 50%;
        transform: translateX(-50%);
        border-bottom-color: var(--bg-primary, #ffffff);
      }

      .tooltip-arrow.left {
        right: -16px;
        top: 50%;
        transform: translateY(-50%);
        border-left-color: var(--bg-primary, #ffffff);
      }

      .tooltip-arrow.right {
        left: -16px;
        top: 50%;
        transform: translateY(-50%);
        border-right-color: var(--bg-primary, #ffffff);
      }

      @media (prefers-color-scheme: dark) {
        .tooltip-arrow.top {
          border-top-color: rgba(30, 30, 30, 0.95);
        }
        .tooltip-arrow.bottom {
          border-bottom-color: rgba(30, 30, 30, 0.95);
        }
        .tooltip-arrow.left {
          border-left-color: rgba(30, 30, 30, 0.95);
        }
        .tooltip-arrow.right {
          border-right-color: rgba(30, 30, 30, 0.95);
        }
      }

      /* Highlight target element */
      .onboarding-highlight {
        position: relative;
        z-index: 9999;
      }

      .onboarding-highlight::before {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border: 2px solid var(--accent-primary, #3b82f6);
        border-radius: 8px;
        pointer-events: none;
        animation: onboarding-pulse 2s infinite;
      }

      @keyframes onboarding-pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.02); }
        100% { opacity: 1; transform: scale(1); }
      }

      /* Premium feature styling */
      .tooltip-premium-badge {
        display: inline-block;
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 6px;
        text-transform: uppercase;
      }

      .tooltip-upgrade-prompt {
        margin-top: 8px;
        padding: 8px;
        background: var(--bg-secondary, #f3f4f6);
        border-radius: 6px;
        font-size: 12px;
        color: var(--text-secondary, #6b7280);
      }

      .tooltip-upgrade-link {
        color: var(--accent-primary, #3b82f6);
        text-decoration: none;
        font-weight: 500;
      }

      .tooltip-upgrade-link:hover {
        text-decoration: underline;
      }
    `;

        document.head.appendChild(style);
    }

    // Setup event listeners for tooltip interactions
    setupTooltipEventListeners() {
        const tooltip = document.getElementById('onboarding-tooltip');
        const closeBtn = document.getElementById('tooltip-close');
        const skipBtn = document.getElementById('tooltip-skip');
        const nextBtn = document.getElementById('tooltip-next');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.skipOnboarding());
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipOnboarding());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextTooltip());
        }

        // Close tooltip when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isActive && tooltip && !tooltip.contains(e.target)) {
                // Don't close if clicking on the highlighted element
                const highlightedElement = document.querySelector('.onboarding-highlight');
                if (!highlightedElement || !highlightedElement.contains(e.target)) {
                    this.nextTooltip();
                }
            }
        });

        // Listen for panel navigation changes to hide tooltips
        this.setupPanelNavigationListeners();
    }

    // Setup listeners for panel navigation to hide tooltips when switching views
    setupPanelNavigationListeners() {
        // Listen for settings panel opening
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (this.isActive) {
                    this.hideTooltipTemporarily();
                }
            });
        }

        // Listen for editor opening (note clicks)
        document.addEventListener('click', (e) => {
            // Check if clicking on a note item or add note button
            if (this.isActive && (
                e.target.closest('.note-item') ||
                e.target.closest('#addNoteBtn') ||
                e.target.closest('.add-note-btn')
            )) {
                this.hideTooltipTemporarily();
            }
        });

        // Listen for back button clicks to potentially restore tooltips
        const settingsBackBtn = document.getElementById('settingsBackBtn');
        const editorBackBtn = document.getElementById('backBtn');

        if (settingsBackBtn) {
            settingsBackBtn.addEventListener('click', () => {
                if (this.isActive) {
                    // Small delay to let panel transition complete
                    setTimeout(() => this.showTooltipIfActive(), 100);
                }
            });
        }

        if (editorBackBtn) {
            editorBackBtn.addEventListener('click', () => {
                if (this.isActive) {
                    // Small delay to let panel transition complete
                    setTimeout(() => this.showTooltipIfActive(), 100);
                }
            });
        }
    }

    // Hide tooltip temporarily (but keep onboarding active)
    hideTooltipTemporarily() {
        const tooltip = document.getElementById('onboarding-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }

        // Remove highlights
        const highlighted = document.querySelector('.onboarding-highlight');
        if (highlighted) {
            highlighted.classList.remove('onboarding-highlight');
        }
    }

    // Show tooltip again if onboarding is still active
    showTooltipIfActive() {
        if (this.isActive) {
            // Check if we're back on the main notes view
            const notesList = document.querySelector('.notes-container');
            const settingsPanel = document.getElementById('settingsPanel');
            const noteEditor = document.getElementById('noteEditor');

            const isMainView = notesList &&
                notesList.style.display !== 'none' &&
                (!settingsPanel || settingsPanel.style.display === 'none') &&
                (!noteEditor || noteEditor.style.display === 'none');

            if (isMainView) {
                this.showCurrentTooltip();
            }
        }
    }

    // Start the onboarding process
    startOnboarding() {
        this.isActive = true;
        this.currentTooltipIndex = 0;
        this.showCurrentTooltip();
    }

    // Show the current tooltip based on context
    showCurrentTooltip() {
        // Only show main tooltips now
        const tooltips = this.tooltipConfigs;

        if (this.currentTooltipIndex >= tooltips.length) {
            this.completeOnboarding();
            return;
        }

        const config = tooltips[this.currentTooltipIndex];
        this.showTooltip(config, this.currentTooltipIndex + 1, tooltips.length);
    }

    // Get current UI context (simplified - only main now)
    getCurrentContext() {
        return 'main';
    }

    // Show a specific tooltip
    showTooltip(config, current, total) {
        const tooltip = document.getElementById('onboarding-tooltip');
        const target = document.querySelector(config.target);

        console.log('Showing tooltip:', config.id, 'Target found:', !!target, 'Tooltip found:', !!tooltip);

        if (!tooltip || !target) {
            console.warn('Tooltip or target not found, skipping:', config.id);
            this.nextTooltip();
            return;
        }

        // Update tooltip content
        const title = document.getElementById('tooltip-title');
        const text = document.getElementById('tooltip-text');
        const progress = document.getElementById('tooltip-progress-text');
        const nextBtn = document.getElementById('tooltip-next');

        if (title) {
            const titleHtml = config.title + (config.premiumFeature ? '<span class="tooltip-premium-badge">Premium</span>' : '');
            if (window.safeDOM) {
                window.safeDOM.setInnerHTML(title, titleHtml, false);
            } else {
                title.innerHTML = titleHtml;
            }
        }

        if (text) {
            let content = config.content;

            if (config.premiumFeature || config.upgradePrompt) {
                content += '<div class="tooltip-upgrade-prompt">💎 <a href="#" class="tooltip-upgrade-link" id="tooltip-upgrade-link">Upgrade to Premium</a> for advanced features and cloud sync!</div>';
            }

            if (window.safeDOM) {
                window.safeDOM.setInnerHTML(text, content, false);
            } else {
                text.innerHTML = content;
            }
        }

        if (progress) {
            progress.textContent = `${current} of ${total}`;
        }

        if (nextBtn) {
            nextBtn.textContent = current === total ? 'Finish' : 'Next';
        }

        // Setup upgrade link if present
        const upgradeLink = document.getElementById('tooltip-upgrade-link');
        if (upgradeLink) {
            upgradeLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openUpgrade();
            });
        }

        // Position tooltip
        this.positionTooltip(tooltip, target, config.position);

        // Highlight target element
        this.highlightElement(target);

        // Show tooltip
        tooltip.style.display = 'block';
    }

    // Position tooltip relative to target element
    positionTooltip(tooltip, target, position) {
        const targetRect = target.getBoundingClientRect();
        const arrow = document.getElementById('tooltip-arrow');

        // Reset arrow classes
        arrow.className = 'tooltip-arrow';

        // Get tooltip dimensions after it's shown but before positioning
        tooltip.style.visibility = 'hidden';
        tooltip.style.display = 'block';
        const tooltipRect = tooltip.getBoundingClientRect();
        tooltip.style.visibility = 'visible';

        let top, left;
        const padding = 12;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // For extension popup (400px width), use smarter positioning
        const isExtensionPopup = viewportWidth <= 450;

        if (isExtensionPopup) {
            // In extension popup, prioritize positions that keep tooltip visible
            switch (position) {
                case 'left':
                    // Try left first, but fallback to right if not enough space
                    if (targetRect.left - tooltipRect.width - 16 >= padding) {
                        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                        left = targetRect.left - tooltipRect.width - 16;
                        arrow.classList.add('right');
                    } else {
                        // Fallback to bottom
                        top = targetRect.bottom + 12;
                        left = Math.max(padding, Math.min(
                            targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2),
                            viewportWidth - tooltipRect.width - padding
                        ));
                        arrow.classList.add('top');
                    }
                    break;
                case 'right':
                    // Try right first, but fallback to left if not enough space
                    if (targetRect.right + tooltipRect.width + 16 <= viewportWidth - padding) {
                        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                        left = targetRect.right + 16;
                        arrow.classList.add('left');
                    } else {
                        // Fallback to bottom
                        top = targetRect.bottom + 12;
                        left = Math.max(padding, Math.min(
                            targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2),
                            viewportWidth - tooltipRect.width - padding
                        ));
                        arrow.classList.add('top');
                    }
                    break;
                case 'top':
                    // Try top first, but fallback to bottom if not enough space
                    if (targetRect.top - tooltipRect.height - 16 >= padding) {
                        top = targetRect.top - tooltipRect.height - 16;
                        left = Math.max(padding, Math.min(
                            targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2),
                            viewportWidth - tooltipRect.width - padding
                        ));
                        arrow.classList.add('bottom');
                    } else {
                        // Fallback to bottom
                        top = targetRect.bottom + 12;
                        left = Math.max(padding, Math.min(
                            targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2),
                            viewportWidth - tooltipRect.width - padding
                        ));
                        arrow.classList.add('top');
                    }
                    break;
                default: // 'bottom'
                    top = targetRect.bottom + 12;
                    left = Math.max(padding, Math.min(
                        targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2),
                        viewportWidth - tooltipRect.width - padding
                    ));
                    arrow.classList.add('top');
            }
        } else {
            // Standard positioning for larger screens
            switch (position) {
                case 'top':
                    top = targetRect.top - tooltipRect.height - 16;
                    left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                    arrow.classList.add('bottom');
                    break;
                case 'bottom':
                    top = targetRect.bottom + 16;
                    left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                    arrow.classList.add('top');
                    break;
                case 'left':
                    top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                    left = targetRect.left - tooltipRect.width - 16;
                    arrow.classList.add('right');
                    break;
                case 'right':
                    top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                    left = targetRect.right + 16;
                    arrow.classList.add('left');
                    break;
                default:
                    top = targetRect.bottom + 16;
                    left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                    arrow.classList.add('top');
            }

            // Ensure tooltip stays within viewport
            if (left < padding) {
                left = padding;
            } else if (left + tooltipRect.width > viewportWidth - padding) {
                left = viewportWidth - tooltipRect.width - padding;
            }

            if (top < padding) {
                top = padding;
            } else if (top + tooltipRect.height > viewportHeight - padding) {
                top = viewportHeight - tooltipRect.height - padding;
            }
        }

        // Final bounds check
        top = Math.max(padding, Math.min(top, viewportHeight - tooltipRect.height - padding));
        left = Math.max(padding, Math.min(left, viewportWidth - tooltipRect.width - padding));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    // Highlight target element
    highlightElement(target) {
        // Remove previous highlights
        const previousHighlight = document.querySelector('.onboarding-highlight');
        if (previousHighlight) {
            previousHighlight.classList.remove('onboarding-highlight');
        }

        // Add highlight to current target
        target.classList.add('onboarding-highlight');
    }

    // Move to next tooltip
    nextTooltip() {
        this.currentTooltipIndex++;
        this.showCurrentTooltip();
    }

    // Skip the entire onboarding process
    skipOnboarding() {
        this.completeOnboarding();
    }

    // Complete the onboarding process
    completeOnboarding() {
        this.isActive = false;

        // Hide tooltip
        const tooltip = document.getElementById('onboarding-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }

        // Remove highlights
        const highlighted = document.querySelector('.onboarding-highlight');
        if (highlighted) {
            highlighted.classList.remove('onboarding-highlight');
        }

        // Mark as seen
        this.markTooltipsAsSeen();
    }

    // Open upgrade page
    openUpgrade() {
        try {
            const websiteUrl = 'https://anchored.site';
            if (chrome?.tabs?.create) {
                chrome.tabs.create({ url: websiteUrl });
            } else {
                window.open(websiteUrl, '_blank');
            }
        } catch (error) {
            console.warn('Failed to open upgrade page:', error);
        }
    }

    // Manually trigger onboarding (for testing or re-showing)
    async resetAndShow() {
        await chrome.storage.local.remove(this.storageKey);
        this.startOnboarding();
    }

    // Force show main tooltips for testing (ignores hasSeenTooltips check)
    forceShowTooltips() {
        // Create tooltip container if it doesn't exist
        if (!this.tooltipContainer) {
            this.createTooltipContainer();
        }

        // Show main tooltips
        console.log('Force showing main tooltips');
        this.currentTooltipIndex = 0;
        this.isActive = true;
        this.showCurrentTooltip();
    }
}

// Export for use in main popup
window.OnboardingTooltips = OnboardingTooltips;