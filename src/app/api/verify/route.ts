// src/app/api/verify/route.ts
/**
 * API Route: POST /api/verify
 * 
 * Verifies teleburn status for a given Solana mint.
 * Returns comprehensive status with confidence scoring.
 * 
 * @description Public verification endpoint
 * @version 0.1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';

const verifyRequestSchema = z.object({
  mint: z.string(),
  rpcUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check CORS origin
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { success: false, error: 'Origin not allowed' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = verifyRequestSchema.parse(body);

    const rpcUrl = validated.rpcUrl || process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const mint = new PublicKey(validated.mint);

    // Get mint info
    const mintInfo = await connection.getAccountInfo(mint);
    
    if (!mintInfo) {
      return NextResponse.json({
        success: false,
        error: 'Mint not found',
      }, { status: 404 });
    }

    // Check if mint account exists and get supply
    const mintAccount = await connection.getParsedAccountInfo(mint);
    
    if (!mintAccount.value) {
      return NextResponse.json({
        success: false,
        error: 'Mint account not found',
      }, { status: 404 });
    }

    const mintData = mintAccount.value.data as { parsed: { info: { supply: string; decimals: number } } };
    const supply = mintData.parsed.info.supply;
    const decimals = mintData.parsed.info.decimals;
    
    // Determine status based on supply
    let status = 'unknown';
    let confidence = 'low';
    let message = '';

    if (supply === '0') {
      status = 'burned';
      confidence = 'high';
      message = 'NFT has been completely burned (supply = 0)';
    } else {
      status = 'active';
      confidence = 'high';
      message = `NFT is still active (supply: ${supply})`;
    }

    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json({
      success: true,
      status,
      mint: validated.mint,
      supply: supply,
      decimals: decimals,
      confidence,
      message,
    }, { headers: corsHeaders });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      }, { status: 400 });
    }

    console.error('Verification error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

