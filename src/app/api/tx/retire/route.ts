// src/app/api/tx/retire/route.ts
/**
 * API Route: POST /api/tx/retire
 * 
 * Builds a RETIRE transaction for KILN.1 protocol.
 * Permanently retires Solana token via:
 * - burn: Reduce supply to 0
 * - incinerate: Send to provably unspendable address
 * - teleburn-derived: Send to hardened derived owner
 * 
 * Includes retire memo with timestamp and block height.
 * 
 * Safety: Transaction is built but NOT signed or broadcast.
 * User must sign in their wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { createTransactionBuilder, TeleburnMethod } from '@/lib/transaction-builder';
import { retireRequestSchema } from '@/lib/schemas';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';
import type { PriorityFeeConfig } from '@/lib/transaction-utils';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEmergencyShutdown } from '@/lib/emergency-shutdown';

/**
 * POST handler: Build retire transaction
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
          status: 429,
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
    const validated = retireRequestSchema.parse(body);

    // Get RPC URL from environment or use default
    const rpcUrl = process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com';

    // Parse public keys
    const payer = new PublicKey(validated.payer);
    const owner = new PublicKey(validated.owner);
    const mint = new PublicKey(validated.mint);

    // Parse amount (default to 1 for NFTs)
    const amount = validated.amount ? BigInt(validated.amount) : 1n;

    // Validate method
    const method = validated.method as TeleburnMethod;
    if (!['burn', 'incinerate', 'teleburn-derived'].includes(method)) {
      throw new Error(`Invalid method: ${method}`);
    }

    // Create transaction builder
    const builder = createTransactionBuilder(rpcUrl);

    // Build priority fee config if provided
    const priorityFee: PriorityFeeConfig | undefined = validated.priorityMicrolamports !== undefined || validated.computeUnits !== undefined
      ? {
          microlamports: validated.priorityMicrolamports,
          computeUnits: validated.computeUnits,
        }
      : undefined;

    // Build retire transaction
    const result = await builder.buildRetireTransaction({
      payer,
      owner,
      mint,
      inscriptionId: validated.inscriptionId,
      method,
      amount,
      rpcUrl,
      priorityFee,
    });

    // Serialize transaction for client
    const serialized = result.transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Return transaction + metadata with CORS and rate limit headers
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json(
      {
        success: true,
        transaction: Buffer.from(serialized).toString('base64'),
        description: result.description,
        estimatedFee: result.estimatedFee,
        estimatedFeeSol: result.estimatedFee / 1e9,
        metadata: {
          action: 'retire',
          method,
          mint: validated.mint,
          inscriptionId: validated.inscriptionId,
          amount: amount.toString(),
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
    console.error('Retire transaction build error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build retire transaction',
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

