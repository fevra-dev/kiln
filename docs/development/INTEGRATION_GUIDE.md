# Integration Guide: Previous ChatGPT Session Code

**Source**: `/Users/fevra/Apps/kiln/sbt01-web-spec-teleburn-full-compressor-expert`  
**Target**: Current KILN.1 Phase 1 implementation  
**Date**: October 20, 2025

---

## 📋 Overview

Your previous ChatGPT session built many Phase 2 components. We can integrate them, but several need updates to match our enhanced Phase 1 foundation:

| Component | Status | Action |
|-----------|--------|--------|
| Compressor | ✅ Good | Extract and use |
| Worker Pool | ✅ Good | Use directly |
| Pointer Builder | ⚠️ Update | Update to v0.1.1 |
| BTC Manifest | ✅ Good | Extract |
| Wallet Providers | ✅ Good | Use directly |
| Teleburn Library | ❌ Replace | Use our derived-owner.ts |
| API Routes | ⚠️ Update | Add validation + timestamps |
| Verify Route | ⚠️ Update | Add confidence scoring |

---

## 🔄 Critical Differences

### 1. Domain String Changed
**Old**: `"SBT01:solana:v1"`  
**New**: `"ordinals.teleburn.sbt01.v1"` (hardened)

**Why**: Domain separation security improvement

### 2. Version Bumped
**Old**: `"0.1"`  
**New**: `"0.1.1"`

**Why**: Temporal anchoring and verification features

### 3. Timestamp/Block Height Added
**Old**:
```json
{
  "standard": "KILN",
  "version": "0.1",
  "action": "seal"
}
```

**New**:
```json
{
  "standard": "KILN",
  "version": "0.1.1",
  "action": "seal",
  "timestamp": 1739904000,
  "block_height": 268123456
}
```

### 4. Inscription Verification Added
**Old**: No verification gate  
**New**: Mandatory SHA-256 check before sealing

### 5. Zod Validation Added
**Old**: Manual validation  
**New**: Type-safe Zod schemas for all inputs

---

## 📂 Files to Extract

### High Priority (Use These)

1. **Compressor Component**
   ```bash
   cp sbt01-web-spec-teleburn-full-compressor-expert/src/components/Compressor.tsx \
      src/components/wizard/Compressor.tsx
   ```
   - ✅ Already production-ready
   - ✅ Web Worker compression
   - ✅ PSNR quality scoring

2. **Encode Worker**
   ```bash
   cp sbt01-web-spec-teleburn-full-compressor-expert/src/workers/encode.worker.ts \
      src/workers/encode.worker.ts
   ```
   - ✅ Background compression
   - ✅ No UI blocking

3. **Wallet Providers**
   ```bash
   cp sbt01-web-spec-teleburn-full-compressor-expert/src/components/WalletProviders.tsx \
      src/components/WalletProviders.tsx
   ```
   - ✅ Solana wallet adapter setup

4. **Download Helper**
   ```bash
   cp sbt01-web-spec-teleburn-full-compressor-expert/src/lib/download.ts \
      src/lib/download.ts
   ```
   - ✅ File download utilities

### Medium Priority (Update First)

5. **Pointer Builder**
   ```bash
   # Don't copy directly - needs v0.1.1 update
   # Use as reference for structure
   ```
   - ⚠️ Update to include timestamp/block_height
   - ⚠️ Use our Zod PointerJsonSchema

6. **BTC Manifest Builder**
   ```bash
   # Extract after reviewing
   ```
   - ⚠️ Verify schema compatibility

### Low Priority (Replace with Phase 1)

7. **Teleburn Library** - ❌ Don't use
   - Use our `src/lib/derived-owner.ts` instead
   - Domain string is outdated

8. **API Routes** - ⚠️ Use as templates only
   - Structure is good
   - Implementation needs updates

---

## 🛠️ Step-by-Step Integration

### Step 1: Copy Safe Components (5 minutes)

```bash
cd /Users/fevra/Apps/kiln

# Create workers directory
mkdir -p src/workers

# Copy safe components
cp sbt01-web-spec-teleburn-full-compressor-expert/src/components/Compressor.tsx \
   src/components/wizard/Compressor.tsx

cp sbt01-web-spec-teleburn-full-compressor-expert/src/workers/encode.worker.ts \
   src/workers/encode.worker.ts

cp sbt01-web-spec-teleburn-full-compressor-expert/src/components/WalletProviders.tsx \
   src/components/WalletProviders.tsx

cp sbt01-web-spec-teleburn-full-compressor-expert/src/lib/download.ts \
   src/lib/download.ts

# Copy BTC Manifest and Pointer builders (for reference)
cp sbt01-web-spec-teleburn-full-compressor-expert/src/components/BtcManifestBuilder.tsx \
   src/components/wizard/BtcManifestBuilder.tsx.old

cp sbt01-web-spec-teleburn-full-compressor-expert/src/components/PointerBuilder.tsx \
   src/components/wizard/PointerBuilder.tsx.old
```

### Step 2: Update Imports (10 minutes)

Update the copied files to use our Phase 1 imports:

```typescript
// OLD (in old code)
import { deriveTeleburnAddress } from '@/lib/teleburn'

// NEW (use our Phase 1 code)
import { deriveOwner } from '@/lib/derived-owner'
```

### Step 3: Create Transaction Builders (Phase 2)

**Don't copy the old transaction builders**. Instead, create new ones using:
- ✅ Our Phase 1 types
- ✅ Our Zod schemas
- ✅ Timestamp service
- ✅ Inscription verifier

Files to create:
1. `src/lib/transaction-builder.ts` - NEW (use old as reference)
2. `src/app/api/tx/seal/route.ts` - NEW (with validation)
3. `src/app/api/tx/retire/route.ts` - NEW (with validation)

### Step 4: Update Dependencies (5 minutes)

The old code uses older versions. Update `package.json`:

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.87.6",           // ✅ Keep (same)
    "@solana/spl-token": "^0.3.11",         // ⚠️ Update from 0.4.6
    "@metaplex-foundation/mpl-token-metadata": "^3.2.1",  // ⚠️ Update from 2.10.6
    "@jsquash/avif": "^1.4.0",              // ⚠️ Update from 1.2.0
    "@jsquash/webp": "^1.4.0",              // ⚠️ Update from 1.2.0
    "web3.storage": "^4.5.6"                // ✅ Add (not in our package.json)
  }
}
```

### Step 5: Test Integration (10 minutes)

```bash
# Type check
pnpm type-check

# Should have some errors - fix them by updating imports

# Run tests
pnpm test

# Start dev server
pnpm dev
```

---

## ⚠️ Important Warnings

### 1. Don't Use Old Derived Address
```typescript
// ❌ OLD - Wrong domain
export async function deriveTeleburnAddress(id: string): Promise<PublicKey> {
  const salt = new TextEncoder().encode('SBT01:solana:v1') // OLD DOMAIN
  // ...
}

// ✅ NEW - Use our Phase 1
import { deriveOwner } from '@/lib/derived-owner'
const { publicKey, bump } = deriveOwner(inscriptionId)
```

### 2. Don't Skip Inscription Verification
```typescript
// ❌ OLD - No verification
const tx = await buildSealTx(conn, payer, memo)

// ✅ NEW - Verify first
const verification = await InscriptionVerifier.verify(inscriptionId, sha256)
if (!verification.valid) {
  throw new Error('Inscription verification failed')
}
const tx = await buildSealTx(conn, payer, memo)
```

### 3. Don't Skip Zod Validation
```typescript
// ❌ OLD - Manual checks
if (!feePayer || !mint) return NextResponse.json({ error: '...' })

// ✅ NEW - Zod validation
const validated = SealTransactionRequestSchema.parse(await req.json())
```

---

## 📋 Component Comparison

### Compressor Component

**Old Code Strengths**:
- ✅ Full-featured compression
- ✅ Side-by-side comparison
- ✅ PSNR quality metric
- ✅ Fee estimation
- ✅ Web Worker (non-blocking)

**What to Add**:
- ⚠️ Integration with our wizard flow
- ⚠️ SHA-256 computation during compression
- ⚠️ Connection to inscription verifier

### Transaction Builders

**Old Code Strengths**:
- ✅ All 3 retire methods (burn, incinerate, derived)
- ✅ Token-2022 support detection
- ✅ ATA creation

**What to Update**:
- ❌ Add timestamp/block_height to memos
- ❌ Use v0.1.1 memo format
- ❌ Use new domain string
- ❌ Add Zod validation
- ❌ Add inscription verification gate

### Verify Endpoint

**Old Code Strengths**:
- ✅ Checks all 3 methods (derived, incinerated, burned)
- ✅ Fallback RPC support

**What to Add**:
- ❌ Confidence scoring
- ❌ Memo parsing from transaction history
- ❌ Multi-RPC cross-validation
- ❌ Comprehensive result object

---

## 🎯 Recommended Approach

### Phase 2A: Extract UI Components (Now)

1. ✅ Copy Compressor component
2. ✅ Copy Worker
3. ✅ Copy WalletProviders
4. ✅ Copy download helper
5. ✅ Copy Pointer/Manifest builders (as reference)

### Phase 2B: Build Transaction Infrastructure (Next)

1. ❌ Don't copy old transaction builders
2. ✅ Create NEW transaction-builder.ts using:
   - Our derived-owner.ts
   - Our schemas.ts
   - Our timestamp service
3. ✅ Create API routes with:
   - Zod validation
   - Inscription verification
   - Timestamp anchoring

### Phase 2C: Enhance Verification (Later)

1. ✅ Use old verify logic as template
2. ✅ Add our confidence scoring
3. ✅ Add memo parsing
4. ✅ Integrate with our multi-RPC verifier

---

## 🧪 Testing Strategy

### Test Old Components

```bash
# After copying Compressor
pnpm test src/components/wizard/Compressor.test.tsx

# After copying Worker
# Test in browser (workers need DOM)
pnpm dev
```

### Test New Integrations

```bash
# After creating transaction builders
pnpm test src/lib/transaction-builder.test.ts

# After creating API routes
pnpm test tests/integration/api-routes.test.ts
```

---

## 📊 Migration Checklist

### Before Migration

- [x] Phase 1 complete
- [x] All Phase 1 tests passing
- [x] Type checking clean

### During Migration

- [ ] Copy safe components (Compressor, Worker, etc.)
- [ ] Update imports to use Phase 1 code
- [ ] Add missing dependencies (web3.storage, etc.)
- [ ] Fix type errors
- [ ] Update old domain strings
- [ ] Add Zod validation

### After Migration

- [ ] All tests passing
- [ ] Type checking clean
- [ ] Compressor works in browser
- [ ] Worker compression works
- [ ] No console errors

---

## 💡 Quick Commands

```bash
# See what's in old code
ls -la sbt01-web-spec-teleburn-full-compressor-expert/src

# Compare dependencies
diff package.json sbt01-web-spec-teleburn-full-compressor-expert/package.json

# Search for old domain usage
grep -r "SBT01:solana:v1" sbt01-web-spec-teleburn-full-compressor-expert/

# Search for old version
grep -r '"version":"0.1"' sbt01-web-spec-teleburn-full-compressor-expert/

# Count lines of code
find sbt01-web-spec-teleburn-full-compressor-expert/src -name "*.ts" -o -name "*.tsx" | xargs wc -l
```

---

## 🎉 Summary

**What to Use**:
- ✅ Compressor component (excellent quality)
- ✅ Web Worker (production-ready)
- ✅ Wallet providers (standard setup)
- ✅ UI structure (good patterns)

**What to Update**:
- ⚠️ All transaction builders (add timestamps)
- ⚠️ All memos (v0.1.1 format)
- ⚠️ Derived address (new domain)
- ⚠️ API routes (add validation)

**What to Replace**:
- ❌ Old teleburn.ts library
- ❌ Old verification without confidence
- ❌ Manual validation (use Zod)

**Estimated Integration Time**: 2-3 hours for safe components, 1-2 days for full Phase 2

---

*Generated: October 20, 2025*  
*Status: Ready for integration*

