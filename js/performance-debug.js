// Performance Debugging Tool
class PerformanceDebugger {
  constructor() {
    this.measurements = new Map();
    this.observers = [];
    this.init();
  }

  init() {
    // Monitor INP (Interaction to Next Paint)
    this.observeINP();
    
    // Monitor long tasks
    this.observeLongTasks();
    
    // Monitor layout shifts
    this.observeLayoutShifts();
    
    // Monitor resource loading
    this.observeResources();
    
    // Add performance panel to page
    this.createDebugPanel();
  }

  observeINP() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.processingStart && entry.startTime) {
              const inp = entry.processingStart - entry.startTime;
              if (inp > 100) { // Log slow interactions
                console.warn(`🐌 Slow interaction detected:`, {
                  type: entry.name,
                  duration: `${inp.toFixed(2)}ms`,
                  target: entry.target,
                  entry
                });
                this.logSlowInteraction(entry, inp);
              }
            }
          }
        });
        
        observer.observe({ type: 'event', buffered: true });
        this.observers.push(observer);
      } catch (e) {
        console.warn('INP observation not supported:', e);
      }
    }
  }

  observeLongTasks() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            console.warn(`🔥 Long task detected:`, {
              duration: `${entry.duration.toFixed(2)}ms`,
              startTime: `${entry.startTime.toFixed(2)}ms`,
              entry
            });
            this.logLongTask(entry);
          }
        });
        
        observer.observe({ type: 'longtask', buffered: true });
        this.observers.push(observer);
      } catch (e) {
        console.warn('Long task observation not supported:', e);
      }
    }
  }

  observeLayoutShifts() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.value > 0.1) { // Significant layout shift
              console.warn(`📐 Layout shift detected:`, {
                value: entry.value.toFixed(4),
                sources: entry.sources,
                entry
              });
            }
          }
        });
        
        observer.observe({ type: 'layout-shift', buffered: true });
        this.observers.push(observer);
      } catch (e) {
        console.warn('Layout shift observation not supported:', e);
      }
    }
  }

  observeResources() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 1000) { // Slow resource loading
              console.warn(`📦 Slow resource:`, {
                name: entry.name,
                duration: `${entry.duration.toFixed(2)}ms`,
                size: entry.transferSize,
                entry
              });
            }
          }
        });
        
        observer.observe({ type: 'resource', buffered: true });
        this.observers.push(observer);
      } catch (e) {
        console.warn('Resource observation not supported:', e);
      }
    }
  }

  // Measure function execution time
  measureFunction(name, fn) {
    return async (...args) => {
      const start = performance.now();
      try {
        const result = await fn(...args);
        const duration = performance.now() - start;
        
        if (duration > 50) { // Log functions taking >50ms
          console.warn(`⏱️ Slow function: ${name}`, {
            duration: `${duration.toFixed(2)}ms`,
            args: args.length
          });
        }
        
        this.measurements.set(name, {
          duration,
          timestamp: Date.now(),
          args: args.length
        });
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.error(`❌ Function error: ${name}`, {
          duration: `${duration.toFixed(2)}ms`,
          error
        });
        throw error;
      }
    };
  }

  // Wrap event listeners to measure their performance
  wrapEventListener(element, event, handler, options) {
    const wrappedHandler = this.measureFunction(`${event}-handler`, handler);
    element.addEventListener(event, wrappedHandler, options);
    return wrappedHandler;
  }

  logSlowInteraction(entry, duration) {
    const panel = document.getElementById('perf-debug-panel');
    if (panel) {
      const log = panel.querySelector('.perf-log');
      const item = document.createElement('div');
      item.className = 'perf-item slow-interaction';
      item.innerHTML = `
        <span class="perf-time">${new Date().toLocaleTimeString()}</span>
        <span class="perf-type">SLOW INTERACTION</span>
        <span class="perf-details">${entry.name} - ${duration.toFixed(2)}ms</span>
      `;
      log.insertBefore(item, log.firstChild);
      
      // Keep only last 20 items
      while (log.children.length > 20) {
        log.removeChild(log.lastChild);
      }
    }
  }

  logLongTask(entry) {
    const panel = document.getElementById('perf-debug-panel');
    if (panel) {
      const log = panel.querySelector('.perf-log');
      const item = document.createElement('div');
      item.className = 'perf-item long-task';
      item.innerHTML = `
        <span class="perf-time">${new Date().toLocaleTimeString()}</span>
        <span class="perf-type">LONG TASK</span>
        <span class="perf-details">${entry.duration.toFixed(2)}ms</span>
      `;
      log.insertBefore(item, log.firstChild);
      
      // Keep only last 20 items
      while (log.children.length > 20) {
        log.removeChild(log.lastChild);
      }
    }
  }

  createDebugPanel() {
    // Only show in development or when ?debug=perf is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const debugParam = urlParams.get('debug') === 'perf';
    
    if (!isDev && !debugParam) return;

    const panel = document.createElement('div');
    panel.id = 'perf-debug-panel';
    panel.innerHTML = `
      <div class="perf-header">
        <h4>Performance Debug</h4>
        <button class="perf-toggle">Hide</button>
        <button class="perf-clear">Clear</button>
      </div>
      <div class="perf-stats">
        <div class="perf-stat">
          <span class="perf-label">Page Load:</span>
          <span class="perf-value" id="perf-load-time">-</span>
        </div>
        <div class="perf-stat">
          <span class="perf-label">DOM Ready:</span>
          <span class="perf-value" id="perf-dom-time">-</span>
        </div>
      </div>
      <div class="perf-log"></div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #perf-debug-panel {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        max-height: 400px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        font-family: monospace;
        font-size: 12px;
        border-radius: 8px;
        padding: 10px;
        z-index: 10000;
        overflow: hidden;
      }
      .perf-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        border-bottom: 1px solid #333;
        padding-bottom: 5px;
      }
      .perf-header h4 {
        margin: 0;
        font-size: 14px;
      }
      .perf-header button {
        background: #333;
        color: white;
        border: none;
        padding: 2px 6px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
      }
      .perf-stats {
        margin-bottom: 10px;
      }
      .perf-stat {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2px;
      }
      .perf-log {
        max-height: 250px;
        overflow-y: auto;
      }
      .perf-item {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
        border-bottom: 1px solid #222;
        font-size: 10px;
      }
      .perf-item.slow-interaction {
        background: rgba(255, 165, 0, 0.2);
      }
      .perf-item.long-task {
        background: rgba(255, 0, 0, 0.2);
      }
      .perf-type {
        font-weight: bold;
        color: #ff6b6b;
      }
      .perf-details {
        color: #ffd93d;
      }
      .perf-hidden {
        transform: translateX(280px);
        transition: transform 0.3s ease;
      }
    `;
    document.head.appendChild(style);

    // Add event listeners
    panel.querySelector('.perf-toggle').addEventListener('click', () => {
      panel.classList.toggle('perf-hidden');
    });

    panel.querySelector('.perf-clear').addEventListener('click', () => {
      panel.querySelector('.perf-log').innerHTML = '';
    });

    document.body.appendChild(panel);

    // Update load times
    window.addEventListener('load', () => {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      const domTime = performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
      
      document.getElementById('perf-load-time').textContent = `${loadTime}ms`;
      document.getElementById('perf-dom-time').textContent = `${domTime}ms`;
    });
  }

  // Get performance summary
  getSummary() {
    const summary = {
      measurements: Object.fromEntries(this.measurements),
      timing: performance.timing,
      navigation: performance.navigation,
      memory: performance.memory || 'Not available'
    };
    
    console.table(summary.measurements);
    return summary;
  }

  // Clean up observers
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    const panel = document.getElementById('perf-debug-panel');
    if (panel) {
      panel.remove();
    }
  }
}

// Auto-initialize if debug parameter is present or in development
const urlParams = new URLSearchParams(window.location.search);
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const debugParam = urlParams.get('debug') === 'perf';

if (isDev || debugParam) {
  window.perfDebugger = new PerformanceDebugger();
  console.log('🔍 Performance debugger initialized. Use window.perfDebugger.getSummary() for details.');
}

// Export for manual initialization
window.PerformanceDebugger = PerformanceDebugger;