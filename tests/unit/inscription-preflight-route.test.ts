import { GET } from '@/app/api/inscription/preflight/route';
import { __resetCacheForTests } from '@/lib/inscription-preflight';
import { NextRequest } from 'next/server';

const VALID_ID = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';
const TEST_GENESIS_HEIGHT = 767_430;

const fetchMock = global.fetch as jest.Mock;

function setupMinimalSuccessFlow() {
  // tip height
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => '875440',
  });
  // ordinals metadata
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({
      id: VALID_ID,
      sat: 1252201400444387,
      height: TEST_GENESIS_HEIGHT,
      timestamp: 1671049920,
      content_type: 'image/png',
      content_length: 3,
      charms: ['uncommon'],
    }),
  });
  // ordinals content
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/png', 'content-length': '3' }),
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });
}

describe('GET /api/inscription/preflight', () => {
  beforeEach(() => {
    __resetCacheForTests();
    fetchMock.mockReset();
  });

  it('returns 400 on missing id param', async () => {
    const req = new NextRequest('http://localhost/api/inscription/preflight');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });

  it('returns 400 on invalid id format', async () => {
    const req = new NextRequest('http://localhost/api/inscription/preflight?id=not-real');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it('returns 200 with success response on valid id', async () => {
    setupMinimalSuccessFlow();
    const req = new NextRequest(`http://localhost/api/inscription/preflight?id=${VALID_ID}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(true);
    expect(body.inscriptionId).toBe(VALID_ID);
    expect(body.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normalizes uppercase ID to lowercase in response', async () => {
    setupMinimalSuccessFlow();
    const upper = VALID_ID.toUpperCase();
    const req = new NextRequest(`http://localhost/api/inscription/preflight?id=${upper}`);
    const res = await GET(req);
    const body = await res.json();
    expect(body.inscriptionId).toBe(VALID_ID);
  });
});
