# Migration Guide: derived-owner.ts → teleburn.ts

**Date:** October 23, 2025  
**Status:** ⚠️ Action Required

---

## Overview

We've standardized on a **simpler, cleaner teleburn derivation algorithm** implemented in `src/lib/teleburn.ts`. The old `src/lib/derived-owner.ts` used a different preimage order and is now **deprecated**.

### Why Migrate?

1. **Simpler algorithm** - Matches Ethereum pattern more closely
2. **Better documentation** - Comprehensive algorithm specification
3. **Improved testing** - 78 unit tests with edge case coverage
4. **Cross-chain consistency** - Clearer relationship to Ethereum teleburn

---

## Key Differences

### Old Implementation (`derived-owner.ts`)

```typescript
// Preimage order: domain || txid || index || bump
const preimage = Buffer.concat([
  domainBytes,  // "ordinals.teleburn.sbt01.v1"
  txid,         // 32 bytes
  indexBytes,   // 4 bytes
  bumpBytes     // 1 byte
]);

const candidateBytes = Buffer.from(sha256(preimage));
```

### New Implementation (`teleburn.ts`)

```typescript
// Preimage order: txid || index || salt
const preimage = new Uint8Array(32 + 4 + salt.length);
preimage.set(txid, 0);           // 32 bytes
dataView.setUint32(32, index, false);  // 4 bytes (big-endian)
preimage.set(salt, 36);          // "SBT01:solana:v1"

const candidate = await sha256Async(preimage);
```

### Impact

⚠️ **IMPORTANT:** Different preimage order → **different addresses** for same inscription ID!

- Old: `domain || txid || index || bump`
- New: `txid || index || salt`

If you've already deployed with the old algorithm, existing derived addresses will be different.

---

## Migration Steps

### Step 1: Update Imports

**Before:**
```typescript
import { deriveOwner } from '@/lib/derived-owner';

const { publicKey, bump } = deriveOwner(inscriptionId);
```

**After:**
```typescript
import { deriveTeleburnAddress } from '@/lib/teleburn';

const publicKey = await deriveTeleburnAddress(inscriptionId);
```

### Step 2: Update Function Calls

The new API is `async` and returns only the `PublicKey` (no `bump` field needed).

**Before:**
```typescript
const result = deriveOwner('abc...i0');
console.log('Address:', result.publicKey.toBase58());
console.log('Bump:', result.bump);
```

**After:**
```typescript
const address = await deriveTeleburnAddress('abc...i0');
console.log('Address:', address.toBase58());
// No bump - iteration count not exposed (implementation detail)
```

### Step 3: Update Transaction Builder Usage

**Before:**
```typescript
// transaction-builder.ts
const { publicKey: derivedOwner, bump } = deriveOwner(inscriptionId);
retireMemo.derived = { bump };
```

**After:**
```typescript
// transaction-builder.ts  
const derivedOwner = await deriveTeleburnAddress(inscriptionId);
retireMemo.derived = { 
  owner: derivedOwner.toBase58(),
  algorithm: 'SHA-256(txid || index || salt)'
};
```

### Step 4: Update Tests

**Before:**
```typescript
import { deriveOwner } from '@/lib/derived-owner';

describe('Derivation', () => {
  it('derives address', () => {
    const result = deriveOwner('abc...i0');
    expect(result.bump).toBeGreaterThanOrEqual(0);
  });
});
```

**After:**
```typescript
import { deriveTeleburnAddress } from '@/lib/teleburn';

describe('Derivation', () => {
  it('derives address', async () => {
    const address = await deriveTeleburnAddress('abc...i0');
    expect(address).toBeInstanceOf(PublicKey);
  });
});
```

### Step 5: Verification

After migration, verify the new implementation:

```bash
# Run teleburn tests
pnpm test teleburn.test.ts

# Verify specific inscription ID
node -e "
import('@/lib/teleburn').then(async ({ deriveTeleburnAddress }) => {
  const addr = await deriveTeleburnAddress('YOUR_INSCRIPTION_ID_HERE');
  console.log('New address:', addr.toBase58());
});
"
```

---

## API Comparison

| Feature | `derived-owner.ts` (Old) | `teleburn.ts` (New) |
|---------|-------------------------|---------------------|
| Function | `deriveOwner(id, bump?)` | `deriveTeleburnAddress(id)` |
| Async | ❌ No | ✅ Yes |
| Returns | `{ publicKey, bump }` | `PublicKey` |
| Bump exposed | ✅ Yes | ❌ No (internal) |
| Verification | `verifyDerivedOwner()` | `verifyTeleburnAddress()` |
| Batch | `deriveBatch()` | `deriveTeleburnAddressBatch()` |
| Domain | `'ordinals.teleburn.sbt01.v1'` | `'SBT01:solana:v1'` |

---

## Breaking Changes

### 1. Async Function

Old API was synchronous, new API is `async`:

```typescript
// Old (sync)
const result = deriveOwner(id);

// New (async)
const address = await deriveTeleburnAddress(id);
```

### 2. No Bump Field

The `bump` value is no longer exposed (implementation detail):

```typescript
// Old
const { publicKey, bump } = deriveOwner(id);
console.log('Bump:', bump);

// New
const address = await deriveTeleburnAddress(id);
// No bump - internal iteration count not exposed
```

### 3. Different Addresses

⚠️ **Critical:** Same inscription ID produces **different addresses**!

```typescript
// Example inscription: abc...i0

// Old algorithm
const old = deriveOwner('abc...i0');
// Address: 7xKXy9H8P3ZYQEXxf5...

// New algorithm  
const new = await deriveTeleburnAddress('abc...i0');
// Address: 9mPqZvW2nJKLMRtuYh... (DIFFERENT!)
```

If you need to maintain compatibility with old addresses, **do not migrate**.

---

## Backward Compatibility

### Option 1: Fresh Start (Recommended)

If you haven't deployed to mainnet yet:

- ✅ Migrate to new implementation
- ✅ Use new addresses going forward
- ✅ Update all documentation

### Option 2: Maintain Old Addresses

If you've already deployed with old algorithm:

- ❌ **Do not migrate** - addresses would change
- Keep using `derived-owner.ts`
- Document your specific implementation
- Consider aliasing for clarity:

```typescript
// Keep old implementation for backward compat
import { deriveOwner as deriveOwnerLegacy } from '@/lib/derived-owner-legacy';
```

### Option 3: Dual Support (Advanced)

Support both old and new addresses:

```typescript
// Detect which algorithm was used
async function getDerivedAddress(inscriptionId: string, version: 'v1' | 'v2') {
  if (version === 'v1') {
    // Old algorithm
    const { publicKey } = deriveOwner(inscriptionId);
    return publicKey;
  } else {
    // New algorithm
    return await deriveTeleburnAddress(inscriptionId);
  }
}
```

---

## Checklist

- [ ] Update imports: `derived-owner` → `teleburn`
- [ ] Add `await` to all derivation calls
- [ ] Remove `bump` field references
- [ ] Update memo payloads (remove bump, add algorithm)
- [ ] Update tests (add `async`)
- [ ] Run test suite: `pnpm test teleburn.test.ts`
- [ ] Update documentation
- [ ] Verify addresses match expectations
- [ ] Deploy with confidence! ✨

---

## Need Help?

**Questions?** Open a GitHub issue or contact the team.

**Found a bug?** Please report with:
- Inscription ID
- Expected vs actual address
- Algorithm version (old vs new)

---

## Timeline

- **Oct 23, 2025**: New `teleburn.ts` implementation released
- **Nov 1, 2025**: Migration guide published (this document)
- **Dec 1, 2025**: `derived-owner.ts` marked as deprecated
- **Jan 1, 2026**: `derived-owner.ts` removed from codebase

---

## Summary

| Action | Timeline | Status |
|--------|----------|--------|
| New implementation available | ✅ Now | Complete |
| Migration guide | ✅ Now | Complete |
| Deprecation warning | 🔜 Dec 1 | Pending |
| Removal of old code | ⏳ Jan 1 | Scheduled |

**Recommendation:** Migrate now if possible, or maintain old implementation with clear documentation.

