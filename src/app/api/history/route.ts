/**
 * API Route: /api/history
 * 
 * Fetches teleburn history for a given wallet address.
 * Queries transaction history looking for Kiln teleburn memos.
 * 
 * @description Get teleburn history by wallet
 * @version 0.1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { z } from 'zod';

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

        // Search logs for Kiln memo
        for (const log of tx.meta.logMessages) {
          // Look for memo program invocation
          if (log.includes('Program log: Memo')) {
            // Try to find JSON memo in logs
            const memoMatch = log.match(/Program log: Memo \(len \d+\): "(.*?)"/);
            if (memoMatch && memoMatch[1]) {
              try {
                const memoData = memoMatch[1];
                const memo = JSON.parse(memoData) as KilnMemo;

                // Check if it's a Kiln teleburn memo
                if (memo.standard === 'Kiln' && memo.action === 'teleburn') {
                  teleburns.push({
                    signature: sigInfo.signature,
                    mint: memo.solana?.mint || 'unknown',
                    inscriptionId: memo.inscription?.id || 'unknown',
                    timestamp: memo.timestamp || 0,
                    blockTime: tx.blockTime,
                    memo,
                  });
                  break;
                }
              } catch {
                // Not valid JSON, skip
              }
            }
          }

          // Alternative: Look for raw memo data in logs
          if (log.includes('"standard":"Kiln"') || log.includes('"standard": "Kiln"')) {
            try {
              // Extract JSON from log
              const jsonStart = log.indexOf('{');
              const jsonEnd = log.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const memoJson = log.substring(jsonStart, jsonEnd + 1);
                const memo = JSON.parse(memoJson) as KilnMemo;

                if (memo.standard === 'Kiln' && memo.action === 'teleburn') {
                  teleburns.push({
                    signature: sigInfo.signature,
                    mint: memo.solana?.mint || 'unknown',
                    inscriptionId: memo.inscription?.id || 'unknown',
                    timestamp: memo.timestamp || 0,
                    blockTime: tx.blockTime,
                    memo,
                  });
                  break;
                }
              }
            } catch {
              // Skip on parse error
            }
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

