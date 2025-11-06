/**
 * RPC Failover Tests
 * 
 * Tests for RPC failover functionality to ensure high availability.
 */

import { Connection } from '@solana/web3.js';
import {
  RpcFailoverManager,
  initializeRpcFailover,
  getRpcManager,
  getRpcUrl,
  createConnectionWithFailover,
  withRpcFailover,
} from '@/lib/rpc-failover';

// Mock @solana/web3.js Connection
jest.mock('@solana/web3.js', () => ({
  ...jest.requireActual('@solana/web3.js'),
  Connection: jest.fn(),
}));

describe('RPC Failover', () => {
  let mockConnection: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = jest.fn();
    (Connection as unknown as jest.Mock) = mockConnection;
  });

  describe('RpcFailoverManager', () => {
    it('should initialize with primary endpoint', () => {
      const manager = new RpcFailoverManager({
        primary: 'https://api.mainnet-beta.solana.com',
      });

      const endpoint = manager.getCurrentEndpoint();
      expect(endpoint.url).toBe('https://api.mainnet-beta.solana.com');
      expect(endpoint.provider).toBe('Solana Labs');
      expect(endpoint.priority).toBe(0);
    });

    it('should initialize with backup endpoints', () => {
      const manager = new RpcFailoverManager({
        primary: 'https://primary.example.com',
        backups: ['https://backup1.example.com', 'https://backup2.example.com'],
      });

      const status = manager.getStatus();
      expect(status.endpoints).toHaveLength(3);
      expect(status.endpoints[0]?.url).toBe('https://primary.example.com');
      expect(status.endpoints[1]?.url).toBe('https://backup1.example.com');
      expect(status.endpoints[2]?.url).toBe('https://backup2.example.com');
    });

    it('should extract provider name from URL', () => {
      const manager = new RpcFailoverManager({
        primary: 'https://mainnet.helius-rpc.com',
      });

      const endpoint = manager.getCurrentEndpoint();
      expect(endpoint.provider).toBe('Helius');
    });

    it('should failover on error', async () => {
      const manager = new RpcFailoverManager({
        primary: 'https://primary.example.com',
        backups: ['https://backup.example.com'],
      });

      // Mock connection to fail on primary, succeed on backup
      let callCount = 0;
      mockConnection.mockImplementation(() => {
        callCount++;
        const conn = {
          getSlot: jest.fn().mockImplementation(() => {
            if (callCount === 1) {
              throw new Error('Primary failed');
            }
            return Promise.resolve(1000);
          }),
        };
        return conn;
      });

      await expect(
        manager.withFailover(async (conn) => {
          return await conn.getSlot();
        })
      ).resolves.toBe(1000);
    });

    it('should track endpoint health', async () => {
      const manager = new RpcFailoverManager({
        primary: 'https://primary.example.com',
        backups: ['https://backup.example.com'],
        healthCheckInterval: 1000,
        maxFailures: 2,
      });

      // Start health checks
      manager['startHealthChecks']();

      // Wait a bit for health check
      await new Promise(resolve => setTimeout(resolve, 1100));

      const status = manager.getStatus();
      expect(status.endpoints.length).toBeGreaterThan(0);

      // Stop health checks
      manager.stop();
    });
  });

  describe('Global Functions', () => {
    beforeEach(() => {
      // Clear global manager
      if (getRpcManager()) {
        getRpcManager()?.stop();
      }
    });

    it('should initialize global RPC manager', () => {
      initializeRpcFailover({
        primary: 'https://api.mainnet-beta.solana.com',
      });

      const manager = getRpcManager();
      expect(manager).toBeDefined();
    });

    it('should get current RPC URL', () => {
      initializeRpcFailover({
        primary: 'https://api.mainnet-beta.solana.com',
      });

      const url = getRpcUrl();
      expect(url).toBe('https://api.mainnet-beta.solana.com');
    });

    it('should create connection with failover', () => {
      initializeRpcFailover({
        primary: 'https://api.mainnet-beta.solana.com',
      });

      const connection = createConnectionWithFailover();
      expect(connection).toBeDefined();
    });

    it('should fallback to environment variable when manager not initialized', () => {
      const url = getRpcUrl();
      // Should fallback to env or default
      expect(typeof url).toBe('string');
    });
  });

  describe('withRpcFailover', () => {
    it('should execute function with failover', async () => {
      initializeRpcFailover({
        primary: 'https://api.mainnet-beta.solana.com',
      });

      mockConnection.mockImplementation(() => ({
        getSlot: jest.fn().mockResolvedValue(1000),
      }));

      const result = await withRpcFailover(async (conn) => {
        return await conn.getSlot();
      });

      expect(result).toBe(1000);
    });

    it('should handle errors gracefully', async () => {
      initializeRpcFailover({
        primary: 'https://primary.example.com',
        backups: ['https://backup.example.com'],
      });

      let callCount = 0;
      mockConnection.mockImplementation(() => ({
        getSlot: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Failed');
          }
          return Promise.resolve(1000);
        }),
      }));

      const result = await withRpcFailover(async (conn) => {
        return await conn.getSlot();
      });

      expect(result).toBe(1000);
    });
  });
});

