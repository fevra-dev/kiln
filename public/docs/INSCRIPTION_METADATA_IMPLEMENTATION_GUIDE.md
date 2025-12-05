# KILN Inscription Metadata Implementation Guide

**Version:** 1.0  
**Status:** Implementation Guide for AI Coders  
**Date:** December 5, 2025  
**Based On:** [KILN_INSCRIPTION_METADATA_SPEC.md](./INSCRIPTION_METADATA_SPEC.md)  
**Companion To:** KILN Teleburn Protocol v1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Integration Points](#integration-points)
5. [API Endpoints](#api-endpoints)
6. [UI Components](#ui-components)
7. [Testing Requirements](#testing-requirements)
8. [Verification Flow](#verification-flow)
9. [Error Handling](#error-handling)
10. [Completion Checklist](#completion-checklist)

---

## Overview

This guide provides step-by-step instructions for implementing the **Bitcoin Inscription Metadata Standard** into the KILN codebase. The implementation enables users to generate properly formatted JSON metadata for Bitcoin Ordinal inscriptions that link back to burned Solana NFTs.

### What We're Building

1. **Library Module** (`src/lib/kiln-inscription.ts`) - Core functions for building/parsing inscription metadata
2. **API Endpoints** - Generate inscription metadata JSON
3. **UI Components** - Display and download inscription metadata
4. **Integration** - Connect with existing teleburn flow

### Bidirectional Linkage

```
Solana → Bitcoin:  teleburn:abc123...i0  (already implemented ✅)
Bitcoin → Solana:  {"p":"kiln","mint":"6iv..."}  (to be implemented)
```

---

## Prerequisites

### Existing Code

The implementation code already exists in:
- **Location:** `movemee/files (1)/kiln-inscription.ts` (reference file - to be integrated)
- **Status:** Complete TypeScript implementation with all required functions
- **Action Required:** Move to `src/lib/` and integrate

### Dependencies

No new dependencies required. The code uses only:
- TypeScript built-ins
- Node.js `Buffer` API
- Standard JSON parsing

### Related Files

- `src/lib/teleburn.ts` - Solana memo handling (already integrated)
- `src/lib/local-burn/build-burn-memo-tx.ts` - Burn transaction builder
- `src/components/wizard/Step4Execute.tsx` - Execution step (integration point)

---

## Step-by-Step Implementation

### Step 1: Move Core Library to src/lib/

**Task:** Copy the inscription metadata library to the proper location.

**Actions:**

1. **Copy file:**
   ```bash
   cp "movemee/files (1)/kiln-inscription.ts" src/lib/kiln-inscription.ts
   ```

2. **Verify file structure:**
   - File should be at: `src/lib/kiln-inscription.ts`
   - Should contain all exports: `buildMinimal`, `buildStandard`, `buildFull`, `buildProvenance`, `parse`, `serialize`, etc.

3. **Update imports (if needed):**
   - Check for any relative imports that need adjustment
   - Ensure all TypeScript types are properly exported

**Expected Result:**
- ✅ File exists at `src/lib/kiln-inscription.ts`
- ✅ All functions are exported
- ✅ No TypeScript errors

---

### Step 2: Create API Endpoint for Metadata Generation

**Task:** Create API route to generate inscription metadata JSON.

**File to Create:** `src/app/api/inscription/metadata/route.ts`

**Implementation:**

```typescript
// src/app/api/inscription/metadata/route.ts
/**
 * API Route: POST /api/inscription/metadata
 * 
 * Generates Bitcoin inscription metadata JSON for KILN teleburns.
 * Supports minimal, standard, and full metadata formats.
 * 
 * @description Inscription metadata generator
 * @version 1.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  buildMinimal, 
  buildStandard, 
  buildFull,
  serialize,
  size,
  type Attribute
} from '@/lib/kiln-inscription';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEmergencyShutdown } from '@/lib/emergency-shutdown';

/**
 * Request schema
 */
const metadataRequestSchema = z.object({
  mint: z.string().min(32).max(44),
  format: z.enum(['minimal', 'standard', 'full']).default('standard'),
  
  // Standard format fields
  name: z.string().optional(),
  collection: z.string().optional(),
  
  // Full format fields
  symbol: z.string().optional(),
  burn_tx: z.string().optional(),
  attributes: z.array(z.object({
    trait_type: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()])
  })).optional(),
});

/**
 * POST handler: Generate inscription metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Check emergency shutdown
    const shutdownResponse = checkEmergencyShutdown(request);
    if (shutdownResponse) return shutdownResponse;

    // Check rate limit (10 requests per minute)
    const rateLimitResult = await checkRateLimit(request, {
      maxRequests: 10,
      windowMs: 60000,
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
    const validated = metadataRequestSchema.parse(body);

    // Build metadata based on format
    let metadata;
    let metadataSize: number;

    switch (validated.format) {
      case 'minimal':
        metadata = buildMinimal(validated.mint);
        break;

      case 'standard':
        if (!validated.name || !validated.collection) {
          return NextResponse.json(
            { success: false, error: 'name and collection required for standard format' },
            { status: 400 }
          );
        }
        metadata = buildStandard(validated.mint, validated.name, validated.collection);
        break;

      case 'full':
        if (!validated.name || !validated.collection) {
          return NextResponse.json(
            { success: false, error: 'name and collection required for full format' },
            { status: 400 }
          );
        }
        metadata = buildFull({
          mint: validated.mint,
          name: validated.name,
          collection: validated.collection,
          symbol: validated.symbol,
          burn_tx: validated.burn_tx,
          attributes: validated.attributes as Attribute[] | undefined,
        });
        break;
    }

    // Serialize to JSON
    const json = serialize(metadata);
    metadataSize = size(metadata);

    // Return metadata with CORS headers
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json(
      {
        success: true,
        metadata: JSON.parse(json), // Return as object for convenience
        json, // Also include stringified version
        size: metadataSize,
        format: validated.format,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('Metadata generation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

**Expected Result:**
- ✅ API endpoint at `/api/inscription/metadata`
- ✅ Supports minimal, standard, and full formats
- ✅ Proper validation and error handling
- ✅ CORS and rate limiting

---

### Step 3: Create API Endpoint for Provenance Records

**Task:** Create API route for generating provenance metadata for existing inscriptions.

**File to Create:** `src/app/api/inscription/provenance/route.ts`

**Implementation:**

```typescript
// src/app/api/inscription/provenance/route.ts
/**
 * API Route: POST /api/inscription/provenance
 * 
 * Generates provenance metadata for existing Bitcoin inscriptions.
 * Used when adding KILN metadata to inscriptions that already exist.
 * 
 * @description Provenance metadata generator
 * @version 1.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  buildProvenance,
  serialize,
  size
} from '@/lib/kiln-inscription';
import { getCorsHeaders, isOriginAllowed } from '@/lib/cors';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEmergencyShutdown } from '@/lib/emergency-shutdown';

/**
 * Request schema
 */
const provenanceRequestSchema = z.object({
  inscriptionId: z.string().regex(/^[a-f0-9]{64}i[0-9]+$/),
  mint: z.string().min(32).max(44),
  burn_tx: z.string().optional(),
});

/**
 * POST handler: Generate provenance metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Check emergency shutdown
    const shutdownResponse = checkEmergencyShutdown(request);
    if (shutdownResponse) return shutdownResponse;

    // Check rate limit
    const rateLimitResult = await checkRateLimit(request, {
      maxRequests: 10,
      windowMs: 60000,
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
    const validated = provenanceRequestSchema.parse(body);

    // Build provenance metadata
    const metadata = buildProvenance(
      validated.inscriptionId,
      validated.mint,
      validated.burn_tx
    );

    // Serialize to JSON
    const json = serialize(metadata);
    const metadataSize = size(metadata);

    // Return metadata
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json(
      {
        success: true,
        metadata: JSON.parse(json),
        json,
        size: metadataSize,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('Provenance generation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

**Expected Result:**
- ✅ API endpoint at `/api/inscription/provenance`
- ✅ Validates inscription ID format
- ✅ Generates provenance metadata

---

### Step 4: Integrate with Teleburn Execution Flow

**Task:** Add inscription metadata generation to the teleburn execution step.

**File to Modify:** `src/components/wizard/Step4Execute.tsx`

**Integration Points:**

1. **After successful burn transaction:**
   - Fetch NFT metadata (name, collection, attributes)
   - Generate inscription metadata JSON
   - Display download option

2. **Add metadata generation function:**

```typescript
// Add to Step4Execute.tsx imports
import { buildStandard, buildFull, serialize, type Attribute } from '@/lib/kiln-inscription';

// Add state for metadata
const [inscriptionMetadata, setInscriptionMetadata] = useState<string | null>(null);
const [metadataSize, setMetadataSize] = useState<number>(0);

// Add function to generate metadata after burn
const generateInscriptionMetadata = async (
  mint: string,
  burnSignature: string
) => {
  try {
    // Fetch NFT metadata from Solana
    const connection = new Connection(
      process.env['NEXT_PUBLIC_SOLANA_RPC'] || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    
    // Get metadata PDA
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
        new PublicKey(mint).toBuffer(),
      ],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
    );

    // Fetch metadata account (simplified - you may need Metaplex SDK)
    // For now, use standard format with mint only
    const metadata = buildStandard(
      mint,
      `NFT #${mint.slice(0, 8)}`, // Placeholder name
      'Unknown Collection' // Placeholder collection
    );

    // Add burn_tx if available
    const fullMetadata = buildFull({
      mint,
      name: metadata.name,
      collection: metadata.collection,
      burn_tx: burnSignature,
    });

    const json = serialize(fullMetadata);
    setInscriptionMetadata(json);
    setMetadataSize(size(fullMetadata));
  } catch (error) {
    console.error('Failed to generate metadata:', error);
    // Fallback to minimal
    const minimal = buildMinimal(mint);
    setInscriptionMetadata(serialize(minimal));
    setMetadataSize(size(minimal));
  }
};

// Call after burn completes
useEffect(() => {
  if (completed && formData.mint && txStates[0]?.signature) {
    generateInscriptionMetadata(formData.mint, txStates[0].signature);
  }
}, [completed, formData.mint, txStates]);
```

3. **Add UI component to display and download metadata:**

```typescript
// Add to JSX after burn completion
{inscriptionMetadata && (
  <div className="mt-6 p-4 bg-black/50 border border-green-500/30 rounded">
    <div className="text-sm font-bold mb-2 text-green-400">
      BITCOIN INSCRIPTION METADATA
    </div>
    <div className="text-xs text-gray-400 mb-2">
      Size: {metadataSize} bytes | Format: Standard
    </div>
    <pre className="text-xs text-green-300 bg-black/50 p-3 rounded mb-3 overflow-auto max-h-40">
      {inscriptionMetadata}
    </pre>
    <button
      onClick={() => {
        const blob = new Blob([inscriptionMetadata], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kiln-inscription-${formData.mint.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className="terminal-button text-sm px-4 py-2"
    >
      📥 Download Metadata JSON
    </button>
    <div className="text-xs text-gray-500 mt-2">
      Use this JSON as the metadata for your Bitcoin Ordinal inscription
    </div>
  </div>
)}
```

**Expected Result:**
- ✅ Metadata generated after successful burn
- ✅ Displayed in execution step
- ✅ Download button for JSON file
- ✅ Size information shown

---

### Step 5: Create Standalone Metadata Generator Page

**Task:** Create a dedicated page for generating inscription metadata without burning.

**File to Create:** `src/app/inscription-metadata/page.tsx`

**Implementation:**

```typescript
'use client';

/**
 * Inscription Metadata Generator Page
 * 
 * Standalone tool for generating Bitcoin inscription metadata JSON.
 * Can be used independently of the teleburn flow.
 * 
 * @description Metadata generator interface
 * @version 1.0
 */

import { useState } from 'react';
import { buildMinimal, buildStandard, buildFull, serialize, size, type Attribute } from '@/lib/kiln-inscription';
import { isValidPublicKey } from '@/lib/schemas';

export default function InscriptionMetadataPage() {
  const [mint, setMint] = useState('');
  const [format, setFormat] = useState<'minimal' | 'standard' | 'full'>('standard');
  
  // Standard fields
  const [name, setName] = useState('');
  const [collection, setCollection] = useState('');
  
  // Full fields
  const [symbol, setSymbol] = useState('');
  const [burnTx, setBurnTx] = useState('');
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  
  const [metadata, setMetadata] = useState<string | null>(null);
  const [metadataSize, setMetadataSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setError(null);
    
    if (!isValidPublicKey(mint)) {
      setError('Invalid Solana mint address');
      return;
    }

    try {
      let result;
      
      switch (format) {
        case 'minimal':
          result = buildMinimal(mint);
          break;
          
        case 'standard':
          if (!name || !collection) {
            setError('Name and collection required for standard format');
            return;
          }
          result = buildStandard(mint, name, collection);
          break;
          
        case 'full':
          if (!name || !collection) {
            setError('Name and collection required for full format');
            return;
          }
          result = buildFull({
            mint,
            name,
            collection,
            symbol: symbol || undefined,
            burn_tx: burnTx || undefined,
            attributes: attributes.length > 0 ? attributes : undefined,
          });
          break;
      }

      const json = serialize(result);
      setMetadata(json);
      setMetadataSize(size(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate metadata');
    }
  };

  const handleDownload = () => {
    if (!metadata) return;
    
    const blob = new Blob([metadata], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiln-inscription-${mint.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!metadata) return;
    navigator.clipboard.writeText(metadata);
    // Show feedback
  };

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Inscription Metadata Generator</h1>
          <p className="text-gray-400">
            Generate Bitcoin Ordinal inscription metadata for KILN teleburns
          </p>
        </div>

        {/* Form */}
        <div className="terminal-window mb-6">
          <div className="terminal-window-content p-8 space-y-6">
            {/* Mint Address */}
            <div>
              <label className="block mb-2 font-bold">Solana Mint Address *</label>
              <input
                type="text"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                className="w-full form-input"
                placeholder="6ivMgojHapfvDKS7pFSwgCPzPvPPCT2y8Pv1zHfLqTBL"
              />
            </div>

            {/* Format Selection */}
            <div>
              <label className="block mb-2 font-bold">Metadata Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="w-full form-input"
              >
                <option value="minimal">Minimal (p, op, v, mint only)</option>
                <option value="standard">Standard (+ name, collection)</option>
                <option value="full">Full (+ symbol, burn_tx, attributes)</option>
              </select>
            </div>

            {/* Standard Fields */}
            {(format === 'standard' || format === 'full') && (
              <>
                <div>
                  <label className="block mb-2 font-bold">NFT Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full form-input"
                    placeholder="DeGod #1234"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-bold">Collection Name *</label>
                  <input
                    type="text"
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                    className="w-full form-input"
                    placeholder="DeGods"
                  />
                </div>
              </>
            )}

            {/* Full Fields */}
            {format === 'full' && (
              <>
                <div>
                  <label className="block mb-2 font-bold">Symbol (Optional)</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full form-input"
                    placeholder="DGOD"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-bold">Burn Transaction (Optional)</label>
                  <input
                    type="text"
                    value={burnTx}
                    onChange={(e) => setBurnTx(e.target.value)}
                    className="w-full form-input"
                    placeholder="5Kj2nFvH8mPqR3xYtZ9wBcVdE6fGhJkLmNpQrStUvWxYzA1B2C3D4E5F6G7H8I9J0K"
                  />
                </div>
                {/* Attributes editor - simplified for now */}
              </>
            )}

            {/* Error Display */}
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              className="terminal-button w-full py-3"
            >
              Generate Metadata
            </button>
          </div>
        </div>

        {/* Result Display */}
        {metadata && (
          <div className="terminal-window">
            <div className="terminal-window-content p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-green-400">Generated Metadata</div>
                  <div className="text-xs text-gray-400">Size: {metadataSize} bytes</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="terminal-button text-sm px-4 py-2"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={handleDownload}
                    className="terminal-button text-sm px-4 py-2"
                  >
                    📥 Download
                  </button>
                </div>
              </div>
              <pre className="bg-black/50 p-4 rounded text-xs overflow-auto max-h-96">
                {metadata}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
```

**Expected Result:**
- ✅ Standalone page at `/inscription-metadata`
- ✅ Form for all metadata fields
- ✅ Format selection (minimal/standard/full)
- ✅ Generate, copy, and download functionality

---

### Step 6: Add Metadata Parsing to Verify Page

**Task:** Update verify page to parse and display inscription metadata from Bitcoin.

**File to Modify:** `src/app/verify/page.tsx`

**Integration:**

1. **Add parsing function:**

```typescript
// Add import
import { parse, isKiln } from '@/lib/kiln-inscription';

// Add to verify function
const verifyInscriptionMetadata = async (inscriptionId: string) => {
  try {
    // Fetch inscription content from Ordinals indexer
    const response = await fetch(`https://api.hiro.so/ordinals/v1/inscriptions/${inscriptionId}`);
    const data = await response.json();
    
    // Check if content is JSON
    if (data.content_type?.startsWith('application/json')) {
      const content = await fetch(data.content).then(r => r.text());
      
      if (isKiln(content)) {
        const parsed = parse(content);
        if (parsed.valid && parsed.mint) {
          // Cross-reference with Solana burn
          return {
            valid: true,
            mint: parsed.mint,
            metadata: parsed.data,
          };
        }
      }
    }
    
    return { valid: false };
  } catch (error) {
    console.error('Inscription metadata verification error:', error);
    return { valid: false };
  }
};
```

2. **Display inscription metadata in verify results:**

```typescript
// Add to result display
{result.inscriptionMetadata && (
  <div className="result-section">
    <div className="result-label">Bitcoin Inscription Metadata</div>
    <div className="result-value">
      <pre className="text-xs bg-black/50 p-2 rounded">
        {JSON.stringify(result.inscriptionMetadata, null, 2)}
      </pre>
    </div>
  </div>
)}
```

**Expected Result:**
- ✅ Verify page can parse inscription metadata
- ✅ Displays metadata when found
- ✅ Cross-references with Solana burn

---

### Step 7: Create Unit Tests

**Task:** Add comprehensive unit tests for inscription metadata functions.

**File to Create:** `tests/unit/kiln-inscription.test.ts`

**Test Coverage:**

```typescript
import {
  buildMinimal,
  buildStandard,
  buildFull,
  buildProvenance,
  parse,
  serialize,
  size,
  isValidMint,
  isValidInscriptionId,
  isKilnInscription,
} from '@/lib/kiln-inscription';

describe('kiln-inscription', () => {
  const validMint = '6ivMgojHapfvDKS7pFSwgCPzPvPPCT2y8Pv1zHfLqTBL';
  const validInscriptionId = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';

  describe('buildMinimal', () => {
    it('should build minimal metadata', () => {
      const result = buildMinimal(validMint);
      expect(result).toEqual({
        p: 'kiln',
        op: 'teleburn',
        v: 1,
        mint: validMint,
      });
    });

    it('should throw on invalid mint', () => {
      expect(() => buildMinimal('invalid')).toThrow();
    });
  });

  describe('buildStandard', () => {
    it('should build standard metadata', () => {
      const result = buildStandard(validMint, 'DeGod #1234', 'DeGods');
      expect(result).toEqual({
        p: 'kiln',
        op: 'teleburn',
        v: 1,
        mint: validMint,
        name: 'DeGod #1234',
        collection: 'DeGods',
      });
    });
  });

  describe('buildFull', () => {
    it('should build full metadata', () => {
      const result = buildFull({
        mint: validMint,
        name: 'DeGod #1234',
        collection: 'DeGods',
        symbol: 'DGOD',
        burn_tx: '5Kj2nF...',
        attributes: [
          { trait_type: 'Eyes', value: 'Laser' },
        ],
      });
      
      expect(result.p).toBe('kiln');
      expect(result.op).toBe('teleburn');
      expect(result.v).toBe(1);
      expect(result.mint).toBe(validMint);
      expect(result.name).toBe('DeGod #1234');
      expect(result.collection).toBe('DeGods');
      expect(result.symbol).toBe('DGOD');
      expect(result.burn_tx).toBe('5Kj2nF...');
      expect(result.attributes).toHaveLength(1);
    });
  });

  describe('buildProvenance', () => {
    it('should build provenance metadata', () => {
      const result = buildProvenance(validInscriptionId, validMint, '5Kj2nF...');
      expect(result).toEqual({
        p: 'kiln',
        op: 'provenance',
        v: 1,
        inscription: validInscriptionId,
        mint: validMint,
        burn_tx: '5Kj2nF...',
      });
    });
  });

  describe('parse', () => {
    it('should parse valid minimal metadata', () => {
      const json = JSON.stringify(buildMinimal(validMint));
      const result = parse(json);
      
      expect(result.valid).toBe(true);
      expect(result.op).toBe('teleburn');
      expect(result.mint).toBe(validMint);
    });

    it('should reject invalid JSON', () => {
      const result = parse('invalid json');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject non-KILN metadata', () => {
      const result = parse('{"p":"brc-20","op":"deploy"}');
      expect(result.valid).toBe(false);
    });
  });

  describe('serialize', () => {
    it('should serialize to JSON', () => {
      const metadata = buildMinimal(validMint);
      const json = serialize(metadata);
      expect(json).toBe(JSON.stringify(metadata));
    });
  });

  describe('size', () => {
    it('should calculate size in bytes', () => {
      const minimal = buildMinimal(validMint);
      const minimalSize = size(minimal);
      expect(minimalSize).toBeGreaterThan(0);
      
      const standard = buildStandard(validMint, 'Test', 'Collection');
      const standardSize = size(standard);
      expect(standardSize).toBeGreaterThan(minimalSize);
    });
  });

  describe('validation', () => {
    it('should validate mint addresses', () => {
      expect(isValidMint(validMint)).toBe(true);
      expect(isValidMint('invalid')).toBe(false);
    });

    it('should validate inscription IDs', () => {
      expect(isValidInscriptionId(validInscriptionId)).toBe(true);
      expect(isValidInscriptionId('invalid')).toBe(false);
    });
  });
});
```

**Expected Result:**
- ✅ Comprehensive test coverage
- ✅ All functions tested
- ✅ Edge cases handled
- ✅ Tests pass

---

## Integration Points

### Where Metadata is Used

1. **After Teleburn Execution** (`Step4Execute.tsx`)
   - Generate metadata after successful burn
   - Display for user to download
   - Include burn transaction signature

2. **Standalone Generator** (`/inscription-metadata`)
   - Independent tool for metadata generation
   - Useful for users who already have inscriptions

3. **Verification** (`/verify`)
   - Parse inscription metadata from Bitcoin
   - Cross-reference with Solana burn
   - Bidirectional verification

4. **API Endpoints**
   - Programmatic access for integrations
   - Used by external tools and services

---

## API Endpoints

### POST `/api/inscription/metadata`

**Purpose:** Generate inscription metadata JSON

**Request Body:**
```json
{
  "mint": "6ivMgojHapfvDKS7pFSwgCPzPvPPCT2y8Pv1zHfLqTBL",
  "format": "standard",
  "name": "DeGod #1234",
  "collection": "DeGods",
  "symbol": "DGOD",
  "burn_tx": "5Kj2nF...",
  "attributes": [
    { "trait_type": "Eyes", "value": "Laser" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "metadata": { "p": "kiln", "op": "teleburn", ... },
  "json": "{\"p\":\"kiln\",...}",
  "size": 120,
  "format": "standard"
}
```

### POST `/api/inscription/provenance`

**Purpose:** Generate provenance metadata for existing inscriptions

**Request Body:**
```json
{
  "inscriptionId": "6fb976ab...i0",
  "mint": "6ivMgoj...",
  "burn_tx": "5Kj2nF..."
}
```

**Response:**
```json
{
  "success": true,
  "metadata": { "p": "kiln", "op": "provenance", ... },
  "json": "{\"p\":\"kiln\",...}",
  "size": 150
}
```

---

## UI Components

### Metadata Display Component

**File:** `src/components/inscription/InscriptionMetadataDisplay.tsx`

**Features:**
- Display metadata JSON
- Show size information
- Copy to clipboard
- Download as file
- Format validation

### Metadata Generator Form

**File:** `src/components/inscription/InscriptionMetadataForm.tsx`

**Features:**
- Format selection (minimal/standard/full)
- Field validation
- Real-time preview
- Generate button

---

## Testing Requirements

### Unit Tests
- ✅ All builder functions
- ✅ Parser functions
- ✅ Validation functions
- ✅ Serialization functions

### Integration Tests
- ✅ API endpoint responses
- ✅ Metadata generation flow
- ✅ Integration with burn execution
- ✅ Verification flow

### E2E Tests
- ✅ Full teleburn → metadata generation flow
- ✅ Standalone metadata generator
- ✅ Download functionality

---

## Verification Flow

### Bidirectional Verification

```
1. User burns NFT on Solana with memo: teleburn:abc123...i0
2. User inscribes on Bitcoin with metadata: {"p":"kiln","mint":"6iv..."}
3. Verifier can check:
   a. Parse Bitcoin inscription → get mint
   b. Query Solana for burn of that mint
   c. Parse Solana memo → get inscription ID
   d. Confirm IDs match ✓
```

### Implementation

Add to verify page:
- Fetch inscription content from Ordinals indexer
- Parse JSON metadata
- Extract mint address
- Cross-reference with Solana burn transaction
- Display verification result

---

## Error Handling

### Common Errors

1. **Invalid Mint Address**
   - Error: "Invalid Solana mint address format"
   - Solution: Validate with `isValidMint()` before building

2. **Missing Required Fields**
   - Error: "name and collection required for standard format"
   - Solution: Check format requirements before generation

3. **Invalid Inscription ID**
   - Error: "Invalid inscription ID format"
   - Solution: Validate with regex before parsing

4. **Parse Failures**
   - Error: "Invalid JSON or not a KILN inscription"
   - Solution: Try-catch around JSON.parse, validate `p` field

---

## Completion Checklist

### Core Library
- [ ] File moved to `src/lib/kiln-inscription.ts`
- [ ] All exports working
- [ ] No TypeScript errors
- [ ] JSDoc comments added

### API Endpoints
- [ ] `/api/inscription/metadata` implemented
- [ ] `/api/inscription/provenance` implemented
- [ ] CORS configured
- [ ] Rate limiting added
- [ ] Error handling complete

### UI Components
- [ ] Metadata display component
- [ ] Metadata generator form
- [ ] Integration with Step4Execute
- [ ] Standalone generator page

### Integration
- [ ] Metadata generation after burn
- [ ] Download functionality
- [ ] Verification page updates
- [ ] Cross-referencing logic

### Testing
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] All tests passing

### Documentation
- [ ] API documentation updated
- [ ] User guide updated
- [ ] Code comments added
- [ ] Examples provided

---

## Next Steps After Implementation

1. **Test with Real Inscriptions**
   - Generate metadata for actual teleburns
   - Verify on Ordinals indexers
   - Test bidirectional verification

2. **Optimize Metadata Fetching**
   - Cache NFT metadata
   - Batch requests
   - Handle rate limits

3. **Add Advanced Features**
   - Attribute editor UI
   - Metadata templates
   - Bulk generation

4. **Integration with Indexers**
   - Submit to Ordinals indexers
   - Verify indexing
   - Monitor adoption

---

## References

- **Specification:** [KILN_INSCRIPTION_METADATA_SPEC.md](../../files%20(1)/KILN_INSCRIPTION_METADATA_SPEC.md)
- **Teleburn Protocol:** [KILN_TELEBURN_SPEC_v1.0.md](../../files%20(1)/KILN_TELEBURN_SPEC_v1.0.md)
- **Existing Code:** `movemee/files (1)/kiln-inscription.ts` (reference file - to be integrated)
- **Related:** `src/lib/teleburn.ts` (Solana memo handling)

---

*End of Implementation Guide*

