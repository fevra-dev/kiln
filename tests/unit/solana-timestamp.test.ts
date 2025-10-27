/**
 * Unit Tests for Solana Timestamp Service
 * 
 * @description Tests blockchain timestamp fetching and validation
 */

import {
  SolanaTimestampService,
  getCurrentTimestamp,
  formatTimestamp,
  getTimestampDiff,
  isSlotFinalized,
  parseIsoToTimestamp,
  formatTimestampToIso,
  estimateSlotFromTimestamp,
} from '@/lib/solana-timestamp';
import { Connection } from '@solana/web3.js';

// Mock Solana Connection
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getSlot: jest.fn(),
      getBlockTime: jest.fn(),
    })),
  };
});

describe('SolanaTimestampService', () => {
  let mockConnection: jest.Mocked<Connection>;

  beforeEach(() => {
    mockConnection = new Connection('') as jest.Mocked<Connection>;
  });

  describe('getCurrentTimestamp', () => {
    it('fetches current slot and timestamp', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockConnection.getSlot = jest.fn().mockResolvedValue(268123456);
      mockConnection.getBlockTime = jest.fn().mockResolvedValue(now);

      const service = new SolanaTimestampService();
      // Override connection
      (service as any).connection = mockConnection;

      const result = await service.getCurrentTimestamp();

      expect(result.slot).toBe(268123456);
      expect(result.timestamp).toBe(now);
      expect(mockConnection.getSlot).toHaveBeenCalled();
      expect(mockConnection.getBlockTime).toHaveBeenCalledWith(268123456);
    });

    it('handles block time unavailable (estimates)', async () => {
      mockConnection.getSlot = jest.fn().mockResolvedValue(268123456);
      mockConnection.getBlockTime = jest.fn().mockResolvedValue(null);

      const service = new SolanaTimestampService();
      (service as any).connection = mockConnection;

      const result = await service.getCurrentTimestamp();

      expect(result.slot).toBe(268123456);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.finalized).toBe(false);
    });

    it('validates timestamp is reasonable', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockConnection.getSlot = jest.fn().mockResolvedValue(268123456);
      mockConnection.getBlockTime = jest.fn().mockResolvedValue(now);

      const service = new SolanaTimestampService();
      (service as any).connection = mockConnection;

      const result = await service.getCurrentTimestamp();

      expect(service.validateTimestamp(result.timestamp)).toBe(true);
    });

    it('rejects timestamp with excessive clock drift', async () => {
      const wayInPast = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      mockConnection.getSlot = jest.fn().mockResolvedValue(268123456);
      mockConnection.getBlockTime = jest.fn().mockResolvedValue(wayInPast);

      const service = new SolanaTimestampService();
      (service as any).connection = mockConnection;

      await expect(service.getCurrentTimestamp()).rejects.toThrow(/Invalid timestamp/);
    });

    it('falls back to secondary RPC on primary failure', async () => {
      const mockPrimaryConnection = new Connection('') as jest.Mocked<Connection>;
      mockPrimaryConnection.getSlot = jest.fn().mockRejectedValue(new Error('RPC error'));

      const mockFallbackConnection = new Connection('') as jest.Mocked<Connection>;
      const now = Math.floor(Date.now() / 1000);
      mockFallbackConnection.getSlot = jest.fn().mockResolvedValue(268123456);
      mockFallbackConnection.getBlockTime = jest.fn().mockResolvedValue(now);

      const service = new SolanaTimestampService();
      (service as any).connection = mockPrimaryConnection;
      (service as any).fallbackConnections = [mockFallbackConnection];

      const result = await service.getCurrentTimestamp();

      expect(result.slot).toBe(268123456);
      expect(mockPrimaryConnection.getSlot).toHaveBeenCalled();
      expect(mockFallbackConnection.getSlot).toHaveBeenCalled();
    });

    it('throws error when all RPCs fail', async () => {
      mockConnection.getSlot = jest.fn().mockRejectedValue(new Error('RPC error'));

      const service = new SolanaTimestampService();
      (service as any).connection = mockConnection;
      (service as any).fallbackConnections = [];

      await expect(service.getCurrentTimestamp()).rejects.toThrow(/Failed to fetch timestamp/);
    });
  });

  describe('getTimestampAtSlot', () => {
    it('fetches historical timestamp', async () => {
      const historicalSlot = 268000000;
      const historicalTime = 1739900000;
      mockConnection.getBlockTime = jest.fn().mockResolvedValue(historicalTime);

      const service = new SolanaTimestampService();
      (service as any).connection = mockConnection;

      const result = await service.getTimestampAtSlot(historicalSlot);

      expect(result.slot).toBe(historicalSlot);
      expect(result.timestamp).toBe(historicalTime);
      expect(result.finalized).toBe(true);
      expect(mockConnection.getBlockTime).toHaveBeenCalledWith(historicalSlot);
    });

    it('throws error when block time not available', async () => {
      mockConnection.getBlockTime = jest.fn().mockResolvedValue(null);

      const service = new SolanaTimestampService();
      (service as any).connection = mockConnection;

      await expect(service.getTimestampAtSlot(999999)).rejects.toThrow(/not available/);
    });
  });

  describe('validateTimestamp', () => {
    it('validates current timestamp', () => {
      const service = new SolanaTimestampService();
      const now = Math.floor(Date.now() / 1000);

      expect(service.validateTimestamp(now)).toBe(true);
    });

    it('validates timestamp within 5 minutes', () => {
      const service = new SolanaTimestampService();
      const now = Math.floor(Date.now() / 1000);
      const recent = now - 299; // 4:59 ago

      expect(service.validateTimestamp(recent)).toBe(true);
    });

    it('rejects timestamp more than 5 minutes old', () => {
      const service = new SolanaTimestampService();
      const now = Math.floor(Date.now() / 1000);
      const old = now - 301; // 5:01 ago

      expect(service.validateTimestamp(old)).toBe(false);
    });

    it('rejects timestamp more than 5 minutes in future', () => {
      const service = new SolanaTimestampService();
      const now = Math.floor(Date.now() / 1000);
      const future = now + 301; // 5:01 from now

      expect(service.validateTimestamp(future)).toBe(false);
    });
  });

  describe('estimateTimestampFromSlot', () => {
    it('estimates timestamp from slot number', () => {
      const service = new SolanaTimestampService();
      const slot = 1000000;
      const genesis = 1609459200;

      const estimated = service.estimateTimestampFromSlot(slot, genesis);

      expect(estimated).toBeGreaterThan(genesis);
      expect(estimated).toBeLessThan(genesis + slot); // Sanity check
    });
  });

  describe('getTimestampsBatch', () => {
    it('fetches multiple timestamps in parallel', async () => {
      mockConnection.getBlockTime = jest.fn()
        .mockResolvedValueOnce(1739900000)
        .mockResolvedValueOnce(1739900400)
        .mockResolvedValueOnce(1739900800);

      const service = new SolanaTimestampService();
      (service as any).connection = mockConnection;

      const results = await service.getTimestampsBatch([100, 200, 300]);

      expect(results.length).toBe(3);
      expect(results[0]?.slot).toBe(100);
      expect(results[1]?.slot).toBe(200);
      expect(results[2]?.slot).toBe(300);
    });

    it('handles partial failures', async () => {
      mockConnection.getBlockTime = jest.fn()
        .mockResolvedValueOnce(1739900000)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(1739900800);

      const service = new SolanaTimestampService();
      (service as any).connection = mockConnection;

      const results = await service.getTimestampsBatch([100, 200, 300]);

      expect(results.length).toBe(3);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
      expect(results[2]).not.toBeNull();
    });
  });
});

describe('Helper Functions', () => {
  describe('formatTimestamp', () => {
    it('formats timestamp with finalized indicator', () => {
      const timestamp = {
        slot: 268123456,
        timestamp: 1739900000,
        finalized: true
      };

      const formatted = formatTimestamp(timestamp);

      expect(formatted).toContain('268123456');
      expect(formatted).toContain('✓');
      expect(formatted).toContain('2025');
    });

    it('formats timestamp with unfinalized indicator', () => {
      const timestamp = {
        slot: 268123456,
        timestamp: 1739900000,
        finalized: false
      };

      const formatted = formatTimestamp(timestamp);

      expect(formatted).toContain('⏳');
    });
  });

  describe('getTimestampDiff', () => {
    it('calculates positive difference', () => {
      const diff = getTimestampDiff(1000, 2000);
      expect(diff).toBe(1000);
    });

    it('calculates negative difference', () => {
      const diff = getTimestampDiff(2000, 1000);
      expect(diff).toBe(-1000);
    });
  });

  describe('isSlotFinalized', () => {
    it('returns true for slot with 32+ confirmations', () => {
      expect(isSlotFinalized(100, 132)).toBe(true);
      expect(isSlotFinalized(100, 200)).toBe(true);
    });

    it('returns false for slot with less than 32 confirmations', () => {
      expect(isSlotFinalized(100, 131)).toBe(false);
      expect(isSlotFinalized(100, 100)).toBe(false);
    });
  });

  describe('parseIsoToTimestamp', () => {
    it('parses ISO date string to timestamp', () => {
      const iso = '2025-10-19T12:00:00.000Z';
      const timestamp = parseIsoToTimestamp(iso);

      expect(timestamp).toBeGreaterThan(1700000000); // After 2023
      expect(typeof timestamp).toBe('number');
    });
  });

  describe('formatTimestampToIso', () => {
    it('formats timestamp to ISO string', () => {
      const timestamp = 1739900000;
      const iso = formatTimestampToIso(timestamp);

      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(iso).toContain('Z');
    });
  });

  describe('estimateSlotFromTimestamp', () => {
    it('estimates slot from timestamp', () => {
      const genesis = 1609459200;
      const timestamp = genesis + 1000; // 1000 seconds after genesis
      const slot = estimateSlotFromTimestamp(timestamp, genesis);

      expect(slot).toBeGreaterThan(0);
      expect(slot).toBeLessThan(10000); // Sanity check (1000s / 0.4s = 2500 slots)
    });
  });
});

