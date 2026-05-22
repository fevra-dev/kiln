import { buildBurnMemoTransaction } from '@/lib/local-burn/build-burn-memo-tx';
import {
  NotYetImplementedError,
  UnsupportedStandardError,
  NotAnNftError,
} from '@/lib/local-burn/errors';
import dasCnft from '../fixtures/das-cnft.json';
import dasCore from '../fixtures/das-core.json';
import dasFungible from '../fixtures/das-fungible.json';

const fetchMock = global.fetch as jest.Mock;
const RPC_URL = 'https://mock-rpc';
const OWNER = '11111111111111111111111111111111';
const INSCRIPTION = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';

function mockDasResponse(result: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ jsonrpc: '2.0', id: '1', result }),
  });
}

// Mock the getSlot fetch call that getWorkingRpcUrl triggers via Connection
function mockGetSlot() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ jsonrpc: '2.0', id: '1', result: 12345 }),
  });
}

describe('buildBurnMemoTransaction dispatcher', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('routes cnft to buildCnftBurn (no longer NotYetImplementedError)', async () => {
    // Mock the getSlot call (for getWorkingRpcUrl) + the getAsset call
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200, headers: new Headers(),
      json: async () => ({ jsonrpc: '2.0', id: '1', result: 12345 }),
    });
    mockDasResponse(dasCnft);
    // Don't mock the proof fetch — the cnft builder will fail to fetch proof or canopy.
    // The point is just that it ROUTES to the cnft builder, not throws NotYetImplementedError.

    await expect(
      buildBurnMemoTransaction({
        rpcUrl: RPC_URL,
        mint: 'cnft-test',
        owner: OWNER,
        inscriptionId: INSCRIPTION,
        priorityMicrolamports: 2000,
      })
    ).rejects.not.toBeInstanceOf(NotYetImplementedError);
  });

  it('throws NotYetImplementedError for core', async () => {
    mockGetSlot();
    mockDasResponse(dasCore);
    await expect(
      buildBurnMemoTransaction({
        rpcUrl: RPC_URL,
        mint: 'core-test',
        owner: OWNER,
        inscriptionId: INSCRIPTION,
        priorityMicrolamports: 2000,
      })
    ).rejects.toBeInstanceOf(NotYetImplementedError);
  });

  it('throws NotAnNftError for fungible tokens', async () => {
    mockGetSlot();
    mockDasResponse(dasFungible);
    await expect(
      buildBurnMemoTransaction({
        rpcUrl: RPC_URL,
        mint: 'usdc-test',
        owner: OWNER,
        inscriptionId: INSCRIPTION,
        priorityMicrolamports: 2000,
      })
    ).rejects.toBeInstanceOf(NotAnNftError);
  });

  it('throws UnsupportedStandardError for unknown interfaces', async () => {
    mockGetSlot();
    mockDasResponse({
      id: '11111111111111111111111111111112',
      interface: 'Custom',
      ownership: { owner: 'o', delegate: null, ownership_model: 'single' },
      content: { metadata: {} },
    });
    await expect(
      buildBurnMemoTransaction({
        rpcUrl: RPC_URL,
        mint: 'custom-test',
        owner: OWNER,
        inscriptionId: INSCRIPTION,
        priorityMicrolamports: 2000,
      })
    ).rejects.toBeInstanceOf(UnsupportedStandardError);
  });

  // Note: tests for the actual pnft/regular happy-path build are integration-level
  // (would require mocking Umi, Connection, blockhash fetch, etc.). Those are
  // verified manually via M1/M2 in the manual test plan (Task 7).
});
