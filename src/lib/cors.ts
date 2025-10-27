/**
 * CORS (Cross-Origin Resource Sharing) Utility
 * 
 * @description Provides secure CORS headers with origin whitelisting.
 * Prevents unauthorized cross-origin requests to API routes.
 * 
 * @security
 * - Whitelist-based origin validation
 * - Development/production environment handling
 * - Rejects requests from non-whitelisted origins
 * 
 * @version 0.1.1
 */

/**
 * Get CORS headers for a request
 * 
 * Validates the request origin against a whitelist and returns
 * appropriate CORS headers. Rejects requests from non-whitelisted origins.
 * 
 * @param request - Incoming HTTP request
 * @returns CORS headers object (empty if origin not allowed)
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const corsHeaders = getCorsHeaders(request);
 *   
 *   if (Object.keys(corsHeaders).length === 0) {
 *     return NextResponse.json(
 *       { error: 'Origin not allowed' },
 *       { status: 403 }
 *     );
 *   }
 *   
 *   // ... your logic
 *   
 *   return NextResponse.json(data, { headers: corsHeaders });
 * }
 * ```
 */
export function getCorsHeaders(request: Request): HeadersInit {
  // Define allowed origins
  const allowedOrigins = [
    // Production domains (update these with your actual domains)
    'https://yourdomain.com',
    'https://app.yourdomain.com',
    'https://www.yourdomain.com',
    
    // Development - allow localhost
    ...(process.env.NODE_ENV === 'development' 
      ? [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
        ] 
      : []
    ),
  ];

  // Get request origin
  const origin = request.headers.get('origin');

  // If no origin header (same-origin request), allow it
  if (!origin) {
    return {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }

  // Check if origin is whitelisted
  if (allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  // Origin not allowed - return empty headers
  // API route should check for this and return 403
  return {};
}

/**
 * Check if a request origin is allowed
 * 
 * @param request - Incoming HTTP request
 * @returns true if origin is allowed, false otherwise
 * 
 * @example
 * ```typescript
 * if (!isOriginAllowed(request)) {
 *   return NextResponse.json(
 *     { error: 'Origin not allowed' },
 *     { status: 403 }
 *   );
 * }
 * ```
 */
export function isOriginAllowed(request: Request): boolean {
  const corsHeaders = getCorsHeaders(request);
  return Object.keys(corsHeaders).length > 0;
}

/**
 * Create a CORS-enabled response
 * 
 * Helper function to create a NextResponse with CORS headers applied.
 * 
 * @param data - Response data
 * @param request - Incoming HTTP request
 * @param init - Additional response init options
 * @returns NextResponse with CORS headers
 * 
 * @example
 * ```typescript
 * import { NextResponse } from 'next/server';
 * 
 * export async function POST(request: NextRequest) {
 *   const data = { success: true };
 *   return createCorsResponse(data, request);
 * }
 * ```
 */
export function createCorsResponse(
  data: unknown,
  request: Request,
  init?: ResponseInit
): Response {
  const corsHeaders = getCorsHeaders(request);
  
  // If origin not allowed, return 403
  if (Object.keys(corsHeaders).length === 0 && request.headers.get('origin')) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Merge CORS headers with any provided headers
  const headers = new Headers(init?.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value as string);
  });
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

/**
 * Get allowed origins list (for debugging/logging)
 * 
 * @returns Array of allowed origin strings
 */
export function getAllowedOrigins(): string[] {
  return [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
    'https://www.yourdomain.com',
    ...(process.env.NODE_ENV === 'development' 
      ? [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
        ] 
      : []
    ),
  ];
}

