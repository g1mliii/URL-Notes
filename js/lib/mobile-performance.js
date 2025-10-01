/**
 * Mobile Performance Optimization Module
 * Provides aggressive performance optimizations for mobile devices
 */

class MobilePerformanceOptimizer {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isLowEndDevice = this.detectLowEndDevice();
        this.optimizationsApplied = false;

        if (this.isMobile) {
            this.init();
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.innerWidth <= 768 && 'ontouchstart' in window);
    }

    detectLowEndDevice() {
        // Detect low-end devices based on various factors
        const hardwareConcurrency = navigator.hardwareConcurrency || 1;
        const deviceMemory = navigator.deviceMemory || 1;
        const connection = navigator.connection;

        // Consider it low-end if:
        // - Less than 4 CPU cores
        // - Less than 2GB RAM
        // - Slow connection
        const isLowCPU = hardwareConcurrency < 4;
        const isLowRAM = deviceMemory < 2;
        const isSlowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

        return isLowCPU || isLowRAM || isSlowConnection;
    }

    init() {
        // Apply optimizations immediately
        this.applyImmediateOptimizations();

        // Apply DOM optimizations when ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.applyDOMOptimizations());
        } else {
            this.applyDOMOptimizations();
        }

        // Set up performance monitoring
        this.setupPerformanceMonitoring();
    }

    applyImmediateOptimizations() {
        // Optimize viewport for mobile
        this.optimizeViewport();

        // Reduce animation complexity on low-end devices
        if (this.isLowEndDevice) {
            this.disableAnimations();
        }

        // Optimize scroll performance
        this.optimizeScrolling();

        // Preload critical resources
        this.preloadCriticalResources();
    }

    optimizeViewport() {
        // Ensure proper viewport settings
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }

        // Optimize viewport for performance
        viewport.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover';
    }

    disableAnimations() {
        // Add CSS to disable animations on low-end devices
        const style = document.createElement('style');
        style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    `;
        document.head.appendChild(style);
    }

    optimizeScrolling() {
        // Add CSS for optimized scrolling
        const style = document.createElement('style');
        style.textContent = `
      html {
        -webkit-overflow-scrolling: touch;
        scroll-behavior: smooth;
      }
      
      body {
        overscroll-behavior: none;
        -webkit-overscroll-behavior: none;
      }
    `;
        document.head.appendChild(style);
    }

    preloadCriticalResources() {
        // Preload critical CSS and fonts
        const criticalResources = [
            { href: '/css/main.css', as: 'style' },
            { href: '/css/components.css', as: 'style' },
            { href: '/css/mobile-performance.css', as: 'style' }
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            document.head.appendChild(link);
        });
    }

    applyDOMOptimizations() {
        if (this.optimizationsApplied) return;

        // Optimize all interactive elements
        this.optimizeInteractiveElements();

        // Set up intersection observer for lazy loading
        this.setupLazyLoading();

        // Optimize event listeners
        this.optimizeEventListeners();

        // Apply GPU acceleration
        this.applyGPUAcceleration();

        this.optimizationsApplied = true;
    }

    optimizeInteractiveElements() {
        const interactiveSelectors = [
            '.note-card',
            '.note-card-preview',
            '.note-item',
            '.btn-primary',
            '.btn-secondary',
            '.btn-danger',
            '.btn-icon',
            '.icon-btn',
            'button',
            'input',
            'textarea',
            'select'
        ];

        interactiveSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                this.optimizeElement(element);
            });
        });
    }

    optimizeElement(element) {
        // Apply GPU acceleration
        element.style.transform = 'translateZ(0)';
        element.style.backfaceVisibility = 'hidden';
        element.style.perspective = '1000px';

        // Optimize for touch
        element.style.touchAction = 'manipulation';

        // Optimize paint operations
        element.style.contain = 'layout style paint';
        element.style.willChange = 'transform, opacity';
    }

    setupLazyLoading() {
        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;

                    // Apply optimizations when element comes into view
                    this.optimizeElement(element);

                    // Stop observing this element
                    observer.unobserve(element);
                }
            });
        }, {
            rootMargin: '50px',
            threshold: 0.1
        });

        // Observe note cards for lazy optimization
        const noteCards = document.querySelectorAll('.note-card, .note-item');
        noteCards.forEach(card => observer.observe(card));
    }

    optimizeEventListeners() {
        // Replace existing event listeners with optimized versions
        this.optimizeClickHandlers();
        this.optimizeScrollHandlers();
        this.optimizeInputHandlers();
    }

    optimizeClickHandlers() {
        // Use event delegation for better performance
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.note-card, .note-item, .btn-primary, .btn-secondary, .btn-icon');
            if (target) {
                // Add immediate visual feedback
                target.style.transform = 'translateZ(0) scale(0.98)';

                // Reset after a short delay
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        target.style.transform = 'translateZ(0) scale(1)';
                    }, 100);
                });
            }
        }, { passive: true });
    }

    optimizeScrollHandlers() {
        let scrollTimeout;

        document.addEventListener('scroll', () => {
            // Throttle scroll events
            if (scrollTimeout) return;

            scrollTimeout = requestAnimationFrame(() => {
                // Optimize visible elements during scroll
                this.optimizeVisibleElements();
                scrollTimeout = null;
            });
        }, { passive: true });
    }

    optimizeInputHandlers() {
        // Optimize input fields for better typing performance
        const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
        inputs.forEach(input => {
            input.style.willChange = 'contents';
            input.style.contain = 'layout style';

            // Prevent zoom on focus for mobile
            if (this.isMobile) {
                input.style.fontSize = '16px';
            }
        });
    }

    optimizeVisibleElements() {
        // Get visible elements and optimize them
        const visibleElements = this.getVisibleElements();
        visibleElements.forEach(element => {
            if (!element.dataset.optimized) {
                this.optimizeElement(element);
                element.dataset.optimized = 'true';
            }
        });
    }

    getVisibleElements() {
        const elements = document.querySelectorAll('.note-card, .note-item, button');
        return Array.from(elements).filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
        });
    }

    applyGPUAcceleration() {
        // Force GPU acceleration on critical elements
        const criticalSelectors = [
            '.notes-grid',
            '.note-panel',
            '.modal',
            '.app-container',
            '.dashboard-content'
        ];

        criticalSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.transform = 'translate3d(0, 0, 0)';
                element.style.backfaceVisibility = 'hidden';
                element.style.perspective = '1000px';
            });
        });
    }

    setupPerformanceMonitoring() {
        // Monitor performance and adjust optimizations
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (entry.entryType === 'measure' && entry.duration > 16) {
                        // If operations take longer than 16ms (60fps), apply more aggressive optimizations
                        this.applyAggressiveOptimizations();
                    }
                });
            });

            observer.observe({ entryTypes: ['measure', 'navigation'] });
        }

        // Monitor memory usage
        if ('memory' in performance) {
            setInterval(() => {
                const memoryInfo = performance.memory;
                const memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;

                if (memoryUsage > 0.8) {
                    // High memory usage, apply memory optimizations
                    this.applyMemoryOptimizations();
                }
            }, 10000); // Check every 10 seconds
        }
    }

    applyAggressiveOptimizations() {
        // Disable all animations
        this.disableAnimations();

        // Reduce visual effects
        const style = document.createElement('style');
        style.textContent = `
      .glassmorphism, .card, .modal-content {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: rgba(255, 255, 255, 0.95) !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
      }
    `;
        document.head.appendChild(style);
    }

    applyMemoryOptimizations() {
        // Remove unused elements from DOM
        const hiddenElements = document.querySelectorAll('.hidden');
        hiddenElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        // Clear cached data
        if (window.dashboard && window.dashboard.clearCache) {
            window.dashboard.clearCache();
        }

        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }

    // Public API for manual optimization
    optimizeNoteCard(noteCard) {
        this.optimizeElement(noteCard);

        // Add touch feedback
        noteCard.addEventListener('touchstart', () => {
            noteCard.style.transform = 'translateZ(0) scale(0.98)';
        }, { passive: true });

        noteCard.addEventListener('touchend', () => {
            noteCard.style.transform = 'translateZ(0) scale(1)';
        }, { passive: true });
    }

    optimizeButton(button) {
        this.optimizeElement(button);

        // Optimize button for fast clicks
        button.style.transition = 'all 0.08s ease-out';

        button.addEventListener('touchstart', () => {
            button.style.transform = 'translateZ(0) scale(0.95)';
        }, { passive: true });

        button.addEventListener('touchend', () => {
            button.style.transform = 'translateZ(0) scale(1)';
        }, { passive: true });
    }

    // Utility method to check if optimizations should be applied
    shouldOptimize() {
        return this.isMobile;
    }

    // Get performance metrics
    getPerformanceMetrics() {
        return {
            isMobile: this.isMobile,
            isLowEndDevice: this.isLowEndDevice,
            optimizationsApplied: this.optimizationsApplied,
            deviceMemory: navigator.deviceMemory || 'unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            connection: navigator.connection ? navigator.connection.effectiveType : 'unknown'
        };
    }
}

// Initialize mobile performance optimizer
window.mobilePerformanceOptimizer = new MobilePerformanceOptimizer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobilePerformanceOptimizer;
}