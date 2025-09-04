/**
 * Anchored Web Application - Client-Side Monitoring and Error Tracking
 * 
 * This module provides comprehensive monitoring, error tracking, and performance
 * metrics for the production web application.
 */

class ApplicationMonitor {
  constructor() {
    this.config = null;
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.errors = [];
    this.metrics = {
      pageLoads: 0,
      apiCalls: 0,
      errors: 0,
      performance: {}
    };

    this.init();
  }

  async init() {
    try {
      // Load configuration
      this.config = await window.urlNotesConfig.loadConfig();

      // Set up error tracking
      this.setupErrorTracking();

      // Set up performance monitoring
      this.setupPerformanceMonitoring();

      // Set up health checks
      this.setupHealthChecks();

      // Start monitoring
      this.startMonitoring();

      console.log('🔍 Application monitoring initialized');
    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
    }
  }

  setupErrorTracking() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        type: 'promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    });

    // Network error tracking
    this.interceptFetch();
  }

  setupPerformanceMonitoring() {
    // Page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          this.trackPerformance('page_load', {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint(),
            totalTime: navigation.loadEventEnd - navigation.fetchStart
          });
        }
      }, 0);
    });

    // Resource performance
    this.monitorResourcePerformance();
  }

  setupHealthChecks() {
    // Periodic health checks
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Visibility change monitoring
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.performHealthCheck();
      }
    });
  }

  startMonitoring() {
    // Track page view
    this.trackPageView();

    // Monitor user interactions
    this.monitorUserInteractions();

    // Monitor authentication state
    this.monitorAuthState();

    // Send initial metrics
    this.sendMetrics();

    // Set up periodic metrics reporting
    setInterval(() => {
      this.sendMetrics();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  trackError(error) {
    this.errors.push(error);
    this.metrics.errors++;

    console.error('Application Error:', error);

    // Send error to monitoring service (in production)
    if (this.config?.environment === 'production') {
      this.sendErrorReport(error);
    }

    // Store error locally for debugging
    this.storeErrorLocally(error);
  }

  trackPerformance(metric, data) {
    this.metrics.performance[metric] = {
      ...data,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    };

    console.log(`📊 Performance metric: ${metric}`, data);
  }

  trackPageView() {
    this.metrics.pageLoads++;

    const pageView = {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    console.log('📄 Page view tracked:', pageView);
  }

  async performHealthCheck() {
    try {
      const healthCheck = {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        url: window.location.href,
        online: navigator.onLine,
        memory: this.getMemoryInfo(),
        connection: this.getConnectionInfo(),
        supabase: await this.checkSupabaseHealth(),
        localStorage: this.checkLocalStorageHealth(),
        performance: this.getCurrentPerformanceMetrics()
      };

      console.log('💚 Health check completed:', healthCheck);

      // Store health check result
      this.storeHealthCheck(healthCheck);

      return healthCheck;
    } catch (error) {
      console.error('Health check failed:', error);
      this.trackError({
        type: 'health_check',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkSupabaseHealth() {
    try {
      if (!window.supabaseClient) {
        return { status: 'not_initialized' };
      }

      // Simple auth check
      const { data, error } = await window.supabaseClient.auth.getSession();

      return {
        status: error ? 'error' : 'healthy',
        authenticated: !!data?.session,
        error: error?.message
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  checkLocalStorageHealth() {
    try {
      const testKey = '_health_check_test';
      const testValue = Date.now().toString();

      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      return {
        status: retrieved === testValue ? 'healthy' : 'error',
        available: true
      };
    } catch (error) {
      return {
        status: 'error',
        available: false,
        error: error.message
      };
    }
  }

  interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const startTime = Date.now();
      this.metrics.apiCalls++;

      try {
        const response = await originalFetch(...args);
        const endTime = Date.now();

        // Track API performance
        this.trackPerformance('api_call', {
          url: args[0],
          method: args[1]?.method || 'GET',
          status: response.status,
          duration: endTime - startTime,
          success: response.ok
        });

        // Track API errors
        if (!response.ok) {
          this.trackError({
            type: 'api_error',
            message: `API call failed: ${response.status} ${response.statusText}`,
            url: args[0],
            status: response.status,
            timestamp: new Date().toISOString()
          });
        }

        return response;
      } catch (error) {
        const endTime = Date.now();

        this.trackError({
          type: 'network_error',
          message: error.message,
          url: args[0],
          duration: endTime - startTime,
          timestamp: new Date().toISOString()
        });

        throw error;
      }
    };
  }

  monitorUserInteractions() {
    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target;

      if (target.matches('button, .btn-primary, .btn-secondary, .nav-link')) {
        console.log('🖱️ User interaction:', {
          element: target.tagName,
          class: target.className,
          text: target.textContent?.trim(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      console.log('📝 Form submission:', {
        form: event.target.id || event.target.className,
        timestamp: new Date().toISOString()
      });
    });
  }

  monitorAuthState() {
    // Monitor authentication state changes
    try {
      if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.onAuthStateChange === 'function') {
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
          console.log('🔐 Auth state change:', {
            event,
            authenticated: !!session,
            timestamp: new Date().toISOString()
          });
        });
      } else {
        console.log('🔐 Supabase client not available for auth monitoring');
      }
    } catch (error) {
      console.log('🔐 Auth monitoring setup failed:', error.message);
    }
  }

  getMemoryInfo() {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    return null;
  }

  getConnectionInfo() {
    if (navigator.connection) {
      return {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      };
    }
    return null;
  }

  getFirstPaint() {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : null;
  }

  getFirstContentfulPaint() {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : null;
  }

  getCurrentPerformanceMetrics() {
    return {
      timing: performance.timing,
      navigation: performance.navigation,
      memory: this.getMemoryInfo(),
      connection: this.getConnectionInfo()
    };
  }

  monitorResourcePerformance() {
    // Monitor resource loading
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 1000) { // Resources taking more than 1 second
          console.warn('🐌 Slow resource:', {
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize
          });
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  storeErrorLocally(error) {
    try {
      const errors = JSON.parse(localStorage.getItem('anchored_errors') || '[]');
      errors.push(error);

      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }

      localStorage.setItem('anchored_errors', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to store error locally:', e);
    }
  }

  storeHealthCheck(healthCheck) {
    try {
      const checks = JSON.parse(localStorage.getItem('anchored_health_checks') || '[]');
      checks.push(healthCheck);

      // Keep only last 10 health checks
      if (checks.length > 10) {
        checks.splice(0, checks.length - 10);
      }

      localStorage.setItem('anchored_health_checks', JSON.stringify(checks));
    } catch (e) {
      console.error('Failed to store health check locally:', e);
    }
  }

  async sendErrorReport(error) {
    // In a real production environment, you would send this to a monitoring service
    // like Sentry, LogRocket, or a custom endpoint
    console.log('📤 Would send error report to monitoring service:', error);
  }

  async sendMetrics() {
    const metrics = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      url: window.location.href,
      ...this.metrics
    };

    console.log('📊 Metrics report:', metrics);

    // In production, send to analytics service
    if (this.config?.environment === 'production') {
      // Example: Send to analytics endpoint
      // await this.sendToAnalytics(metrics);
    }
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Public API for manual error reporting
  reportError(error, context = {}) {
    this.trackError({
      type: 'manual',
      message: error.message || error,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }

  // Public API for custom metrics
  reportMetric(name, value, tags = {}) {
    console.log(`📈 Custom metric: ${name} = ${value}`, tags);
  }

  // Get monitoring dashboard data
  getDashboardData() {
    return {
      session: {
        id: this.sessionId,
        startTime: this.startTime,
        uptime: Date.now() - this.startTime
      },
      metrics: this.metrics,
      errors: this.errors.slice(-10), // Last 10 errors
      health: JSON.parse(localStorage.getItem('anchored_health_checks') || '[]').slice(-5)
    };
  }
}

// Initialize monitoring when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window !== 'undefined') {
    window.applicationMonitor = new ApplicationMonitor();
  }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApplicationMonitor;
}