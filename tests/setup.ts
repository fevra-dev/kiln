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

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

