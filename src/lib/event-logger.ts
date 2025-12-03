/**
 * Kiln Event Logger
 * 
 * Simple event logging for analytics and debugging.
 * Logs to console in development, can be extended to send to analytics endpoint.
 * 
 * @description Event logging/analytics for Kiln
 * @version 0.1.1
 */

// Event types for type safety
export type KilnEventType = 
  // Form events
  | 'form_submitted'
  | 'form_validation_error'
  // Wallet events
  | 'wallet_connected'
  | 'wallet_disconnected'
  // Teleburn events
  | 'teleburn_started'
  | 'teleburn_simulation_success'
  | 'teleburn_simulation_error'
  | 'teleburn_executed'
  | 'teleburn_success'
  | 'teleburn_error'
  // Verification events
  | 'verification_requested'
  | 'verification_success'
  | 'verification_error'
  // Batch events
  | 'batch_item_added'
  | 'batch_item_removed'
  | 'batch_burn_started'
  | 'batch_item_success'
  | 'batch_item_error'
  | 'batch_burn_completed'
  // History events
  | 'history_loaded'
  // General
  | 'page_view'
  | 'error';

// Event payload structure
export interface KilnEvent {
  type: KilnEventType;
  timestamp: number;
  data?: Record<string, unknown>;
  sessionId: string;
}

// Simple session ID generator
function generateSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem('kiln_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('kiln_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Kiln Event Logger
 * 
 * Provides structured event logging for analytics and debugging.
 */
export class KilnEventLogger {
  private static events: KilnEvent[] = [];
  private static sessionId: string = '';
  private static analyticsEndpoint: string | null = null;

  /**
   * Initialize the logger with optional analytics endpoint
   */
  static init(analyticsEndpoint?: string) {
    this.sessionId = generateSessionId();
    this.analyticsEndpoint = analyticsEndpoint || null;
    
    // Log page view on init
    if (typeof window !== 'undefined') {
      this.log('page_view', { 
        path: window.location.pathname,
        referrer: document.referrer || 'direct',
      });
    }
  }

  /**
   * Log an event
   */
  static log(type: KilnEventType, data?: Record<string, unknown>) {
    const event: KilnEvent = {
      type,
      timestamp: Date.now(),
      data,
      sessionId: this.sessionId || generateSessionId(),
    };

    // Store locally
    this.events.push(event);

    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 [KILN EVENT] ${type}`, data || '');
    }

    // Send to analytics endpoint if configured
    if (this.analyticsEndpoint) {
      this.sendToAnalytics(event).catch(() => {
        // Silently fail - analytics should not break the app
      });
    }

    // Store in localStorage for persistence
    this.persistEvents();
  }

  /**
   * Get all logged events
   */
  static getEvents(): KilnEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  static getEventsByType(type: KilnEventType): KilnEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get event count by type
   */
  static getEventCount(type: KilnEventType): number {
    return this.events.filter(e => e.type === type).length;
  }

  /**
   * Get session summary
   */
  static getSessionSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const event of this.events) {
      summary[event.type] = (summary[event.type] || 0) + 1;
    }
    return summary;
  }

  /**
   * Clear all events
   */
  static clear() {
    this.events = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kiln_events');
    }
  }

  /**
   * Export events as JSON
   */
  static export(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      exportedAt: new Date().toISOString(),
      events: this.events,
    }, null, 2);
  }

  /**
   * Persist events to localStorage
   */
  private static persistEvents() {
    if (typeof window === 'undefined') return;
    
    try {
      // Only persist last 50 events
      const toStore = this.events.slice(-50);
      localStorage.setItem('kiln_events', JSON.stringify(toStore));
    } catch {
      // localStorage might be full or disabled
    }
  }

  /**
   * Load persisted events from localStorage
   */
  static loadPersistedEvents() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('kiln_events');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.events = parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Send event to analytics endpoint
   */
  private static async sendToAnalytics(event: KilnEvent): Promise<void> {
    if (!this.analyticsEndpoint) return;

    await fetch(this.analyticsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  }
}

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
  KilnEventLogger.init();
  KilnEventLogger.loadPersistedEvents();
}

