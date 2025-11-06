/**
 * Rate Limiter Tests
 * 
 * Tests for rate limiting functionality to prevent API abuse.
 */

import { NextRequest } from 'next/server';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';

// Mock NextRequest
function createMockRequest(ip?: string, forwardedFor?: string): NextRequest {
  const headers = new Headers();
  if (ip) headers.set('x-real-ip', ip);
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  
  return {
    headers,
    ip: ip || '127.0.0.1',
  } as unknown as NextRequest;
}

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear any existing rate limit state between tests
    // Note: In a real implementation, we'd need to expose a reset function
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const request = createMockRequest('192.168.1.1');
      const result = await checkRateLimit(request, {
        maxRequests: 5,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.resetIn).toBeGreaterThanOrEqual(0);
    });

    it('should block requests exceeding limit', async () => {
      const request = createMockRequest('192.168.1.2');
      const config = { maxRequests: 2, windowMs: 60000 };

      // Make requests up to limit
      await checkRateLimit(request, config);
      await checkRateLimit(request, config);

      // This should be blocked
      const result = await checkRateLimit(request, config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetIn).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeDefined();
    });

    it('should identify IP from x-real-ip header', async () => {
      const request = createMockRequest('10.0.0.1');
      const result = await checkRateLimit(request, {
        maxRequests: 5,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
    });

    it('should identify IP from x-forwarded-for header', async () => {
      const request = createMockRequest(undefined, '172.16.0.1');
      const result = await checkRateLimit(request, {
        maxRequests: 5,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
    });

    it('should handle multiple IPs in x-forwarded-for', async () => {
      const request = createMockRequest(undefined, '192.168.1.1, 10.0.0.1');
      const result = await checkRateLimit(request, {
        maxRequests: 5,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      // Should use first IP
    });

    it('should reset after window expires', async () => {
      const request = createMockRequest('192.168.1.3');
      const config = { maxRequests: 2, windowMs: 100 }; // 100ms window

      // Exhaust limit
      await checkRateLimit(request, config);
      await checkRateLimit(request, config);
      
      const blocked = await checkRateLimit(request, config);
      expect(blocked.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      const allowed = await checkRateLimit(request, config);
      expect(allowed.allowed).toBe(true);
    });

    it('should handle different IPs separately', async () => {
      const config = { maxRequests: 2, windowMs: 60000 };
      
      const request1 = createMockRequest('192.168.1.10');
      const request2 = createMockRequest('192.168.1.11');

      // Both should be allowed
      const result1 = await checkRateLimit(request1, config);
      const result2 = await checkRateLimit(request2, config);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('should return correct headers', () => {
      const result = {
        allowed: true,
        remaining: 3,
        resetIn: 60000, // milliseconds until reset
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('5');
      expect(headers['X-RateLimit-Remaining']).toBe('3');
      // Reset should be an ISO timestamp
      expect(headers['X-RateLimit-Reset']).toBeDefined();
      expect(typeof headers['X-RateLimit-Reset']).toBe('string');
    });

    it('should handle zero remaining', () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetIn: 30000, // milliseconds until reset
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
      expect(typeof headers['X-RateLimit-Reset']).toBe('string');
    });
  });
});

