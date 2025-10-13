// User Engagement Module
// Handles gentle prompts to encourage account creation and premium upgrades

class UserEngagement {
    constructor() {
        this.storageKeys = {
            lastPrompt: 'userEngagement_lastPrompt',
            promptCount: 'userEngagement_promptCount',
            dismissed: 'userEngagement_dismissed',
            noteCount: 'userEngagement_noteCount',
            reviewPromptShown: 'userEngagement_reviewPromptShown'
        };

        // Deferred prompt storage
        this.deferredPrompt = null;

        // Engagement thresholds
        this.thresholds = {
            firstPrompt: 3,      // Show after 3 notes created
            secondPrompt: 10,    // Show after 10 notes created
            thirdPrompt: 25,     // Show after 25 notes created
            finalPrompt: 50      // Show after 50 notes created
        };

        // Time delays between prompts (in milliseconds)
        this.delays = {
            betweenPrompts: 24 * 60 * 60 * 1000, // 24 hours
            afterDismiss: 7 * 24 * 60 * 60 * 1000 // 7 days after dismiss
        };

        // Engagement method preference
        this.engagementMethod = 'popup'; // 'popup' or 'notification'

        // Setup listeners for deferred prompts
        this.setupDeferredPromptListeners();
    }

    // Initialize engagement system
    async init() {
        try {
            // Check if user is already logged in
            const isLoggedIn = await this.checkIfUserLoggedIn();
            if (isLoggedIn) {
                return; // Don't show prompts to logged-in users
            }

            // Check if we should show a prompt
            await this.checkAndShowPrompt();
        } catch (error) {
            console.warn('Failed to initialize user engagement:', error);
        }
    }

    // Check if user is logged in
    async checkIfUserLoggedIn() {
        try {
            // Check for Supabase session
            const { supabase_session } = await browserAPI.storage.local.get(['supabase_session']);
            if (supabase_session && supabase_session.user) {
                return true;
            }

            // Check premium status as backup
            if (window.getPremiumStatus) {
                const premiumStatus = await window.getPremiumStatus();
                return premiumStatus.isLoggedIn;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    // Count user's notes
    async countUserNotes() {
        try {
            // Use the app's existing allNotes array if available (most efficient)
            if (window.urlNotesApp && Array.isArray(window.urlNotesApp.allNotes)) {
                return window.urlNotesApp.allNotes.length;
            }

            // Fallback: Use IndexedDB storage directly
            if (window.notesStorage && typeof window.notesStorage.getAllNotesForDisplay === 'function') {
                const notes = await window.notesStorage.getAllNotesForDisplay();
                return notes.length;
            }

            // Last resort: Check chrome.storage.local (legacy or context menu notes)
            const allData = await browserAPI.storage.local.get(null);
            let noteCount = 0;

            for (const [key, value] of Object.entries(allData)) {
                if (key.startsWith('note_') && value && !value.is_deleted) {
                    noteCount++;
                }
            }

            return noteCount;
        } catch (error) {
            console.error('Error counting notes:', error);
            return 0;
        }
    }

    // Check if we should show a prompt and show it
    async checkAndShowPrompt() {
        try {
            const noteCount = await this.countUserNotes();
            const engagementData = await browserAPI.storage.local.get([
                this.storageKeys.lastPrompt,
                this.storageKeys.promptCount,
                this.storageKeys.dismissed,
                this.storageKeys.noteCount
            ]);

            const lastPrompt = engagementData[this.storageKeys.lastPrompt] || 0;
            const promptCount = engagementData[this.storageKeys.promptCount] || 0;
            const dismissed = engagementData[this.storageKeys.dismissed] || 0;
            const lastNoteCount = engagementData[this.storageKeys.noteCount] || 0;
            const reviewPromptShown = engagementData[this.storageKeys.reviewPromptShown] || false;

            const now = Date.now();

            // Check if user recently dismissed prompts
            if (dismissed && (now - dismissed) < this.delays.afterDismiss) {
                return;
            }

            // Check if enough time has passed since last prompt
            if (lastPrompt && (now - lastPrompt) < this.delays.betweenPrompts) {
                return;
            }

            // Check if we should show review prompt (at 25 notes, only once)
            if (!reviewPromptShown && noteCount >= this.thresholds.thirdPrompt && lastNoteCount < this.thresholds.thirdPrompt) {
                // Show review prompt instead of regular engagement prompt
                await browserAPI.storage.local.set({
                    [this.storageKeys.reviewPromptShown]: true,
                    [this.storageKeys.noteCount]: noteCount
                });

                setTimeout(() => {
                    this.showReviewPrompt(noteCount);
                }, 2000);
                return;
            }

            // Determine which threshold we've crossed
            let shouldPrompt = false;
            let promptType = 'basic';

            if (noteCount >= this.thresholds.finalPrompt && lastNoteCount < this.thresholds.finalPrompt) {
                shouldPrompt = true;
                promptType = 'final';
            } else if (noteCount >= this.thresholds.thirdPrompt && lastNoteCount < this.thresholds.thirdPrompt) {
                shouldPrompt = true;
                promptType = 'advanced';
            } else if (noteCount >= this.thresholds.secondPrompt && lastNoteCount < this.thresholds.secondPrompt) {
                shouldPrompt = true;
                promptType = 'intermediate';
            } else if (noteCount >= this.thresholds.firstPrompt && lastNoteCount < this.thresholds.firstPrompt) {
                shouldPrompt = true;
                promptType = 'basic';
            }

            if (shouldPrompt) {
                // Update storage before showing prompt
                await browserAPI.storage.local.set({
                    [this.storageKeys.lastPrompt]: now,
                    [this.storageKeys.promptCount]: promptCount + 1,
                    [this.storageKeys.noteCount]: noteCount
                });

                // If this is the first engagement tier, notify ad system
                if (promptType === 'basic' && noteCount >= this.thresholds.firstPrompt) {
                    this.notifyAdSystemEngagementReached();
                }

                // Show prompt after a brief delay to let UI settle
                setTimeout(() => {
                    if (this.engagementMethod === 'notification') {
                        this.showNotificationEngagement(promptType, noteCount);
                    } else {
                        this.showEngagementPrompt(promptType, noteCount);
                    }
                }, 2000);
            } else {
                // Update note count even if not prompting
                await browserAPI.storage.local.set({
                    [this.storageKeys.noteCount]: noteCount
                });
            }
        } catch (error) {
            console.warn('Failed to check engagement prompt:', error);
        }
    }

    // Show engagement prompt
    showEngagementPrompt(type, noteCount, forceShow = false) {
        // Only show on main page (not in settings or editor) unless forced for testing
        if (!forceShow) {
            const settingsPanel = document.getElementById('settingsPanel');
            const noteEditor = document.getElementById('noteEditor');
            const notesList = document.querySelector('.notes-container');

            // Check if we're on the main notes view
            const isMainView = notesList &&
                notesList.style.display !== 'none' &&
                (!settingsPanel || settingsPanel.style.display === 'none') &&
                (!noteEditor || noteEditor.style.display === 'none');

            if (!isMainView) {
                // Defer the prompt until user returns to main view
                this.deferredPrompt = { type, noteCount };
                return;
            }
        }

        const prompts = {
            basic: {
                title: '🎉 Great start!',
                message: `You've created ${noteCount} notes! Create a free account to unlock AI-powered note rewriting.`,
                benefits: ['🤖 AI-powered note rewriting', '✨ Multiple writing styles', '🔒 Secure local storage']
            },
            intermediate: {
                title: '📚 You\'re building a great collection!',
                message: `${noteCount} notes and counting! Create a free account to access AI features that enhance your notes.`,
                benefits: ['🤖 AI note enhancement (free)', '☁️ Cloud sync (Premium)', '📜 Version history (Premium)']
            },
            advanced: {
                title: '🚀 Power user detected!',
                message: `Wow, ${noteCount} notes! Create an account for AI features, or upgrade to Premium for cloud sync and unlimited AI.`,
                benefits: ['🤖 AI rewriting (free account)', '☁️ Cloud sync (Premium)', '♾️ Unlimited AI uses (Premium)']
            },
            final: {
                title: '🏆 Note-taking champion!',
                message: `${noteCount} notes! Create an account for AI features, or go Premium for cloud sync, unlimited AI, and version history.`,
                benefits: ['🤖 AI features (free account)', '☁️ Cloud sync (Premium)', '⏮️ Full version history (Premium)']
            }
        };

        const prompt = prompts[type];
        this.createPromptUI(prompt, type);
    }

    // Create prompt UI
    createPromptUI(prompt, type) {
        // Remove any existing prompt
        const existingPrompt = document.getElementById('user-engagement-prompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        // Create prompt container
        const promptContainer = document.createElement('div');
        promptContainer.id = 'user-engagement-prompt';
        promptContainer.className = 'engagement-prompt';

        // Create prompt content
        const promptContent = document.createElement('div');
        promptContent.className = 'engagement-content';

        // Header
        const header = document.createElement('div');
        header.className = 'engagement-header';

        const title = document.createElement('h3');
        // Use textContent for XSS safety (no HTML parsing)
        title.textContent = prompt.title;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'engagement-close';
        closeBtn.textContent = '×'; // Use textContent instead of innerHTML
        closeBtn.title = 'Dismiss';

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Message
        const message = document.createElement('p');
        message.className = 'engagement-message';
        // Use textContent for XSS safety (no HTML parsing)
        message.textContent = prompt.message;

        // Benefits
        const benefitsList = document.createElement('ul');
        benefitsList.className = 'engagement-benefits';
        prompt.benefits.forEach(benefit => {
            const li = document.createElement('li');
            // Use textContent for XSS safety (no HTML parsing)
            li.textContent = benefit;
            benefitsList.appendChild(li);
        });

        // Actions
        const actions = document.createElement('div');
        actions.className = 'engagement-actions';

        const createAccountBtn = document.createElement('button');
        createAccountBtn.className = 'engagement-btn primary';
        createAccountBtn.textContent = 'Create Free Account';

        const laterBtn = document.createElement('button');
        laterBtn.className = 'engagement-btn secondary';
        laterBtn.textContent = 'Maybe Later';

        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'engagement-btn tertiary';
        dismissBtn.textContent = 'Don\'t Show Again';

        actions.appendChild(createAccountBtn);
        actions.appendChild(laterBtn);
        actions.appendChild(dismissBtn);

        // Assemble
        promptContent.appendChild(header);
        promptContent.appendChild(message);
        promptContent.appendChild(benefitsList);
        promptContent.appendChild(actions);
        promptContainer.appendChild(promptContent);

        // Add styles
        this.addPromptStyles();

        // Add to DOM
        document.body.appendChild(promptContainer);

        // Add event listeners
        this.setupPromptEventListeners(promptContainer, createAccountBtn, laterBtn, dismissBtn, closeBtn);

        // Show with animation
        setTimeout(() => {
            promptContainer.classList.add('show');
        }, 100);
    }

    // Add CSS styles for prompt
    addPromptStyles() {
        if (document.getElementById('user-engagement-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'user-engagement-styles';
        style.textContent = `
            .engagement-prompt {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: auto;
            }

            .engagement-prompt.show {
                opacity: 1;
            }

            .engagement-content {
                background: var(--bg-primary, #ffffff);
                border: 1px solid var(--border-color, #e5e7eb);
                border-radius: 16px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                max-width: 320px;
                width: 90%;
                padding: 24px;
                transform: translateY(20px);
                transition: transform 0.3s ease;
            }

            .engagement-prompt.show .engagement-content {
                transform: translateY(0);
            }

            .engagement-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
            }

            .engagement-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: var(--text-primary, #111827);
            }

            .engagement-close {
                background: none;
                border: none;
                font-size: 24px;
                color: var(--text-secondary, #6b7280);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }

            .engagement-close:hover {
                background: var(--bg-secondary, #f3f4f6);
                color: var(--text-primary, #111827);
            }

            .engagement-message {
                margin: 0 0 16px 0;
                font-size: 14px;
                line-height: 1.5;
                color: var(--text-secondary, #6b7280);
            }

            .engagement-benefits {
                margin: 0 0 20px 0;
                padding: 0;
                list-style: none;
            }

            .engagement-benefits li {
                font-size: 13px;
                line-height: 1.4;
                color: var(--text-secondary, #6b7280);
                margin-bottom: 8px;
                padding-left: 4px;
            }

            .engagement-actions {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .engagement-btn {
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid transparent;
            }

            .engagement-btn.primary {
                background: var(--accent-primary, #3b82f6);
                color: white;
                border-color: var(--accent-primary, #3b82f6);
            }

            .engagement-btn.primary:hover {
                background: var(--accent-secondary, #2563eb);
                transform: translateY(-1px);
            }

            .engagement-btn.secondary {
                background: var(--bg-secondary, #f3f4f6);
                color: var(--text-primary, #111827);
                border-color: var(--border-color, #e5e7eb);
            }

            .engagement-btn.secondary:hover {
                background: var(--bg-tertiary, #e5e7eb);
            }

            .engagement-btn.tertiary {
                background: none;
                color: var(--text-secondary, #6b7280);
                font-size: 12px;
                padding: 8px 12px;
            }

            .engagement-btn.tertiary:hover {
                color: var(--text-primary, #111827);
                background: var(--bg-secondary, #f3f4f6);
            }

            @media (prefers-color-scheme: dark) {
                .engagement-content {
                    background: rgba(30, 30, 30, 0.95);
                    border-color: rgba(255, 255, 255, 0.1);
                }
            }
        `;

        document.head.appendChild(style);
    }

    // Setup event listeners for prompt
    setupPromptEventListeners(container, createAccountBtn, laterBtn, dismissBtn, closeBtn) {
        // Create account button
        createAccountBtn.addEventListener('click', () => {
            this.handleCreateAccount();
            this.hidePrompt(container);
        });

        // Later button
        laterBtn.addEventListener('click', () => {
            this.hidePrompt(container);
        });

        // Dismiss button
        dismissBtn.addEventListener('click', async () => {
            await browserAPI.storage.local.set({
                [this.storageKeys.dismissed]: Date.now()
            });
            this.hidePrompt(container);
        });

        // Close button
        closeBtn.addEventListener('click', () => {
            this.hidePrompt(container);
        });

        // Click outside to close
        container.addEventListener('click', (e) => {
            if (e.target === container) {
                this.hidePrompt(container);
            }
        });
    }

    // Handle create account action
    handleCreateAccount() {
        // Simulate clicking the settings button for consistent transition
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.click();

            // Scroll to auth section after transition completes
            setTimeout(() => {
                const authSection = document.querySelector('.auth-section');
                if (authSection) {
                    authSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    // Focus on email input
                    const emailInput = document.getElementById('authEmailInput');
                    if (emailInput) {
                        emailInput.focus();
                    }
                }
            }, 300);
        }
    }

    // Hide prompt with animation
    hidePrompt(container) {
        container.classList.remove('show');
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 300);
    }

    // Manual trigger for testing (bypasses login check for development)
    async showTestPrompt(forceShow = false) {
        try {
            // Check if user is logged in (unless forcing for debug)
            if (!forceShow) {
                const isLoggedIn = await this.checkIfUserLoggedIn();
                if (isLoggedIn) {
                    return;
                }
            }

            const noteCount = await this.countUserNotes();

            // Determine which prompt type to show based on actual note count
            let promptType = 'basic';
            let displayCount = Math.max(noteCount, 3);

            if (noteCount >= this.thresholds.finalPrompt) {
                promptType = 'final';
            } else if (noteCount >= this.thresholds.thirdPrompt) {
                promptType = 'advanced';
            } else if (noteCount >= this.thresholds.secondPrompt) {
                promptType = 'intermediate';
            }

            // Force show even if settings is open (for testing)
            this.showEngagementPrompt(promptType, displayCount, true);
        } catch (error) {
            console.error('Error in showTestPrompt:', error);
        }
    }

    // Show notification-based engagement (alternative to popup)
    async showNotificationEngagement(type, noteCount) {
        try {
            const prompts = {
                basic: {
                    title: '🎉 Great start with Anchored!',
                    message: `You've created ${noteCount} notes! Create a free account to unlock AI-powered note rewriting.`
                },
                intermediate: {
                    title: '📚 Building a great collection!',
                    message: `${noteCount} notes and counting! Create an account for AI features, or upgrade to Premium for cloud sync.`
                },
                advanced: {
                    title: '🚀 Power user detected!',
                    message: `Wow, ${noteCount} notes! Get AI features with a free account, or Premium for cloud sync and unlimited AI.`
                },
                final: {
                    title: '🏆 Note-taking champion!',
                    message: `${noteCount} notes! Create an account for AI, or go Premium for cloud sync, unlimited AI, and version history.`
                }
            };

            const prompt = prompts[type];

            // Create notification
            browserAPI.notifications.create('userEngagement', {
                type: 'basic',
                iconUrl: '../assets/icons/icon128x128.png',
                title: prompt.title,
                message: prompt.message,
                buttons: [
                    { title: 'Create Account' },
                    { title: 'Maybe Later' }
                ]
            });

            // Handle notification clicks
            browserAPI.notifications.onClicked.addListener((notificationId, buttonIndex) => {
                if (notificationId === 'userEngagement') {
                    if (buttonIndex === 0) {
                        // Create Account button clicked
                        this.handleCreateAccount();
                    }
                    browserAPI.notifications.clear(notificationId);
                }
            });

            // Handle notification click (main body)
            browserAPI.notifications.onClicked.addListener((notificationId) => {
                if (notificationId === 'userEngagement') {
                    this.handleCreateAccount();
                    browserAPI.notifications.clear(notificationId);
                }
            });

        } catch (error) {
            console.warn('Failed to show notification engagement:', error);
            // Fallback to popup engagement
            this.showEngagementPrompt(type, noteCount);
        }
    }

    // Setup listeners for deferred prompts
    setupDeferredPromptListeners() {
        // Listen for back button clicks to show deferred prompts
        document.addEventListener('click', (e) => {
            if (this.deferredPrompt && (
                e.target.id === 'settingsBackBtn' ||
                e.target.id === 'backBtn'
            )) {
                // Small delay to let panel transition complete
                setTimeout(() => {
                    this.checkAndShowDeferredPrompt();
                }, 500);
            }
        });
    }

    // Check and show deferred prompt if conditions are right
    checkAndShowDeferredPrompt() {
        if (!this.deferredPrompt) return;

        // Check if we're back on the main notes view
        const notesList = document.querySelector('.notes-container');
        const settingsPanel = document.getElementById('settingsPanel');
        const noteEditor = document.getElementById('noteEditor');

        const isMainView = notesList &&
            notesList.style.display !== 'none' &&
            (!settingsPanel || settingsPanel.style.display === 'none') &&
            (!noteEditor || noteEditor.style.display === 'none');

        if (isMainView) {
            const { type, noteCount } = this.deferredPrompt;
            this.deferredPrompt = null; // Clear deferred prompt

            // Show the prompt
            if (this.engagementMethod === 'notification') {
                this.showNotificationEngagement(type, noteCount);
            } else {
                this.showEngagementPrompt(type, noteCount);
            }
        }
    }

    // Show review prompt (special prompt for Chrome Web Store review)
    showReviewPrompt(noteCount) {
        // Only show on main page
        const settingsPanel = document.getElementById('settingsPanel');
        const noteEditor = document.getElementById('noteEditor');
        const notesList = document.querySelector('.notes-container');

        const isMainView = notesList && 
            notesList.style.display !== 'none' &&
            (!settingsPanel || settingsPanel.style.display === 'none') &&
            (!noteEditor || noteEditor.style.display === 'none');

        if (!isMainView) {
            return; // Don't defer review prompts, just skip
        }

        const prompt = {
            title: '⭐ Enjoying Anchored?',
            message: `You've created ${noteCount} notes! If you're finding Anchored helpful, would you mind leaving a quick review?`,
            benefits: [
                '⭐ Takes less than 30 seconds',
                '💙 Helps other users discover Anchored',
                '🚀 Motivates us to keep improving'
            ]
        };

        // Remove any existing prompt
        const existingPrompt = document.getElementById('user-engagement-prompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        // Create prompt container
        const promptContainer = document.createElement('div');
        promptContainer.id = 'user-engagement-prompt';
        promptContainer.className = 'engagement-prompt';

        // Create prompt content
        const promptContent = document.createElement('div');
        promptContent.className = 'engagement-content';

        // Header
        const header = document.createElement('div');
        header.className = 'engagement-header';

        const title = document.createElement('h3');
        title.textContent = prompt.title;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'engagement-close';
        closeBtn.textContent = '×';
        closeBtn.title = 'Close';

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Message
        const message = document.createElement('p');
        message.className = 'engagement-message';
        message.textContent = prompt.message;

        // Benefits
        const benefitsList = document.createElement('ul');
        benefitsList.className = 'engagement-benefits';
        prompt.benefits.forEach(benefit => {
            const li = document.createElement('li');
            li.textContent = benefit;
            benefitsList.appendChild(li);
        });

        // Actions
        const actions = document.createElement('div');
        actions.className = 'engagement-actions';

        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'engagement-btn primary';
        reviewBtn.textContent = '⭐ Leave a Review';

        const laterBtn = document.createElement('button');
        laterBtn.className = 'engagement-btn secondary';
        laterBtn.textContent = 'Maybe Later';

        actions.appendChild(reviewBtn);
        actions.appendChild(laterBtn);

        // Assemble
        promptContent.appendChild(header);
        promptContent.appendChild(message);
        promptContent.appendChild(benefitsList);
        promptContent.appendChild(actions);
        promptContainer.appendChild(promptContent);

        // Add styles (reuse existing styles)
        this.addPromptStyles();

        // Add to DOM
        document.body.appendChild(promptContainer);

        // Add event listeners
        reviewBtn.addEventListener('click', () => {
            this.openReviewPage();
            this.hidePrompt(promptContainer);
        });

        laterBtn.addEventListener('click', () => {
            this.hidePrompt(promptContainer);
        });

        closeBtn.addEventListener('click', () => {
            this.hidePrompt(promptContainer);
        });

        // Click outside to close
        promptContainer.addEventListener('click', (e) => {
            if (e.target === promptContainer) {
                this.hidePrompt(promptContainer);
            }
        });

        // Show with animation
        setTimeout(() => {
            promptContainer.classList.add('show');
        }, 100);
    }

    // Open Chrome Web Store review page
    async openReviewPage() {
        try {
            // Open the extension page in Chrome Web Store
            // Users can leave reviews from the main extension page
            const extensionUrl = 'https://chromewebstore.google.com/detail/anchored-%E2%80%93-notes-highligh/llkmfidpbpfgdgjlohgpomdjckcfkllg';
            
            try {
                await browserAPI.tabs.create({ url: extensionUrl });
            } catch (error) {
                window.open(extensionUrl, '_blank');
            }
        } catch (error) {
            console.error('Failed to open review page:', error);
        }
    }

    // Notify ad system that user has reached engagement tier
    notifyAdSystemEngagementReached() {
        try {
            // Refresh ad system to start showing ads
            if (window.adManager && typeof window.adManager.refreshAd === 'function') {
                window.adManager.refreshAd();
            }
        } catch (error) {
            // Silently fail if ad system isn't available
        }
    }

    // Reset engagement data (for testing)
    async resetEngagementData() {
        await browserAPI.storage.local.remove([
            this.storageKeys.lastPrompt,
            this.storageKeys.promptCount,
            this.storageKeys.dismissed,
            this.storageKeys.noteCount,
            this.storageKeys.reviewPromptShown
        ]);
        this.deferredPrompt = null;
    }
}

// Export for use in main popup
window.UserEngagement = UserEngagement;

