// src/app/api/tx/update-metadata/route.ts
/**
 * API Route: POST /api/tx/update-metadata
 * 
 * Builds a transaction to update NFT metadata URI to point to Ordinals inscription.
 * This is an optional step after teleburn completion.
 * 
 * Safety: Transaction is built but NOT signed or broadcast.
 * User must sign in their wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';
import { buildUpdateMetadataToOrdinalsTransaction } from '@/lib/local-burn/update-metadata';

/**
 * Request schema for metadata update transaction
 */
const updateMetadataRequestSchema = z.object({
  mint: z.string(),
  updateAuthority: z.string(),
  inscriptionId: z.string(),
  priorityMicrolamports: z.number().optional().default(2_000),
});

/**
 * POST handler: Build metadata update transaction
 */
export async function POST(request: NextRequest) {
  try {
    // Check CORS origin
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { success: false, error: 'Origin not allowed' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = updateMetadataRequestSchema.parse(body);

    // Get RPC URL from environment or use default
    const rpcUrl = process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com';

    // Build the metadata update transaction
    const result = await buildUpdateMetadataToOrdinalsTransaction(
      rpcUrl,
      validated.mint,
      validated.updateAuthority,
      validated.inscriptionId,
      validated.priorityMicrolamports
    );

    // Return transaction + metadata with CORS headers
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json({
      success: true,
      transaction: result.transaction, // base64 serialized transaction
      isVersioned: result.isVersioned,
      ordinalsUrl: result.ordinalsUrl,
      description: `UPDATE METADATA: Point NFT image to Ordinals inscription`,
      metadata: {
        action: 'update-metadata',
        mint: validated.mint,
        inscriptionId: validated.inscriptionId,
        ordinalsUrl: result.ordinalsUrl,
        timestamp: new Date().toISOString(),
      },
    }, { headers: corsHeaders });

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
    console.error('Metadata update transaction build error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build metadata update transaction',
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

