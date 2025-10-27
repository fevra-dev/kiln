// src/app/api/rpc/route.ts
/**
 * RPC Proxy Endpoint
 * 
 * @description Proxies Solana RPC requests to hide API key from client-side.
 * This prevents API key exposure in browser DevTools and protects against abuse.
 * 
 * @security
 * - API key stored server-side only (no NEXT_PUBLIC_ prefix)
 * - Rate limiting recommended (see SECURITY_RECOMMENDATIONS.md)
 * - CORS restrictions applied
 * 
 * @version 0.1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Zod schema for Solana JSON-RPC request validation
 * 
 * Validates the standard JSON-RPC 2.0 format used by Solana
 */
const rpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.array(z.any()).optional(),
});

/**
 * POST handler: Proxy RPC requests to Solana
 * 
 * Forwards JSON-RPC requests to the configured Solana RPC endpoint
 * while keeping the API key secure on the server-side.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = rpcRequestSchema.parse(body);

    // Get server-side RPC URL (no NEXT_PUBLIC_ prefix)
    const rpcUrl = process.env.SOLANA_RPC_URL;

    if (!rpcUrl) {
      console.error('SOLANA_RPC_URL environment variable not configured');
      return NextResponse.json(
        { 
          jsonrpc: '2.0',
          id: validated.id,
          error: { 
            code: -32603, 
            message: 'RPC endpoint not configured' 
          } 
        },
        { status: 500 }
      );
    }

    // Forward request to Solana RPC
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validated),
    });

    // Check if RPC responded successfully
    if (!response.ok) {
      console.error(`RPC request failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: validated.id,
          error: {
            code: -32603,
            message: 'RPC request failed'
          }
        },
        { status: response.status }
      );
    }

    // Parse and return RPC response
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid JSON-RPC request',
            data: error.errors
          }
        },
        { status: 400 }
      );
    }

    // Handle other errors
    console.error('RPC proxy error:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : '*', // Will be restricted by CORS utility
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

