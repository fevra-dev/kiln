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
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEmergencyShutdown } from '@/lib/emergency-shutdown';

const verifyRequestSchema = z.object({
  mint: z.string(),
  rpcUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check emergency shutdown first
    const shutdownResponse = checkEmergencyShutdown(request);
    if (shutdownResponse) return shutdownResponse;

    // Check rate limit (10 requests per minute - more lenient for read-only)
    const rateLimitResult = await checkRateLimit(request, {
      maxRequests: 10,
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
    
    // Search for KILN memos in recent transaction history
    let inscriptionId: string | undefined;
    let sha256: string | undefined;
    let teleburnTimestamp: number | undefined;
    let sealSignature: string | undefined;
    let burnSignature: string | undefined;
    const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    
    try {
      // Get recent signatures for the mint
      const signatures = await connection.getSignaturesForAddress(mint, { limit: 50 });
      
      for (const sigInfo of signatures) {
        try {
          const tx = await connection.getTransaction(sigInfo.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });
          
          if (!tx || !tx.transaction) continue;
          
          // Check for memo instructions (handle both legacy and versioned)
          let instructions: Array<{ programId?: PublicKey | string; data?: Uint8Array | string; [key: string]: unknown }> = [];
          
          // Handle legacy transactions - message has instructions directly
          const message = tx.transaction.message;
          if ('instructions' in message && Array.isArray(message.instructions)) {
            instructions = message.instructions as typeof instructions;
          } 
          // Handle versioned transactions - need to use decompile or skip for now
          // Versioned transactions require lookup tables which we'd need to fetch
          // For now, we'll skip parsing versioned transactions' instructions
          // (Most teleburn memos will be in legacy transactions anyway)
          
          for (const instruction of instructions) {
            let programId: PublicKey | null = null;
            
            // Legacy instruction format - programId is a PublicKey
            if ('programId' in instruction && instruction.programId !== undefined && instruction.programId !== null) {
              if (instruction.programId instanceof PublicKey) {
                programId = instruction.programId;
              } else if (typeof instruction.programId === 'string') {
                programId = new PublicKey(instruction.programId);
              } else if ('toBase58' in instruction.programId && typeof instruction.programId === 'object') {
                programId = new PublicKey(instruction.programId as PublicKey | string);
              }
            }
            
            if (programId && programId.equals(MEMO_PROGRAM_ID)) {
              try {
                // Get memo data - handle both legacy (direct data) and versioned (accountKeys + data)
                let memoBytes: Uint8Array | Buffer;
                if ('data' in instruction && instruction.data) {
                  memoBytes = instruction.data instanceof Uint8Array 
                    ? instruction.data 
                    : Buffer.from(instruction.data, 'base64');
                } else if ('data' in instruction && typeof instruction.data === 'string') {
                  memoBytes = Buffer.from(instruction.data, 'base64');
                } else {
                  continue;
                }
                
                const memoData = new TextDecoder().decode(memoBytes);
                const memoJson = JSON.parse(memoData);
                
                // Check if it's a Kiln memo (support both 'KILN' and 'Kiln' for backward compatibility)
                if ((memoJson.standard === 'Kiln' || memoJson.standard === 'KILN') && memoJson.solana?.mint === validated.mint) {
                  if ((memoJson.action === 'teleburn-seal' || memoJson.action === 'seal') && memoJson.inscription?.id) {
                    inscriptionId = memoJson.inscription.id;
                    sha256 = memoJson.media?.sha256;
                    sealSignature = sigInfo.signature;
                  } else if (
                    // Check for teleburn actions (new inline format and old formats)
                    (memoJson.action === 'teleburn' || 
                     memoJson.action === 'teleburn-burn' || memoJson.action === 'teleburn-incinerate' || memoJson.action === 'teleburn-derived' ||
                     memoJson.action === 'burn' || memoJson.action === 'incinerate' || memoJson.action === 'retire')
                    && memoJson.inscription?.id
                  ) {
                    inscriptionId = inscriptionId || memoJson.inscription.id;
                    sha256 = sha256 || memoJson.media?.sha256;
                    // Extract timestamp from memo (preferred) or use transaction blockTime
                    if (memoJson.timestamp) {
                      teleburnTimestamp = typeof memoJson.timestamp === 'number' ? memoJson.timestamp : parseInt(memoJson.timestamp, 10);
                    } else if (tx.blockTime) {
                      teleburnTimestamp = tx.blockTime;
                    }
                    burnSignature = sigInfo.signature;
                  }
                }
              } catch {
                // Not JSON or not a KILN memo, continue
              }
            }
          }
        } catch {
          // Skip transactions that fail to parse
          continue;
        }
      }
    } catch (error) {
      console.warn('Failed to search for KILN memos:', error);
    }
    
    // Determine status based on supply
    let status = 'unknown';
    let confidence = 'low';
    let message = '';

    if (supply === '0') {
      status = 'burned';
      confidence = 'high';
      message = 'NFT has been completely burned (supply = 0)';
      if (inscriptionId) {
        message += ` • Linked to Bitcoin inscription ${inscriptionId.slice(0, 16)}...`;
      }
    } else {
      status = 'active';
      confidence = 'high';
      message = `NFT is still active (supply: ${supply})`;
      if (inscriptionId) {
        message += ` • Linked to Bitcoin inscription ${inscriptionId.slice(0, 16)}...`;
      }
    }

    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json(
      {
        success: true,
        status,
        mint: validated.mint,
        supply: supply,
        decimals: decimals,
        confidence,
        message,
        inscriptionId,
        sha256,
        teleburnTimestamp,
        sealSignature,
        burnSignature,
        metadata: {
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

