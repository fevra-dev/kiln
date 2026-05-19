import { detectAssetKind } from '@/lib/local-burn/detect';
import { NotAnNftError } from '@/lib/local-burn/errors';
import dasRegular from '../fixtures/das-regular-nft.json';
import dasPnft from '../fixtures/das-pnft.json';
import dasCnft from '../fixtures/das-cnft.json';
import dasCore from '../fixtures/das-core.json';
import dasFungible from '../fixtures/das-fungible.json';

const fetchMock = global.fetch as jest.Mock;
const RPC_URL = 'https://mock-rpc';

function mockDasResponse(result: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ jsonrpc: '2.0', id: '1', result }),
  });
}

describe('detectAssetKind', () => {
  beforeEach(() => fetchMock.mockReset());

  it('classifies regular NFT (interface: V1_NFT)', async () => {
    mockDasResponse(dasRegular);
    const out = await detectAssetKind('test-mint', RPC_URL);
    expect(out.kind.kind).toBe('regular');
  });

  it('classifies pNFT (interface: ProgrammableNFT)', async () => {
    mockDasResponse(dasPnft);
    const out = await detectAssetKind('test-mint', RPC_URL);
    expect(out.kind.kind).toBe('pnft');
  });

  it('classifies cNFT and extracts tree/leaf/hashes', async () => {
    mockDasResponse(dasCnft);
    const out = await detectAssetKind('test-asset-id', RPC_URL);
    expect(out.kind.kind).toBe('cnft');
    if (out.kind.kind === 'cnft') {
      expect(out.kind.tree.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(out.kind.leafIndex).toBeGreaterThanOrEqual(0);
      expect(out.kind.dataHash).toMatch(/^[0-9a-fA-F]+$/);
      expect(out.kind.creatorHash).toMatch(/^[0-9a-fA-F]+$/);
    }
  });

  it('classifies Core asset (interface: MplCoreAsset)', async () => {
    mockDasResponse(dasCore);
    const out = await detectAssetKind('test-asset-id', RPC_URL);
    expect(out.kind.kind).toBe('core');
  });

  it('throws NotAnNftError for fungible tokens', async () => {
    mockDasResponse(dasFungible);
    await expect(detectAssetKind('test-mint', RPC_URL)).rejects.toBeInstanceOf(NotAnNftError);
  });

  it('returns "unknown" for unrecognized DAS interface', async () => {
    mockDasResponse({
      id: 'x',
      interface: 'Custom',
      ownership: { owner: 'o', delegate: null, ownership_model: 'single' },
      content: { metadata: {} },
    });
    const out = await detectAssetKind('test-id', RPC_URL);
    expect(out.kind.kind).toBe('unknown');
    if (out.kind.kind === 'unknown') {
      expect(out.kind.daInterface).toBe('Custom');
    }
  });

  it('returns the normalized DAS asset alongside the kind', async () => {
    mockDasResponse(dasRegular);
    const out = await detectAssetKind('test-mint', RPC_URL);
    expect(out.asset.id).toBeDefined();
    expect(out.asset.interface).toBeDefined();
    expect(out.asset.ownership).toBeDefined();
  });

  it('throws AssetNotFoundError when DAS returns null result', async () => {
    mockDasResponse(null);
    await expect(detectAssetKind('missing-mint', RPC_URL)).rejects.toThrow(/not found/i);
  });
});
