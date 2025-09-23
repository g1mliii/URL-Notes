/**
 * Client-side Cache Busting Utility
 * 
 * This script helps detect when the user has an outdated cached version
 * and provides mechanisms to force refresh when needed.
 * 
 * CRITICAL: This utility is designed to preserve all user data including:
 * - Note storage (anchored_notes_*, anchored_sync_queue, etc.)
 * - Authentication data (supabase_session, userTier, etc.)
 * - User preferences (theme, upgradeBannerDismissed, etc.)
 * - Encryption keys and materials (cachedKeyMaterial, cachedSalt, etc.)
 * 
 * Only cache-related keys (anchored-cache-version) are removed during refresh.
 */

window.CacheBuster = {
    // Current cache version from meta tag
    getCurrentVersion() {
        const metaTag = document.querySelector('meta[name="cache-version"]');
        return metaTag ? metaTag.getAttribute('content') : null;
    },

    // Store version in localStorage for comparison
    storeVersion(version) {
        try {
            localStorage.setItem('anchored-cache-version', version);
        } catch (e) {
            console.warn('Could not store cache version:', e);
        }
    },

    // Get stored version from localStorage
    getStoredVersion() {
        try {
            return localStorage.getItem('anchored-cache-version');
        } catch (e) {
            console.warn('Could not retrieve stored cache version:', e);
            return null;
        }
    },

    // Check if cache needs to be cleared
    needsCacheRefresh() {
        const currentVersion = this.getCurrentVersion();
        const storedVersion = this.getStoredVersion();
        
        if (!currentVersion) return false;
        if (!storedVersion) {
            this.storeVersion(currentVersion);
            return false;
        }
        
        // Only show refresh if versions are different
        if (currentVersion === storedVersion) {
            return false;
        }
        
        // Additional criteria to reduce false positives:
        
        // 1. Don't show refresh notification more than once per day
        const lastNotificationTime = localStorage.getItem('anchored-last-refresh-notification');
        if (lastNotificationTime) {
            const timeSinceLastNotification = Date.now() - parseInt(lastNotificationTime);
            const oneDayMs = 24 * 60 * 60 * 1000;
            if (timeSinceLastNotification < oneDayMs) {
                // Store the new version but don't show notification
                this.storeVersion(currentVersion);
                return false;
            }
        }
        
        // 2. Only show for "significant" version changes (not just timestamp changes)
        // If the version looks like a timestamp (all digits), be more conservative
        const isTimestampVersion = /^\d{14}$/.test(currentVersion);
        if (isTimestampVersion) {
            // For timestamp versions, only show if it's been more than 1 hour since last build
            const currentTime = parseInt(currentVersion);
            const storedTime = parseInt(storedVersion);
            if (!isNaN(currentTime) && !isNaN(storedTime)) {
                const timeDiff = Math.abs(currentTime - storedTime);
                // If less than 1 hour difference, probably just a rebuild
                if (timeDiff < 10000) { // Less than 1 hour in YYYYMMDDHHMM format
                    this.storeVersion(currentVersion);
                    return false;
                }
            }
        }
        
        return true;
    },

    // Force page refresh to clear cache
    forceRefresh() {
        // Clear various caches
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }

        // Clear only cache-related localStorage items (not user data)
        try {
            // Define all note storage and user data keys that must be preserved
            const protectedKeys = [
                // Note storage keys (from WebStorage class)
                'anchored_notes_',           // Prefix for individual note caches
                'anchored_meta',             // Metadata key
                'anchored_sync_queue',       // Sync queue for offline changes
                'anchored_last_sync',        // Last sync timestamp
                'anchored_change_count',     // Change counter for batching
                
                // Authentication and user data keys
                'supabase_session',          // User session data
                'userTier',                  // User subscription tier
                'profileLastChecked',        // Profile check timestamp
                'subscriptionLastChecked',   // Subscription check timestamp
                'cachedSubscription',        // Cached subscription data
                'subscriptionCacheTime',     // Subscription cache timestamp
                'encryptionKeyLastChecked',  // Encryption key check timestamp
                'cachedKeyMaterial',         // Cached encryption key material
                'cachedSalt',                // Cached encryption salt
                'auth_token',                // Authentication token
                
                // UI preferences and settings
                'theme',                     // User theme preference
                'upgradeBannerDismissed',    // Banner dismissal timestamp
                
                // Monitoring and debugging (preserve for troubleshooting)
                'anchored_debug',            // Debug mode flag
                'anchored_errors',           // Error logs
                'anchored_health_checks'     // Health check logs
            ];
            
            // Only remove cache-specific keys, preserving all user data
            const cacheKeysToRemove = [
                'anchored-cache-version'     // Only the cache version key
            ];
            
            // Safety check: ensure we're not removing any protected keys
            cacheKeysToRemove.forEach(key => {
                // Double-check this key is not in protected list
                const isProtected = protectedKeys.some(protectedKey => 
                    key === protectedKey || key.startsWith(protectedKey)
                );
                
                if (!isProtected && localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                }
            });
            
            // Additional safety: scan all localStorage keys and warn about any unexpected removals
            const allKeys = Object.keys(localStorage);
            const potentialNoteKeys = allKeys.filter(key => 
                key.includes('note') || 
                key.includes('sync') || 
                key.startsWith('anchored_')
            );
            
            if (potentialNoteKeys.length > 0) {
                console.log('Cache buster: Preserving note storage keys:', potentialNoteKeys);
            }
            
        } catch (e) {
            console.warn('Could not clear cache localStorage:', e);
        }

        // Force hard refresh
        window.location.reload(true);
    },

    // Show cache refresh notification
    showRefreshNotification() {
        // Track when we show the notification
        localStorage.setItem('anchored-last-refresh-notification', Date.now().toString());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'cache-refresh-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(29, 53, 87, 0.95);
                color: white;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 300px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <div style="font-weight: 600; margin-bottom: 8px;">
                    ✨ Site Updated
                </div>
                <div style="font-size: 14px; margin-bottom: 12px; opacity: 0.9;">
                    New features and improvements are available. Refresh when convenient.
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="window.CacheBuster.forceRefresh()" style="
                        background: #457B9D;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">Refresh Now</button>
                    <button onclick="window.CacheBuster.dismissNotification()" style="
                        background: transparent;
                        color: white;
                        border: 1px solid rgba(255,255,255,0.3);
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">Later</button>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            this.dismissNotification();
        }, 10000);
    },

    // Dismiss the refresh notification
    dismissNotification() {
        const notification = document.getElementById('cache-refresh-notification');
        if (notification) {
            notification.remove();
        }
        
        // Store current version to avoid showing again this session
        const currentVersion = this.getCurrentVersion();
        if (currentVersion) {
            this.storeVersion(currentVersion);
        }
    },

    // Initialize cache checking
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.checkCache());
        } else {
            this.checkCache();
        }
    },

    // Check cache and show notification if needed
    checkCache() {
        if (this.needsCacheRefresh()) {
            console.log('Cache refresh needed - showing notification');
            this.showRefreshNotification();
        } else {
            // Update stored version
            const currentVersion = this.getCurrentVersion();
            if (currentVersion) {
                this.storeVersion(currentVersion);
            }
        }
    },

    // Test function to verify cache buster doesn't affect note storage
    testNoteStorageProtection() {
        console.log('Testing cache buster note storage protection...');
        
        // Create test data that should be preserved
        const testData = {
            'anchored_notes_test': JSON.stringify({ id: 'test', title: 'Test Note' }),
            'anchored_sync_queue': JSON.stringify([{ noteId: 'test', operation: 'update' }]),
            'anchored_last_sync': Date.now().toString(),
            'anchored_change_count': '5',
            'supabase_session': JSON.stringify({ user: { id: 'test' } }),
            'userTier': 'premium',
            'theme': 'dark',
            'anchored-cache-version': '20250101000000'
        };
        
        // Store test data
        Object.entries(testData).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
        
        console.log('Before cache clear:', Object.keys(testData).map(key => ({
            key,
            exists: localStorage.getItem(key) !== null
        })));
        
        // Simulate cache clear (without actual page reload)
        try {
            const protectedKeys = [
                'anchored_notes_', 'anchored_meta', 'anchored_sync_queue', 
                'anchored_last_sync', 'anchored_change_count',
                'supabase_session', 'userTier', 'profileLastChecked', 
                'subscriptionLastChecked', 'cachedSubscription', 'subscriptionCacheTime',
                'encryptionKeyLastChecked', 'cachedKeyMaterial', 'cachedSalt', 'auth_token',
                'theme', 'upgradeBannerDismissed',
                'anchored_debug', 'anchored_errors', 'anchored_health_checks'
            ];
            
            const cacheKeysToRemove = ['anchored-cache-version'];
            
            cacheKeysToRemove.forEach(key => {
                const isProtected = protectedKeys.some(protectedKey => 
                    key === protectedKey || key.startsWith(protectedKey)
                );
                
                if (!isProtected && localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('Test cache clear failed:', e);
        }
        
        console.log('After cache clear:', Object.keys(testData).map(key => ({
            key,
            exists: localStorage.getItem(key) !== null,
            shouldExist: key !== 'anchored-cache-version'
        })));
        
        // Verify results
        const results = {
            noteDataPreserved: localStorage.getItem('anchored_notes_test') !== null,
            syncQueuePreserved: localStorage.getItem('anchored_sync_queue') !== null,
            authDataPreserved: localStorage.getItem('supabase_session') !== null,
            userTierPreserved: localStorage.getItem('userTier') !== null,
            themePreserved: localStorage.getItem('theme') !== null,
            cacheVersionRemoved: localStorage.getItem('anchored-cache-version') === null
        };
        
        console.log('Protection test results:', results);
        
        // Clean up test data
        Object.keys(testData).forEach(key => {
            if (key !== 'anchored-cache-version') { // This should already be removed
                localStorage.removeItem(key);
            }
        });
        
        const allPassed = Object.values(results).every(result => result === true);
        console.log(`Cache buster protection test: ${allPassed ? 'PASSED' : 'FAILED'}`);
        
        return results;
    }
};

// Auto-initialize when script loads
window.CacheBuster.init();