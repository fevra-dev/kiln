// src/app/api/tx/simulate/route.ts
/**
 * API Route: POST /api/tx/simulate
 * 
 * Simulates a complete teleburn flow without signing or broadcasting.
 * Builds all transactions, decodes them, simulates on-chain, and returns
 * a comprehensive dry run report.
 * 
 * CRITICAL: No transactions are signed or sent. Zero risk.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { createDryRunService, DryRunService } from '@/lib/dry-run';
import { TeleburnMethod } from '@/lib/transaction-builder';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';

/**
 * Request schema for dry run simulation
 */
const simulateRequestSchema = z.object({
  // Seal params
  payer: z.string().describe('Fee payer public key'),
  mint: z.string().describe('Token mint address'),
  inscriptionId: z.string().describe('Bitcoin inscription ID (txidi0)'),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i).describe('Content SHA-256 hash'),
  authority: z.array(z.string()).optional().describe('Optional multi-sig authorities'),

  // Retire params
  owner: z.string().describe('Token owner public key'),
  method: z.enum(['burn', 'incinerate', 'teleburn-derived']).describe('Retire method'),
  amount: z.string().optional().describe('Amount to retire (default: 1)'),

  // Optional URI update
  updateUri: z.object({
    authority: z.string().describe('Metadata update authority'),
    newUri: z.string().url().describe('New metadata URI (pointer JSON)'),
  }).optional(),

  // RPC
  rpcUrl: z.string().url().optional(),
});

/**
 * POST handler: Execute dry run simulation
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
    const validated = simulateRequestSchema.parse(body);

    // Get RPC URL - use Allnodes for mainnet (same as client)
    const rpcUrl = validated.rpcUrl || process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://solana-rpc.publicnode.com';

    // Parse public keys
    const payer = new PublicKey(validated.payer);
    const mint = new PublicKey(validated.mint);
    const owner = new PublicKey(validated.owner);
    const authority = validated.authority?.map((a) => new PublicKey(a));

    // Parse amount
    const amount = validated.amount ? BigInt(validated.amount) : undefined;

    // Parse optional URI update
    let updateUri;
    if (validated.updateUri) {
      updateUri = {
        authority: new PublicKey(validated.updateUri.authority),
        newUri: validated.updateUri.newUri,
      };
    }

    // Create dry run service
    const dryRun = createDryRunService(rpcUrl);

    // Execute dry run
    console.log('🔄 API: Starting dry run execution...');
    console.log('📋 API: Mint:', mint.toBase58());
    console.log('📋 API: Inscription ID:', validated.inscriptionId);
    
    const report = await dryRun.executeDryRun({
      payer,
      mint,
      inscriptionId: validated.inscriptionId,
      sha256: validated.sha256,
      authority,
      owner,
      method: validated.method as TeleburnMethod,
      amount,
      updateUri,
      rpcUrl,
    });

    // Generate downloadable receipt
    const receipt = DryRunService.generateRehearsalReceipt(report);

    console.log('✅ API: Dry run completed successfully');
    console.log('📊 API: Report success:', report.success);
    console.log('📊 API: Report errors:', report.errors);

    // Return dry run report with CORS headers
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json({
      success: true,
      report,
      receipt, // JSON string for download
      debug: {
        mint: mint.toBase58(),
        inscriptionId: validated.inscriptionId,
        rpcUrl,
        reportSuccess: report.success,
        reportErrors: report.errors,
      },
      metadata: {
        timestamp: report.timestamp,
        sbt01_version: '0.1.1',
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
    console.error('Simulation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to simulate teleburn flow',
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

