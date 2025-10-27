// src/app/api/tx/decode/route.ts
/**
 * API Route: POST /api/tx/decode
 * 
 * Decodes a Solana transaction into human-readable format.
 * Shows:
 * - Program invocations
 * - Account roles (signer, writable, readonly)
 * - Instruction data
 * - Fee estimation
 * 
 * Used for dry run mode and user transparency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Transaction } from '@solana/web3.js';
import { z } from 'zod';
import { createTransactionDecoder } from '@/lib/transaction-decoder';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';

/**
 * Request schema
 */
const decodeRequestSchema = z.object({
  transaction: z.string().describe('Base64-encoded serialized transaction'),
  rpcUrl: z.string().url().optional(),
});

/**
 * POST handler: Decode transaction
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
    const validated = decodeRequestSchema.parse(body);

    // Get RPC URL
    const rpcUrl = validated.rpcUrl || process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com';

    // Deserialize transaction
    const transactionBuffer = Buffer.from(validated.transaction, 'base64');
    const transaction = Transaction.from(transactionBuffer);

    // Create decoder
    const decoder = createTransactionDecoder(rpcUrl);

    // Decode transaction
    const decoded = await decoder.decodeTransaction(transaction);

    // Return decoded transaction with CORS headers
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json({
      success: true,
      decoded,
      metadata: {
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
    console.error('Transaction decode error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to decode transaction',
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

