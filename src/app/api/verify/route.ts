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
    // Try both TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID
    const mintAccount = await connection.getParsedAccountInfo(mint);
    
    if (!mintAccount.value) {
      return NextResponse.json({
        success: false,
        error: 'Mint account not found',
      }, { status: 404 });
    }

    // Safely parse mint data - handle both parsed and raw account formats
    let supply = '0';
    let decimals = 0;
    
    const accountData = mintAccount.value.data;
    
    // Check if this is a parsed SPL token mint account (works for both TOKEN and TOKEN_2022)
    if (typeof accountData === 'object' && accountData !== null && 'parsed' in accountData) {
      const parsedData = accountData as { parsed?: { info?: { supply?: string; decimals?: number }; type?: string } };
      
      // Verify it's a mint account type
      if (parsedData.parsed?.type === 'mint' && parsedData.parsed?.info) {
        supply = parsedData.parsed.info.supply || '0';
        decimals = parsedData.parsed.info.decimals || 0;
      } else {
        // Not a mint account - could be a token account or other type
        return NextResponse.json({
          success: false,
          error: `Invalid account type. Expected 'mint' but got '${parsedData.parsed?.type || 'unknown'}'. Please provide a valid NFT mint address.`,
        }, { status: 400 });
      }
    } else if (Buffer.isBuffer(accountData) || (accountData && typeof accountData !== 'string' && 'byteLength' in accountData)) {
      // Raw buffer data - try to manually decode mint layout
      // SPL Token Mint layout: 36 bytes mintAuthority + 8 bytes supply + 1 byte decimals + ...
      // Token-2022 has similar layout at the start
      try {
        const data = Buffer.from(accountData as Buffer);
        if (data.length >= 45) {
          // Supply is at offset 36, 8 bytes little-endian
          const supplyBigInt = data.readBigUInt64LE(36);
          supply = supplyBigInt.toString();
          // Decimals is at offset 44, 1 byte
          decimals = data.readUInt8(44);
        } else {
          return NextResponse.json({
            success: false,
            error: 'Account data too short to be a valid mint. Please provide a valid NFT mint address.',
          }, { status: 400 });
        }
      } catch (parseError) {
        console.error('Failed to parse raw mint data:', parseError);
        return NextResponse.json({
          success: false,
          error: 'Failed to parse mint account data. Please provide a valid NFT mint address.',
        }, { status: 400 });
      }
    } else {
      // Unknown data format
      return NextResponse.json({
        success: false,
        error: 'Unknown account data format. Please provide a valid NFT mint address.',
      }, { status: 400 });
    }
    
    // Search for KILN memos in recent transaction history
    let inscriptionId: string | undefined;
    let sha256: string | undefined;
    let teleburnTimestamp: number | undefined;
    let sealSignature: string | undefined;
    let burnSignature: string | undefined;
    let kilnMemo: Record<string, unknown> | undefined; // Full Kiln memo object
    let blockTime: number | undefined; // On-chain transaction timestamp
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
          
          // Method 1: Check transaction logs for memo program invocations
          // This works for BOTH legacy and versioned transactions
          const logs = tx.meta?.logMessages || [];
          for (const log of logs) {
            // Memo program logs the memo content directly
            if (log.includes('Program log: Memo') || log.includes('Program data:')) {
              continue; // Skip program metadata logs
            }
            
            // Look for JSON-like content in logs that might be memo data
            if (log.includes('"standard":"Kiln"') || log.includes('"standard": "Kiln"')) {
              try {
                // Extract JSON from log
                const jsonMatch = log.match(/\{.*"standard".*"Kiln".*\}/);
                if (jsonMatch) {
                  const memoJson = JSON.parse(jsonMatch[0]);
                  if (memoJson.solana?.mint === validated.mint) {
                    inscriptionId = memoJson.inscription?.id;
                    sha256 = memoJson.media?.sha256;
                    kilnMemo = memoJson;
                    blockTime = tx.blockTime || undefined;
                    teleburnTimestamp = memoJson.timestamp || tx.blockTime;
                    burnSignature = sigInfo.signature;
                  }
                }
              } catch {
                // Not valid JSON, continue
              }
            }
          }
          
          // Method 2: For versioned transactions, decode compiled instructions
          // Get account keys from the transaction
          const message = tx.transaction.message;
          const accountKeys: PublicKey[] = [];
          
          // Handle versioned message with staticAccountKeys
          if ('staticAccountKeys' in message) {
            accountKeys.push(...message.staticAccountKeys);
          }
          // Handle legacy message with accountKeys
          if ('accountKeys' in message && Array.isArray(message.accountKeys)) {
            for (const key of message.accountKeys) {
              if (key instanceof PublicKey) {
                accountKeys.push(key);
              } else if (typeof key === 'string') {
                accountKeys.push(new PublicKey(key));
              }
            }
          }
          
          // Get compiled instructions
          const compiledInstructions = 'compiledInstructions' in message 
            ? message.compiledInstructions 
            : ('instructions' in message ? message.instructions : []);
          
          for (const ix of compiledInstructions as Array<{ programIdIndex: number; data: Uint8Array | string }>) {
            const programIdIndex = ix.programIdIndex;
            if (programIdIndex >= accountKeys.length) continue;
            
            const programId = accountKeys[programIdIndex];
            if (!programId || !programId.equals(MEMO_PROGRAM_ID)) continue;
            
            try {
              // Decode memo data
              let memoBytes: Uint8Array;
              if (ix.data instanceof Uint8Array) {
                memoBytes = ix.data;
              } else if (typeof ix.data === 'string') {
                // Base58 or Base64 encoded
                try {
                  memoBytes = Buffer.from(ix.data, 'base64');
                } catch {
                  memoBytes = Buffer.from(ix.data);
                }
              } else {
                continue;
              }
              
              const memoData = new TextDecoder().decode(memoBytes);
              const memoJson = JSON.parse(memoData);
              
              // Check if it's a Kiln memo
              if ((memoJson.standard === 'Kiln' || memoJson.standard === 'KILN') && memoJson.solana?.mint === validated.mint) {
                if ((memoJson.action === 'teleburn-seal' || memoJson.action === 'seal') && memoJson.inscription?.id) {
                  inscriptionId = memoJson.inscription.id;
                  sha256 = memoJson.media?.sha256;
                  sealSignature = sigInfo.signature;
                } else if (
                  // Check for teleburn actions
                  (memoJson.action === 'teleburn' || 
                   memoJson.action === 'teleburn-burn' || memoJson.action === 'teleburn-incinerate' || memoJson.action === 'teleburn-derived' ||
                   memoJson.action === 'burn' || memoJson.action === 'incinerate' || memoJson.action === 'retire')
                  && memoJson.inscription?.id
                ) {
                  inscriptionId = inscriptionId || memoJson.inscription.id;
                  sha256 = sha256 || memoJson.media?.sha256;
                  kilnMemo = memoJson;
                  blockTime = tx.blockTime || undefined;
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
          
          // If we found the memo, break early
          if (kilnMemo) break;
          
        } catch (txError) {
          console.warn('Failed to parse transaction:', sigInfo.signature, txError);
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

    // Determine if this is an official Kiln teleburn
    const isOfficialKilnBurn = status === 'burned' && !!kilnMemo && !!burnSignature;
    
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
        blockTime, // On-chain timestamp
        sealSignature,
        burnSignature,
        isOfficialKilnBurn, // True only if Kiln memo found AND supply=0
        kilnMemo, // Full memo object for download
        metadata: {
          timestamp: new Date().toISOString(),
          protocol: 'Kiln',
          version: kilnMemo?.version || null,
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

