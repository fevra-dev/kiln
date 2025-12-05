// src/app/api/tx/burn-memo/route.ts
/**
 * API Route: POST /api/tx/burn-memo
 * 
 * Builds a SINGLE transaction that combines:
 * 1. Burn instruction (Metaplex burnV1 - handles both pNFT and regular NFT)
 * 2. SPL Memo instruction with Kiln teleburn proof
 * 
 * This eliminates the need for separate seal/retire/memo transactions.
 * The transaction is built but NOT signed or broadcast.
 * User must sign in their wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';
import { buildBurnMemoTransaction } from '@/lib/local-burn/build-burn-memo-tx';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEmergencyShutdown } from '@/lib/emergency-shutdown';

/**
 * Request schema for burn+memo transaction
 */
const burnMemoRequestSchema = z.object({
  mint: z.string(),
  owner: z.string(),
  inscriptionId: z.string(),
  priorityMicrolamports: z.number().optional().default(2_000),
});

/**
 * POST handler: Build burn+memo transaction
 */
export async function POST(request: NextRequest) {
  try {
    // Check emergency shutdown first
    const shutdownResponse = checkEmergencyShutdown(request);
    if (shutdownResponse) return shutdownResponse;

    // Check rate limit (5 requests per minute)
    const rateLimitResult = await checkRateLimit(request, {
      maxRequests: 5,
      windowMs: 60000, // 1 minute
    });

    if (!rateLimitResult.allowed) {
      const corsHeaders = getCorsHeaders(request);
      return NextResponse.json(
        {
          success: false,
          error: rateLimitResult.error || 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        {
          status: 429, // Too Many Requests
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      );
    }

    // Check CORS origin
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { success: false, error: 'Origin not allowed' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = burnMemoRequestSchema.parse(body);

    // Get RPC URL from environment or use default
    const rpcUrl = process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com';

    // Build the burn+memo transaction
    const result = await buildBurnMemoTransaction(
      rpcUrl,
      validated.mint,
      validated.owner,
      validated.inscriptionId,
      validated.priorityMicrolamports
    );

    // Return transaction + metadata with CORS and rate limit headers
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json(
      {
        success: true,
        transaction: result.transaction, // base64 serialized transaction
        isVersioned: result.isVersioned,
        nftType: result.nftType,
        description: `BURN + MEMO: Burn ${result.nftType} and record teleburn proof in single transaction`,
        metadata: {
          action: 'burn-memo',
          mint: validated.mint,
          inscriptionId: validated.inscriptionId,
          nftType: result.nftType,
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          ...corsHeaders,
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    );

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    console.error('Burn+memo transaction build error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build burn+memo transaction',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

