/**
 * Rate Limiter Utility
 * 
 * Prevents spam/DoS attacks on API endpoints by limiting requests per user/IP.
 * Uses in-memory storage with automatic cleanup of expired entries.
 * 
 * For production, consider using Redis for distributed rate limiting.
 * 
 * @version 0.1.1
 */

import { NextRequest } from 'next/server';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests?: number;
  /** Time window in milliseconds */
  windowMs?: number;
  /** Custom identifier function (default: uses IP address) */
  identifier?: (request: NextRequest) => string;
}

export interface RateLimitResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Time until window resets (milliseconds) */
  resetIn: number;
  /** Error message if rate limited */
  error?: string;
}

// ============================================================================
// RATE LIMITER STORAGE
// ============================================================================

/**
 * In-memory storage for rate limit data
 * Key: identifier (IP or user ID)
 * Value: Array of timestamps for requests in current window
 */
const rateLimitStore = new Map<string, number[]>();

/**
 * Cleanup interval to remove expired entries
 * Runs every 5 minutes
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start cleanup interval if not already running
 */
function startCleanupInterval(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, timestamps] of rateLimitStore.entries()) {
      // If all timestamps are old, mark for deletion
      if (timestamps.length === 0 || timestamps.every((ts) => now - ts > 60000)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      rateLimitStore.delete(key);
    }

    // If store is empty, stop cleanup interval
    if (rateLimitStore.size === 0) {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

// ============================================================================
// RATE LIMITER IMPLEMENTATION
// ============================================================================

/**
 * Get client identifier from request
 * Prioritizes IP address, falls back to user agent + IP
 * 
 * @param request - Next.js request object
 * @returns Unique identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip = forwarded?.split(',')[0]?.trim() 
    || realIp 
    || cfConnectingIp 
    || request.ip 
    || 'unknown';

  // Fallback: use user agent + IP for better uniqueness
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `${ip}:${userAgent.slice(0, 50)}`; // Limit user agent length
}

/**
 * Check rate limit for a request
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and metadata
 * 
 * @example
 * ```typescript
 * const result = await checkRateLimit(request, {
 *   maxRequests: 5,
 *   windowMs: 60000, // 1 minute
 * });
 * 
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: result.error },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = {}
): Promise<RateLimitResult> {
  const {
    maxRequests = 5, // Default: 5 requests per minute
    windowMs = 60000, // Default: 1 minute window
    identifier = getClientIdentifier,
  } = config;

  // Start cleanup interval if needed
  startCleanupInterval();

  // Get identifier for this request
  const id = identifier(request);

  // Get current timestamp
  const now = Date.now();

  // Get existing timestamps for this identifier
  const timestamps = rateLimitStore.get(id) || [];

  // Remove timestamps outside the current window
  const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

  // Check if limit exceeded
  if (validTimestamps.length >= maxRequests) {
    // Calculate reset time (oldest timestamp + window)
    const oldestTimestamp = validTimestamps[0];
    const resetIn = oldestTimestamp + windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.max(0, resetIn),
      error: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds. Try again in ${Math.ceil(resetIn / 1000)} seconds.`,
    };
  }

  // Add current request timestamp
  validTimestamps.push(now);
  rateLimitStore.set(id, validTimestamps);

  // Calculate remaining requests
  const remaining = maxRequests - validTimestamps.length;

  // Calculate reset time
  const oldestTimestamp = validTimestamps[0];
  const resetIn = oldestTimestamp + windowMs - now;

  return {
    allowed: true,
    remaining,
    resetIn: Math.max(0, resetIn),
  };
}

/**
 * Get rate limit headers for response
 * 
 * @param result - Rate limit result
 * @returns Headers to add to response
 */
export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.allowed ? '5' : '0',
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(Date.now() + result.resetIn).toISOString(),
  };
}

/**
 * Clear rate limit data for a specific identifier
 * Useful for testing or manual reset
 * 
 * @param identifier - Identifier to clear
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Clear all rate limit data
 * Useful for testing
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get current rate limit statistics
 * Useful for monitoring/debugging
 * 
 * @returns Statistics about current rate limit state
 */
export function getRateLimitStats(): {
  totalIdentifiers: number;
  totalRequests: number;
} {
  let totalRequests = 0;
  for (const timestamps of rateLimitStore.values()) {
    totalRequests += timestamps.length;
  }

  return {
    totalIdentifiers: rateLimitStore.size,
    totalRequests,
  };
}

