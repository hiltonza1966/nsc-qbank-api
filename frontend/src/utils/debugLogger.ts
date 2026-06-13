// frontend/src/utils/debugLogger.ts
// Global error logging — sends frontend errors to backend

const API_BASE = '/api';

interface DebugLogEntry {
  type: string;
  message: string;
  stack?: string;
  component?: string;
  url: string;
  userAgent: string;
  timestamp: string;
}

class DebugLogger {
  private buffer: DebugLogEntry[] = [];
  private flushInterval: number = 2000; // Flush every 2 seconds
  private timer: ReturnType<typeof setInterval> | null = null;
  private enabled: boolean = true;

  constructor() {
    this.setupGlobalHandlers();
    this.startFlushTimer();
    console.log('[DebugLogger] Initialized — errors will be logged to backend');
  }

  private setupGlobalHandlers() {
    // Catch uncaught errors
    window.addEventListener('error', (event) => {
      this.log({
        type: 'UNCAUGHT_ERROR',
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log({
        type: 'UNHANDLED_REJECTION',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
    });

    // Catch React errors (if ErrorBoundary calls this)
    (window as any).__logReactError = (error: Error, componentStack: string) => {
      this.log({
        type: 'REACT_ERROR',
        message: error.message,
        stack: error.stack,
        component: componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
    };
  }

  private startFlushTimer() {
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  log(entry: DebugLogEntry) {
    // Always log to console
    console.error(`[DEBUG] ${entry.type}: ${entry.message}`, entry);

    if (!this.enabled) return;

    this.buffer.push(entry);

    // If buffer gets large, flush immediately
    if (this.buffer.length >= 10) {
      this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    try {
      const response = await fetch(`${API_BASE}/debug/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch[0]), // Send first entry for now
      });

      if (!response.ok) {
        console.warn('[DebugLogger] Failed to send logs to backend');
      }
    } catch (e) {
      // Don't log this to avoid infinite loop
    }
  }

  // Manual log for components
  logError(message: string, component?: string, stack?: string) {
    this.log({
      type: 'COMPONENT_ERROR',
      message,
      component,
      stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  // Log API errors
  logAPIError(url: string, status: number, response: string) {
    this.log({
      type: 'API_ERROR',
      message: `HTTP ${status}: ${response}`,
      url,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Singleton instance
export const debugLogger = new DebugLogger();
export default debugLogger;
