/**
 * Emergency Shutdown Tests
 * 
 * Tests for emergency shutdown mechanism.
 */

// Mock Next.js server modules BEFORE importing the module under test
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    headers: Headers;
    ip?: string;
    
    constructor(init?: { headers?: Headers; ip?: string }) {
      this.headers = init?.headers || new Headers();
      this.ip = init?.ip;
    }
  },
  NextResponse: class NextResponse {
    status: number;
    headers: Headers;
    body?: string;
    
    constructor(body?: any, init?: { status?: number; headers?: HeadersInit }) {
      this.body = typeof body === 'string' ? body : JSON.stringify(body);
      this.status = init?.status || 200;
      this.headers = new Headers(init?.headers);
    }
    
    static json(body: any, init?: { status?: number; headers?: HeadersInit }) {
      const response = new NextResponse(JSON.stringify(body), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
      return response;
    }
    
    json() {
      return Promise.resolve(JSON.parse(this.body || '{}'));
    }
  },
}));

import { NextRequest } from 'next/server';
import { checkEmergencyShutdown } from '@/lib/emergency-shutdown';

// Mock environment variables
const originalEnv = process.env;

// Mock NextRequest
function createMockRequest(origin?: string): NextRequest {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  
  return new NextRequest({
    headers,
    ip: '127.0.0.1',
  });
}

describe('Emergency Shutdown', () => {
  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.EMERGENCY_SHUTDOWN;
    delete process.env.EMERGENCY_SHUTDOWN_MESSAGE;
    delete process.env.EMERGENCY_SHUTDOWN_RETRY_AFTER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('checkEmergencyShutdown', () => {
    it('should return undefined when shutdown is not active', () => {
      process.env.EMERGENCY_SHUTDOWN = 'false';
      const request = createMockRequest();

      const result = checkEmergencyShutdown(request);

      expect(result).toBeUndefined();
    });

    it('should return 503 response when shutdown is active', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      const request = createMockRequest('https://example.com');

      const result = checkEmergencyShutdown(request);

      expect(result).toBeDefined();
      expect(result?.status).toBe(503);
      
      // Verify response body
      return result?.json().then((body: unknown) => {
        expect(body).toHaveProperty('success', false);
        expect(body).toHaveProperty('code', 'EMERGENCY_SHUTDOWN');
      });
    });

    it('should use default message when not configured', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      const request = createMockRequest();

      const result = checkEmergencyShutdown(request);

      expect(result).toBeDefined();
      return result?.json().then((body: unknown) => {
        expect(body).toHaveProperty('error');
        expect((body as { error: string }).error).toContain('temporarily offline');
      });
    });

    it('should use custom message when configured', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      process.env.EMERGENCY_SHUTDOWN_MESSAGE = 'Custom shutdown message';
      const request = createMockRequest();

      const result = checkEmergencyShutdown(request);

      expect(result).toBeDefined();
      return result?.json().then((body: unknown) => {
        expect((body as { error: string }).error).toBe('Custom shutdown message');
      });
    });

    it('should set Retry-After header', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      process.env.EMERGENCY_SHUTDOWN_RETRY_AFTER = '300';
      const request = createMockRequest();

      const result = checkEmergencyShutdown(request);

      expect(result?.headers.get('Retry-After')).toBe('300');
    });

    it('should use default Retry-After when not configured', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      const request = createMockRequest();

      const result = checkEmergencyShutdown(request);

      expect(result?.headers.get('Retry-After')).toBe('300'); // Default 5 minutes
    });

    it('should include CORS headers when origin is present', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      const request = createMockRequest('https://example.com');

      const result = checkEmergencyShutdown(request);

      expect(result?.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(result?.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,PUT,DELETE,OPTIONS');
    });

    it('should not include CORS headers when origin is missing', () => {
      process.env.EMERGENCY_SHUTDOWN = 'true';
      const request = createMockRequest();

      const result = checkEmergencyShutdown(request);

      expect(result?.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });
});
