import { preflight, __resetCacheForTests } from '@/lib/inscription-preflight';

const VALID_ID = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';
const TIP_HEIGHT = 875_440;
const TEST_GENESIS_HEIGHT = 767_430; // matches ordinalswallet sample inscription

const fetchMock = global.fetch as jest.Mock;

// --- mock helpers ---------------------------------------------------------

function setupTipHeightFetch(height: number = TIP_HEIGHT) {
  fetchMock.mockImplementationOnce(async (url: string) => {
    if (typeof url === 'string' && url.includes('mempool.space')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => String(height),
      };
    }
    throw new Error(`Unexpected URL on tip fetch: ${url}`);
  });
}

function setupOrdinalsOk(opts: { height?: number | null; bytes?: Uint8Array; contentLength?: number } = {}) {
  // ordinals.com path: TWO fetches (metadata + content)
  fetchMock.mockImplementationOnce(async (url: string) => {
    if (url.startsWith('https://ordinals.com/r/inscription/')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: VALID_ID,
          sat: 1252201400444387,
          height: opts.height === undefined ? TEST_GENESIS_HEIGHT : opts.height,
          timestamp: 1671049920,
          content_type: 'image/png',
          content_length: opts.contentLength ?? 3,
          charms: ['uncommon'],
        }),
      };
    }
    throw new Error(`Unexpected URL on ordinals metadata: ${url}`);
  });
  fetchMock.mockImplementationOnce(async (url: string) => {
    if (url.startsWith('https://ordinals.com/content/')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png', 'content-length': String(opts.bytes?.byteLength ?? 3) }),
        arrayBuffer: async () => (opts.bytes ?? new Uint8Array([1, 2, 3])).buffer,
      };
    }
    throw new Error(`Unexpected URL on ordinals content: ${url}`);
  });
}

function setupOrdinals404() {
  fetchMock.mockImplementationOnce(async () => ({
    ok: false,
    status: 404,
    headers: new Headers(),
    json: async () => ({ error: 'not found' }),
  }));
}

function setupOrdinalsWalletOk() {
  // ordinalswallet path: ONE fetch (metadata only, no content endpoint)
  fetchMock.mockImplementationOnce(async (url: string) => {
    if (typeof url === 'string' && url.includes('ordinalswallet')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: VALID_ID,
          content_length: 793,
          content_type: 'image/png',
          created: 1671049920,
          genesis_height: TEST_GENESIS_HEIGHT,
          sat: 1252201400444387,
          charms: ['uncommon'],
        }),
      };
    }
    throw new Error(`Unexpected URL on ordinalswallet metadata: ${url}`);
  });
}

function setupOrdinalsWallet404() {
  fetchMock.mockImplementationOnce(async () => ({
    ok: false,
    status: 404,
    headers: new Headers(),
    json: async () => ({ error: 'not found' }),
  }));
}

// --- tests ----------------------------------------------------------------

describe('preflight()', () => {
  beforeEach(() => {
    __resetCacheForTests();
    fetchMock.mockReset();
  });

  it('rejects invalid inscription ID format', async () => {
    await expect(preflight('not-an-inscription')).rejects.toThrow(/invalid inscription id format/i);
  });

  it('normalizes mixed-case input to lowercase', async () => {
    setupTipHeightFetch();
    setupOrdinalsOk();
    const upperId = VALID_ID.toUpperCase();
    const result = await preflight(upperId);
    expect(result.inscriptionId).toBe(VALID_ID);
  });

  it('returns success with confirmations on ordinals.com 200', async () => {
    setupTipHeightFetch();
    setupOrdinalsOk();
    const result = await preflight(VALID_ID);
    expect(result.exists).toBe(true);
    if (result.exists) {
      expect(result.confirmations).toBe(TIP_HEIGHT - TEST_GENESIS_HEIGHT + 1);
      expect(result.indexerUsed).toBe('ordinals.com');
      expect(result.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('falls back to ordinalswallet on ordinals 404', async () => {
    setupTipHeightFetch();
    setupOrdinals404();
    setupOrdinalsWalletOk();
    const result = await preflight(VALID_ID);
    expect(result.exists).toBe(true);
    if (result.exists) {
      expect(result.indexerUsed).toBe('ordinalswallet');
      // ordinalswallet skips content fetch → no SHA-256
      expect(result.contentSha256).toBeNull();
    }
  });

  it('returns not_found when both indexers 404', async () => {
    setupTipHeightFetch();
    setupOrdinals404();
    setupOrdinalsWallet404();
    const result = await preflight(VALID_ID);
    expect(result.exists).toBe(false);
    if (!result.exists) {
      expect(result.reason).toBe('not_found');
      expect(result.indexersChecked).toHaveLength(2);
    }
  });

  it('returns all_unreachable on network errors from both indexers', async () => {
    setupTipHeightFetch();
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const result = await preflight(VALID_ID);
    expect(result.exists).toBe(false);
    if (!result.exists) expect(result.reason).toBe('all_unreachable');
  });

  it('caches successful results indefinitely when confirmations >= 6', async () => {
    setupTipHeightFetch();
    setupOrdinalsOk();
    await preflight(VALID_ID);

    // Second call should hit cache; no new fetches.
    const before = fetchMock.mock.calls.length;
    const result2 = await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBe(before);
    if (result2.exists) expect(result2.cached).toBe(true);
  });

  it('caches successful results 30s when confirmations < 6', async () => {
    jest.useFakeTimers();
    setupTipHeightFetch();
    setupOrdinalsOk({ height: TIP_HEIGHT - 1 }); // 2 confirmations

    await preflight(VALID_ID);
    jest.advanceTimersByTime(35_000);

    // Cache should be expired; should re-fetch.
    setupTipHeightFetch();
    setupOrdinalsOk({ height: TIP_HEIGHT - 1 });
    const callsBefore = fetchMock.mock.calls.length;
    await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    jest.useRealTimers();
  });

  it('caches not_found for 30s', async () => {
    jest.useFakeTimers();
    setupTipHeightFetch();
    setupOrdinals404();
    setupOrdinalsWallet404();
    await preflight(VALID_ID);

    // Within 30s, second call hits cache (no fetch).
    const before = fetchMock.mock.calls.length;
    await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBe(before);

    // After 35s, cache expired, retries.
    jest.advanceTimersByTime(35_000);
    setupTipHeightFetch();
    setupOrdinals404();
    setupOrdinalsWallet404();
    await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    jest.useRealTimers();
  });

  it('caches all_unreachable for 5s', async () => {
    jest.useFakeTimers();
    setupTipHeightFetch();
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await preflight(VALID_ID);

    // Within 5s, cache hit (no new fetches).
    const before = fetchMock.mock.calls.length;
    await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBe(before);

    // After 6s, cache should be expired.
    jest.advanceTimersByTime(6_000);
    setupTipHeightFetch();
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await preflight(VALID_ID);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    jest.useRealTimers();
  });
});
