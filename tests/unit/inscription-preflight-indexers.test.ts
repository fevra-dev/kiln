import { fetchFromOrdinals, fetchFromHiro } from '@/lib/inscription-preflight/indexers';

const VALID_ID = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';

// REAL ordinals.com /r/inscription/<id> shape (verified 2026-05-18):
//   height (not genesis_height), timestamp (unix-s, not genesis_block_time),
//   charms array encodes rarity + cursed (no dedicated rarity/cursed fields),
//   sat is a number, content_type + content_length present.
const ORDINALS_OK_BODY = {
  id: VALID_ID,
  number: 0,
  sat: 425639728,
  height: 875432,           // actual field name (plan assumed genesis_height)
  timestamp: 1764732009,    // actual field name (plan assumed genesis_block_time), unix-s
  content_type: 'image/png',
  content_length: 87234,
  charms: [],               // rarity encoded here as string entries e.g. ['uncommon']
  // no separate rarity or cursed boolean fields
  fee: 322,
  delegate: null,
  output: 'abc:0',
  satpoint: 'abc:0:0',
  value: 606,
  address: 'bc1pxxx',
};

// Hiro.so v1 API is HTTP 410 Gone (deprecated as of 2026).
// We keep the URL in the implementation so mock tests still validate
// the parsing logic against the documented (now-deprecated) JSON shape.
const HIRO_OK_BODY = {
  id: VALID_ID,
  sat_ordinal: '425639728',
  sat_rarity: 'uncommon',
  genesis_block_height: 875432,
  genesis_timestamp: 1764732009000, // hiro used unix-ms
  content_type: 'image/png',
  content_length: 87234,
  curse_type: null,
};

const fetchMock = global.fetch as jest.Mock;

function mockFetchSequence(
  ...responses: Array<{
    status: number;
    body: unknown;
    contentLength?: number;
    bytes?: Uint8Array;
  }>
) {
  fetchMock.mockReset();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: new Headers({
        'content-type':
          typeof r.body === 'object' ? 'application/json' : 'application/octet-stream',
        'content-length': String(
          r.contentLength ?? (r.bytes ? r.bytes.byteLength : 0),
        ),
      }),
      json: async () => r.body,
      arrayBuffer: async () => (r.bytes ?? new Uint8Array(0)).buffer,
      text: async () => JSON.stringify(r.body),
    });
  }
}

describe('fetchFromOrdinals', () => {
  it('returns ok result on 200 with valid JSON + content', async () => {
    mockFetchSequence(
      { status: 200, body: ORDINALS_OK_BODY },
      { status: 200, body: null, bytes: new Uint8Array([1, 2, 3]) },
    );
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.inscriptionId).toBe(VALID_ID);
      expect(result.data.confirmations).toBe(875440 - 875432 + 1);
      expect(result.data.contentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.data.sat).toBe(425639728);
      expect(result.source).toBe('ordinals.com');
    }
  });

  it('returns not_found on metadata 404', async () => {
    mockFetchSequence({ status: 404, body: { error: 'not found' } });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('not_found');
      expect(result.httpStatus).toBe(404);
    }
  });

  it('returns rate_limited on metadata 429', async () => {
    mockFetchSequence({ status: 429, body: {} });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('rate_limited');
  });

  it('returns error on 5xx', async () => {
    mockFetchSequence({ status: 502, body: {} });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('error');
  });

  it('returns error on malformed JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      json: async () => {
        throw new SyntaxError('not json');
      },
    });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('error');
  });

  it('returns content_length-only when content exceeds MAX_HASHABLE_BYTES', async () => {
    const bigSize = 6 * 1024 * 1024;
    mockFetchSequence({ status: 200, body: { ...ORDINALS_OK_BODY, content_length: bigSize } });
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contentSha256).toBeNull();
      expect(result.data.contentLength).toBe(bigSize);
    }
  });

  it('marks confirmations=0 for mempool (height null)', async () => {
    mockFetchSequence(
      { status: 200, body: { ...ORDINALS_OK_BODY, height: null } },
      { status: 200, body: null, bytes: new Uint8Array([1, 2, 3]) },
    );
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.confirmations).toBe(0);
      expect(result.data.genesisBlockHeight).toBeNull();
    }
  });

  it('derives cursed=true from charms array containing "cursed"', async () => {
    mockFetchSequence(
      { status: 200, body: { ...ORDINALS_OK_BODY, charms: ['cursed'] } },
      { status: 200, body: null, bytes: new Uint8Array([1, 2, 3]) },
    );
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cursed).toBe(true);
    }
  });

  it('derives satRarity from charms array containing rarity name', async () => {
    mockFetchSequence(
      { status: 200, body: { ...ORDINALS_OK_BODY, charms: ['uncommon'] } },
      { status: 200, body: null, bytes: new Uint8Array([1, 2, 3]) },
    );
    const result = await fetchFromOrdinals(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.satRarity).toBe('uncommon');
    }
  });
});

describe('fetchFromHiro', () => {
  it('returns ok result on 200', async () => {
    mockFetchSequence(
      { status: 200, body: HIRO_OK_BODY },
      { status: 200, body: null, bytes: new Uint8Array([1, 2, 3]) },
    );
    const result = await fetchFromHiro(VALID_ID, 875440);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('hiro.so');
      expect(result.data.confirmations).toBe(875440 - 875432 + 1);
    }
  });

  it('returns not_found on 404', async () => {
    mockFetchSequence({ status: 404, body: { error: 'not found' } });
    const result = await fetchFromHiro(VALID_ID, 875440);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('not_found');
  });
});
