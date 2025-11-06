/**
 * Jest Test Setup
 * 
 * @description Global test configuration and mocks
 */

// Mock Web Crypto API for Node.js environment
import { webcrypto } from 'crypto';

if (typeof global.crypto === 'undefined') {
  Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    writable: true
  });
}

// Polyfill TextEncoder/TextDecoder for Node.js
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  Object.defineProperty(global, 'TextEncoder', {
    value: TextEncoder,
    writable: true
  });
}

if (typeof global.TextDecoder === 'undefined') {
  Object.defineProperty(global, 'TextDecoder', {
    value: TextDecoder,
    writable: true
  });
}

// Mock fetch for testing
global.fetch = jest.fn();

// Mock AbortSignal.timeout for older Node versions
if (typeof AbortSignal.timeout === 'undefined') {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// Mock Headers for Node.js environment
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    private map = new Map<string, string>();

    constructor(init?: HeadersInit) {
      if (init) {
        if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.set(key, value));
        } else if (init instanceof Headers) {
          init.forEach((value, key) => this.set(key, value));
        } else {
          Object.entries(init).forEach(([key, value]) => this.set(key, value));
        }
      }
    }

    get(name: string): string | null {
      return this.map.get(name.toLowerCase()) || null;
    }

    set(name: string, value: string): void {
      this.map.set(name.toLowerCase(), value);
    }

    has(name: string): boolean {
      return this.map.has(name.toLowerCase());
    }

    delete(name: string): void {
      this.map.delete(name.toLowerCase());
    }

    forEach(callback: (value: string, key: string) => void): void {
      this.map.forEach((value, key) => callback(value, key));
    }
  } as any;
}

// Mock Request for Node.js environment
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    url: string;
    method: string;
    headers: Headers;
    body: any;

    constructor(input: string | Request, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
      this.body = init?.body;
    }

    json() {
      return Promise.resolve(JSON.parse(this.body || '{}'));
    }

    text() {
      return Promise.resolve(typeof this.body === 'string' ? this.body : '');
    }
  } as any;
}

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

