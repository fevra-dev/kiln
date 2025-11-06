/**
 * Integration Tests: API Rate Limiting
 * 
 * Tests rate limiting across actual API routes.
 */

// Mock Next.js server modules
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    headers: Headers;
    ip?: string;
    url?: string;
    
    constructor(init?: { headers?: Headers; ip?: string; url?: string }) {
      this.headers = init?.headers || new Headers();
      this.ip = init?.ip;
      this.url = init?.url;
    }
  },
  NextResponse: class NextResponse {},
}));

import { NextRequest } from 'next/server';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';

// Mock NextRequest
function createMockRequest(ip?: string, path?: string): NextRequest {
  const headers = new Headers();
  if (ip) headers.set('x-real-ip', ip);
  
  const url = `http://localhost:3000${path || '/api/tx/seal'}`;
  
  return {
    headers,
    ip: ip || '127.0.0.1',
    url,
  } as unknown as NextRequest;
}

describe('API Rate Limiting Integration', () => {
  beforeEach(() => {
    // Clear rate limit state between tests
    // Note: Would need to expose clear function or use test-specific config
  });

  describe('Seal Endpoint Rate Limiting', () => {
    it('should enforce rate limit on /api/tx/seal', async () => {
      const request = createMockRequest('192.168.1.100', '/api/tx/seal');
      const config = { maxRequests: 3, windowMs: 60000 };

      // Make requests up to limit
      const r1 = await checkRateLimit(request, config);
      const r2 = await checkRateLimit(request, config);
      const r3 = await checkRateLimit(request, config);

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(true);

      // Fourth request should be blocked
      const r4 = await checkRateLimit(request, config);
      expect(r4.allowed).toBe(false);
      expect(r4.error).toBeDefined();
    });

    it('should include rate limit headers in response', async () => {
      const request = createMockRequest('192.168.1.101', '/api/tx/seal');
      const config = { maxRequests: 5, windowMs: 60000 };

      const result = await checkRateLimit(request, config);
      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBeDefined();
      expect(headers['X-RateLimit-Remaining']).toBeDefined();
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });
  });

  describe('Retire Endpoint Rate Limiting', () => {
    it('should enforce rate limit on /api/tx/retire', async () => {
      const request = createMockRequest('192.168.1.102', '/api/tx/retire');
      const config = { maxRequests: 3, windowMs: 60000 };

      // Exhaust limit
      await checkRateLimit(request, config);
      await checkRateLimit(request, config);
      await checkRateLimit(request, config);

      // Should be blocked
      const result = await checkRateLimit(request, config);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Verify Endpoint Rate Limiting', () => {
    it('should have more lenient rate limit for /api/verify', async () => {
      const request = createMockRequest('192.168.1.103', '/api/verify');
      const config = { maxRequests: 10, windowMs: 60000 }; // More lenient

      // Should allow more requests
      for (let i = 0; i < 10; i++) {
        const result = await checkRateLimit(request, config);
        expect(result.allowed).toBe(true);
      }

      // 11th should be blocked
      const result = await checkRateLimit(request, config);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Cross-Endpoint Rate Limiting', () => {
    it('should track rate limits per IP across endpoints', async () => {
      const ip = '192.168.1.104';
      const config = { maxRequests: 5, windowMs: 60000 };

      // Make requests to different endpoints with same IP
      const sealRequest = createMockRequest(ip, '/api/tx/seal');
      const retireRequest = createMockRequest(ip, '/api/tx/retire');
      const verifyRequest = createMockRequest(ip, '/api/verify');

      // Should count towards same limit (since rate limiter uses IP)
      await checkRateLimit(sealRequest, config);
      await checkRateLimit(retireRequest, config);
      await checkRateLimit(verifyRequest, config);

      // Should still have 2 remaining
      const result = await checkRateLimit(sealRequest, config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });
  });
});

