/**
 * Mock Next.js server modules for testing
 */

// Mock NextRequest
export class NextRequest {
  constructor(input, init) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers || {});
    this.body = init?.body;
    this.ip = init?.ip || '127.0.0.1';
  }

  json() {
    return Promise.resolve(JSON.parse(this.body || '{}'));
  }
}

// Mock NextResponse
export class NextResponse {
  constructor(body, init) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Headers(init?.headers || {});
    this.statusText = init?.statusText || 'OK';
  }

  static json(body, init) {
    return new NextResponse(JSON.stringify(body), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  }

  static redirect(url, status = 307) {
    return new NextResponse(null, {
      status,
      headers: {
        Location: url,
      },
    });
  }

  json() {
    return Promise.resolve(JSON.parse(this.body || '{}'));
  }
}

