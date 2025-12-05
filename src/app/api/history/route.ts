/**
 * API Route: /api/history
 * 
 * Fetches teleburn history for a given wallet address.
 * Queries transaction history looking for Kiln teleburn memos.
 * 
 * @description Get teleburn history by wallet (supports v1.0 and legacy formats)
 * @version 1.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { Buffer } from 'buffer';
import { parseAnyTeleburnMemo } from '@/lib/teleburn';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

// Request validation schema
const HistoryRequestSchema = z.object({
  wallet: z.string().min(32).max(44),
  limit: z.number().min(1).max(100).optional().default(20),
});

// Kiln memo structure for detection
interface KilnMemo {
  standard: string;
  version: string;
  action: string;
  method?: string;
  inscription?: { id: string };
  solana?: { mint: string };
  media?: { sha256: string };
  timestamp?: number;
}

// Response structure for a single teleburn
interface TeleburnRecord {
  signature: string;
  mint: string;
  inscriptionId: string;
  timestamp: number;
  blockTime: number | null;
  memo: KilnMemo;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = HistoryRequestSchema.parse(body);

    // Validate wallet address
    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(validated.wallet);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid wallet address',
      }, { status: 400 });
    }

    // Connect to RPC
    const rpcUrl = process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Get recent signatures for the wallet
    const signatures = await connection.getSignaturesForAddress(walletPubkey, {
      limit: validated.limit * 2, // Fetch more since not all will be teleburns
    });

    const teleburns: TeleburnRecord[] = [];

    // Check each transaction for Kiln memos
    for (const sigInfo of signatures) {
      if (teleburns.length >= validated.limit) break;

      try {
        const tx = await connection.getTransaction(sigInfo.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta || !tx.meta.logMessages) continue;

        // Parse memo from transaction instructions (same approach as verify API)
        const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
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
        const msgAny = message as unknown as Record<string, unknown>;
        const compiledInstructions = msgAny['compiledInstructions'] 
          ?? msgAny['instructions'] 
          ?? [];
        
        let inscriptionId: string | null = null;
        let memoFormat: 'v1' | 'legacy-prefix' | 'legacy-json' | null = null;
        let legacyMemo: KilnMemo | null = null;
        
        // First, find the teleburn memo (v1.0 or legacy)
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
              try {
                memoBytes = Buffer.from(ix.data, 'base64');
              } catch {
                memoBytes = Buffer.from(ix.data);
              }
            } else {
              continue;
            }
            
            const memoData = new TextDecoder().decode(memoBytes);
            
            // Try v1.0 format first (teleburn: prefix)
            try {
              const parseResult = parseAnyTeleburnMemo(memoData);
              inscriptionId = parseResult.inscriptionId;
              memoFormat = parseResult.format;
              break; // Found teleburn memo
            } catch {
              // Not v1.0 format, try legacy JSON
              try {
                const memo = JSON.parse(memoData) as KilnMemo;
                
                // Check if it's a Kiln teleburn memo (legacy JSON format)
                if ((memo.standard === 'Kiln' || memo.standard === 'KILN') && 
                    (memo.action === 'teleburn' || 
                     memo.action === 'teleburn-burn' || 
                     memo.action === 'teleburn-incinerate' || 
                     memo.action === 'teleburn-derived' ||
                     memo.action === 'burn' || 
                     memo.action === 'incinerate' || 
                     memo.action === 'retire')) {
                  inscriptionId = memo.inscription?.id || null;
                  memoFormat = 'legacy-json';
                  legacyMemo = memo;
                  break; // Found legacy JSON memo
                }
              } catch {
                // Not valid JSON or not a Kiln memo, continue
              }
            }
          } catch {
            // Skip invalid memo data
            continue;
          }
        }
        
        // If we found a teleburn memo, extract mint and create record
        if (inscriptionId) {
          // Extract mint address from transaction
          // Look for burn/transfer instructions or token balances
          let mintAddress: string | null = null;
          
          // Method 1: Extract from pre/post token balances (most reliable)
          if (tx.meta?.preTokenBalances && tx.meta.preTokenBalances.length > 0) {
            // Find token balance that was reduced to 0 (burned)
            const preBalances = tx.meta.preTokenBalances || [];
            const postBalances = tx.meta.postTokenBalances || [];
            
            for (const preBalance of preBalances) {
              const postBalance = postBalances.find(b => 
                b.accountIndex === preBalance.accountIndex
              );
              
              // If token balance went from > 0 to 0, it was burned
              if (preBalance.uiTokenAmount?.uiAmount && 
                  (!postBalance || !postBalance.uiTokenAmount?.uiAmount || postBalance.uiTokenAmount.uiAmount === 0)) {
                mintAddress = preBalance.mint || null;
                break;
              }
            }
          }
          
          // Method 2: Extract from account keys by finding token program accounts
          if (!mintAddress) {
            // Look for accounts that match mint pattern and are referenced by token instructions
            for (const ix of compiledInstructions as Array<{ programIdIndex: number; accountKeyIndexes?: number[] }>) {
              const programIdIndex = ix.programIdIndex;
              if (programIdIndex >= accountKeys.length) continue;
              
              const programId = accountKeys[programIdIndex];
              
              // Check if this is a token program instruction
              if (programId.equals(TOKEN_PROGRAM_ID) || programId.equals(TOKEN_2022_PROGRAM_ID)) {
                // For burn instructions, the mint is typically the second account
                if (ix.accountKeyIndexes && ix.accountKeyIndexes.length > 1) {
                  const potentialMint = accountKeys[ix.accountKeyIndexes[1]];
                  if (potentialMint) {
                    // Verify it's actually a mint by checking if it's a valid public key
                    // and not in the list of known system accounts
                    mintAddress = potentialMint.toBase58();
                    break;
                  }
                }
              }
            }
          }
          
          // Create teleburn record
          if (mintAddress) {
            teleburns.push({
              signature: sigInfo.signature,
              mint: mintAddress,
              inscriptionId,
              timestamp: legacyMemo?.timestamp || 0,
              blockTime: tx.blockTime ?? null,
              memo: legacyMemo || {
                standard: 'Kiln',
                version: memoFormat === 'v1' ? '1.0' : '0.1.x',
                action: 'teleburn',
                inscription: { id: inscriptionId },
              } as KilnMemo,
            });
          }
        }
      } catch {
        // Skip transactions that fail to fetch
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      wallet: validated.wallet,
      count: teleburns.length,
      teleburns,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors,
      }, { status: 400 });
    }

    console.error('History API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch teleburn history',
    }, { status: 500 });
  }
}

