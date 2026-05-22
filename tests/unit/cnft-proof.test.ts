import { PublicKey } from '@solana/web3.js';
import { fetchAssetProof, sliceProof } from '@/lib/local-burn/cnft-proof';
import dasCnftProof from '../fixtures/das-cnft-proof.json';

const fetchMock = global.fetch as jest.Mock;
const RPC_URL = 'https://mock-rpc';

describe('cnft-proof', () => {
  beforeEach(() => fetchMock.mockReset());

  describe('fetchAssetProof', () => {
    it('returns the DAS proof for a cNFT', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ jsonrpc: '2.0', id: '1', result: dasCnftProof }),
      });

      const assetId = new PublicKey('11111111111111111111111111111112');
      const proof = await fetchAssetProof(assetId, RPC_URL);
      expect(proof.root).toBeDefined();
      expect(Array.isArray(proof.proof)).toBe(true);
      expect(proof.proof.length).toBeGreaterThan(0);
    });

    it('throws on DAS HTTP error', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({}) });
      const assetId = new PublicKey('11111111111111111111111111111112');
      await expect(fetchAssetProof(assetId, RPC_URL)).rejects.toThrow(/500/);
    });
  });

  describe('sliceProof', () => {
    it('slices off canopy nodes from the END of the proof', () => {
      const proof = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      // canopy depth 3 means top 3 nodes are stored on-chain
      const sliced = sliceProof(proof, 3);
      expect(sliced.length).toBe(5);
      expect(sliced).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('returns full proof when canopy depth is 0', () => {
      const proof = ['a', 'b', 'c', 'd'];
      expect(sliceProof(proof, 0)).toEqual(proof);
    });

    it('returns empty when canopy depth equals or exceeds proof length', () => {
      const proof = ['a', 'b', 'c'];
      expect(sliceProof(proof, 3)).toEqual([]);
      expect(sliceProof(proof, 5)).toEqual([]);
    });
  });
});
