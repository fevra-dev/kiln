/**
 * Integration Tests: Emergency Shutdown
 * 
 * Tests emergency shutdown across API routes.
 */

// Mock Next.js server modules
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    headers: Headers;
    
    constructor(init?: { headers?: Headers }) {
      this.headers = init?.headers || new Headers();
    }
  },
  NextResponse: class NextResponse {
    status: number;
    headers: Headers;
    
    constructor(body: any, init?: { status?: number; headers?: HeadersInit }) {
      this.status = init?.status || 200;
      this.headers = new Headers(init?.headers);
    }
    
    static json(body: any, init?: { status?: number; headers?: HeadersInit }) {
      return new NextResponse(JSON.stringify(body), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
    }
  },
}));

import { NextRequest } from 'next/server';
import { checkEmergencyShutdown } from '@/lib/emergency-shutdown';

// Mock environment variables
const originalEnv = process.env;

function createMockRequest(origin?: string): NextRequest {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  
  return {
    headers,
  } as unknown as NextRequest;
}

describe('Emergency Shutdown Integration', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EMERGENCY_SHUTDOWN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('API Route Integration', () => {
    it('should block all API routes when shutdown is active', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      
      const routes = [
        '/api/tx/seal',
        '/api/tx/retire',
        '/api/tx/burn-memo',
        '/api/tx/simulate',
        '/api/verify',
      ];

      routes.forEach((path) => {
        const request = createMockRequest('https://example.com');
        const response = checkEmergencyShutdown(request);

        expect(response).toBeDefined();
        expect(response?.status).toBe(503);
      });
    });

    it('should allow requests when shutdown is not active', () => {
      process.env.EMERGENCY_SHUTDOWN = 'false';

      const request = createMockRequest('https://example.com');
      const response = checkEmergencyShutdown(request);

      expect(response).toBeUndefined();
    });

    it('should include CORS headers in shutdown response', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      
      const request = createMockRequest('https://example.com');
      const response = checkEmergencyShutdown(request);

      expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(response?.headers.get('Retry-After')).toBeDefined();
    });
  });
});

