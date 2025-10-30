// src/app/api/tx/sol-incinerator-burn/route.ts
/**
 * Sol-Incinerator Burn API Endpoint
 * 
 * Handles pNFT burning using Sol-Incinerator API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBurnTransaction } from '@/lib/sol-incinerator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assetId, userPublicKey, autoCloseTokenAccounts = true, burnAmount } = body;

    console.log(`🔥 SOL-INCINERATOR API: Burn request for asset: ${assetId}`);
    console.log(`🔥 SOL-INCINERATOR API: User: ${userPublicKey}`);

    if (!assetId || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: assetId, userPublicKey' },
        { status: 400 }
      );
    }

    // Get the Sol-Incinerator API key
    const apiKey = process.env['SOL_INCINERATOR_API_KEY'] || '833f505d-536d-4565-858d-66f1089d49c1';
    console.log(`🔥 SOL-INCINERATOR API: Using API key: ${apiKey !== '833f505d-536d-4565-858d-66f1089d49c1' ? 'CUSTOM' : 'DEFAULT'}`);

    // Call Sol-Incinerator API
    const burnResult = await getBurnTransaction(
      {
        assetId,
        userPublicKey,
        autoCloseTokenAccounts,
        burnAmount
      },
      apiKey
    );

    if (!burnResult) {
      return NextResponse.json(
        { error: 'Failed to create burn transaction via Sol-Incinerator' },
        { status: 500 }
      );
    }

    console.log(`✅ SOL-INCINERATOR API: Burn transaction created successfully`);
    console.log(`✅ SOL-INCINERATOR API: Transaction type: ${burnResult.transactionType}`);
    console.log(`✅ SOL-INCINERATOR API: Serialized transaction length: ${burnResult.serializedTransaction?.length || 'undefined'}`);
    console.log(`✅ SOL-INCINERATOR API: Serialized transaction preview: ${burnResult.serializedTransaction?.substring(0, 100) || 'undefined'}`);

    return NextResponse.json({
      success: true,
      transaction: burnResult.serializedTransaction,
      transactionType: burnResult.transactionType,
      lamportsReclaimed: burnResult.lamportsReclaimed,
      solanaReclaimed: burnResult.solanaReclaimed,
      isDestructiveAction: burnResult.isDestructiveAction
    });

  } catch (error) {
    console.error('❌ SOL-INCINERATOR API: Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
