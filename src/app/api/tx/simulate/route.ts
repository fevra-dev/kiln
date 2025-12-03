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
import { createDryRunServiceWithFallback, DryRunService } from '@/lib/dry-run';
import { TeleburnMethod } from '@/lib/transaction-builder';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEmergencyShutdown } from '@/lib/emergency-shutdown';

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
  method: z.enum(['teleburn-burn', 'teleburn-incinerate', 'teleburn-derived', 'burn', 'incinerate']).describe('Retire method'), // Includes old values for backward compatibility
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
    const validated = simulateRequestSchema.parse(body);

    // Get RPC URL - prioritize client-provided URL, then environment, then fallback
    const rpcUrl = validated.rpcUrl || process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://solana-rpc.publicnode.com';
    
    // Debug RPC URL selection
    console.log('🔍 API: RPC URL Debug:');
    console.log('  - Client provided rpcUrl:', validated.rpcUrl);
    console.log('  - Environment NEXT_PUBLIC_SOLANA_RPC:', process.env['NEXT_PUBLIC_SOLANA_RPC']);
    console.log('  - Final selected rpcUrl:', rpcUrl);

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

    // Create dry run service with RPC fallback for auth errors
    const dryRun = await createDryRunServiceWithFallback(rpcUrl);

    // Execute dry run
    console.log('🔄 API: Starting dry run execution...');
    console.log('📋 API: Mint:', mint.toBase58());
    console.log('📋 API: Owner:', owner.toBase58());
    console.log('📋 API: Payer:', payer.toBase58());
    console.log('📋 API: Inscription ID:', validated.inscriptionId);
    console.log('📋 API: Method:', validated.method);
    console.log('📋 API: RPC URL:', rpcUrl);
    
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
    console.log('📊 API: Report summary:');
    console.log('  - Success:', report.success);
    console.log('  - Errors count:', report.errors.length);
    console.log('  - Steps count:', report.steps.length);
    console.log('  - Warnings count:', report.warnings.length);
    console.log('📊 API: Report errors:', report.errors);

    // Return dry run report with CORS and rate limit headers
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json(
      {
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

