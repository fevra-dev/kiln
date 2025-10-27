/**
 * Unit Tests for Inscription Verifier
 * 
 * @description Tests inscription content fetching and SHA-256 verification
 */

import { InscriptionVerifier, checkOrdinalsApiHealth, formatByteSize, getContentCategory } from '@/lib/inscription-verifier';

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('InscriptionVerifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verify', () => {
    const validInscriptionId = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0';
    const testContent = 'Hello, world!';
    const expectedHash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e'; // SHA-256 of "Hello, world!"

    it('verifies matching content successfully', async () => {
      // Mock successful fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'text/plain',
          'content-length': '13'
        }),
        arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
      } as Response);

      const result = await InscriptionVerifier.verify(validInscriptionId, expectedHash);

      expect(result.valid).toBe(true);
      expect(result.inscriptionId).toBe(validInscriptionId);
      expect(result.fetchedHash.toLowerCase()).toBe(expectedHash.toLowerCase());
      expect(result.contentType).toBe('text/plain');
      expect(result.byteLength).toBe(13);
      expect(result.error).toBeUndefined();
    });

    it('detects hash mismatch', async () => {
      const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
      } as Response);

      const result = await InscriptionVerifier.verify(validInscriptionId, wrongHash);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('mismatch');
    });

    it('handles 404 inscription not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await InscriptionVerifier.verify(validInscriptionId, expectedHash);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('404');
      expect(result.error).toContain('not exist');
    });

    it('handles network timeout', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      const result = await InscriptionVerifier.verify(validInscriptionId, expectedHash);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const result = await InscriptionVerifier.verify(validInscriptionId, expectedHash);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('rejects invalid inscription ID format', async () => {
      const invalid = 'invalid-id';

      const result = await InscriptionVerifier.verify(invalid, expectedHash);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid inscription ID format');
      expect(mockFetch).not.toHaveBeenCalled(); // Should not fetch
    });

    it('rejects invalid SHA-256 format', async () => {
      const invalidHash = 'not-a-valid-hash';

      const result = await InscriptionVerifier.verify(validInscriptionId, invalidHash);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid SHA-256 format');
      expect(mockFetch).not.toHaveBeenCalled(); // Should not fetch
    });

    it('handles content too large', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'content-length': '200000000' // 200MB
        }),
      } as Response);

      const result = await InscriptionVerifier.verify(validInscriptionId, expectedHash);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('is case-insensitive for hash comparison', async () => {
      const upperCaseHash = expectedHash.toUpperCase();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
      } as Response);

      const result = await InscriptionVerifier.verify(validInscriptionId, upperCaseHash);

      expect(result.valid).toBe(true);
    });

    it('sets correct content URL in fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        arrayBuffer: async () => new TextEncoder().encode(testContent).buffer,
      } as Response);

      await InscriptionVerifier.verify(validInscriptionId, expectedHash);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/content/${validInscriptionId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': '*/*',
          }),
        })
      );
    });
  });

  describe('fetchMetadata', () => {
    const validInscriptionId = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0';

    it('fetches metadata successfully', async () => {
      const mockMetadata = { id: validInscriptionId, number: 12345 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      } as Response);

      const result = await InscriptionVerifier.fetchMetadata(validInscriptionId);

      expect(result).toEqual(mockMetadata);
    });

    it('returns null on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await InscriptionVerifier.fetchMetadata(validInscriptionId);

      expect(result).toBeNull();
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await InscriptionVerifier.fetchMetadata(validInscriptionId);

      expect(result).toBeNull();
    });
  });

  describe('getContentUrl', () => {
    it('returns correct content URL', () => {
      const inscriptionId = 'abc123i0';
      const url = InscriptionVerifier.getContentUrl(inscriptionId);

      expect(url).toContain('/content/');
      expect(url).toContain(inscriptionId);
    });
  });

  describe('getExplorerUrl', () => {
    it('returns correct explorer URL', () => {
      const inscriptionId = 'abc123i0';
      const url = InscriptionVerifier.getExplorerUrl(inscriptionId);

      expect(url).toContain('/inscription/');
      expect(url).toContain(inscriptionId);
    });
  });

  describe('verifyBatch', () => {
    const id1 = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789i0';
    const id2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210i1';
    const hash1 = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';
    const hash2 = '0000000000000000000000000000000000000000000000000000000000000000';

    it('verifies multiple inscriptions in batch', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'text/plain' }),
          arrayBuffer: async () => new TextEncoder().encode('Hello, world!').buffer,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'text/plain' }),
          arrayBuffer: async () => new TextEncoder().encode('Test content').buffer,
        } as Response);

      const items = [
        { inscriptionId: id1, expectedSha256: hash1 },
        { inscriptionId: id2, expectedSha256: hash2 },
      ];

      const results = await InscriptionVerifier.verifyBatch(items);

      expect(results.length).toBe(2);
      expect(results[0]?.valid).toBe(true);
      expect(results[1]?.valid).toBe(false); // Wrong hash
    });

    it('respects maxConcurrent parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        arrayBuffer: async () => new TextEncoder().encode('test').buffer,
      } as Response);

      const items = Array(10).fill(null).map((_, i) => ({
        inscriptionId: `${'a'.repeat(64)}i${i}`,
        expectedSha256: 'a' + 'b'.repeat(63)
      }));

      const results = await InscriptionVerifier.verifyBatch(items, 2);

      expect(results.length).toBe(10);
    });
  });
});

describe('Helper Functions', () => {
  describe('checkOrdinalsApiHealth', () => {
    it('returns true when API is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      const healthy = await checkOrdinalsApiHealth();
      expect(healthy).toBe(true);
    });

    it('returns false when API is down', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const healthy = await checkOrdinalsApiHealth();
      expect(healthy).toBe(false);
    });
  });

  describe('formatByteSize', () => {
    it('formats bytes correctly', () => {
      expect(formatByteSize(100)).toBe('100.00 B');
      expect(formatByteSize(1024)).toBe('1.00 KB');
      expect(formatByteSize(1048576)).toBe('1.00 MB');
      expect(formatByteSize(1073741824)).toBe('1.00 GB');
    });

    it('formats with decimals', () => {
      expect(formatByteSize(1536)).toBe('1.50 KB');
      expect(formatByteSize(2621440)).toBe('2.50 MB');
    });
  });

  describe('getContentCategory', () => {
    it('categorizes image types', () => {
      expect(getContentCategory('image/png')).toBe('image');
      expect(getContentCategory('image/jpeg')).toBe('image');
      expect(getContentCategory('image/avif')).toBe('image');
    });

    it('categorizes video types', () => {
      expect(getContentCategory('video/mp4')).toBe('video');
      expect(getContentCategory('video/webm')).toBe('video');
    });

    it('categorizes audio types', () => {
      expect(getContentCategory('audio/mpeg')).toBe('audio');
      expect(getContentCategory('audio/wav')).toBe('audio');
    });

    it('categorizes text types', () => {
      expect(getContentCategory('text/plain')).toBe('text');
      expect(getContentCategory('text/html')).toBe('text');
    });

    it('returns other for unknown types', () => {
      expect(getContentCategory('application/pdf')).toBe('other');
      expect(getContentCategory('unknown')).toBe('other');
    });
  });
});

