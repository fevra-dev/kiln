# Salt Migration Guide: Changing from SBT01 to Kiln

**Version:** 1.0  
**Last Updated:** 2024

---

## Overview

This guide explains how to change the domain separation salt from `"SBT01:solana:v1"` to use "Kiln" branding instead.

**⚠️ CRITICAL WARNING:** Changing the salt value will produce **completely different addresses** for the same inscription ID. This means:
- ✅ New burns will use new addresses
- ❌ Existing burns cannot be verified with new salt
- ⚠️ You may need to support both versions

---

## Difficulty Assessment

### Difficulty Level: **EASY** ⭐⭐☆☆☆ (2/5)

Changing the salt value is **technically very easy** - it's just updating a constant. However, you need to consider:
- Backward compatibility
- Testing
- Documentation updates

---

## Step-by-Step Migration

### Step 1: Choose New Salt Value

**Options:**

1. **`kiln:solana:v1`** (Recommended - short and clear)
   - Length: 15 bytes
   - Format: Simple and readable

2. **`kiln.teleburn.solana.v1`** (More descriptive)
   - Length: 24 bytes
   - Format: Reverse-domain notation

3. **`ordinals.teleburn.kiln.v1`** (Most descriptive)
   - Length: 27 bytes
   - Format: Full protocol path

**Recommendation:** Use `kiln:solana:v1` - it's short, clear, and follows the existing format pattern.

---

### Step 2: Update Code

#### File: `src/lib/teleburn.ts`

**Current:**
```typescript
export const TELEBURN_DOMAIN = 'SBT01:solana:v1';
```

**New:**
```typescript
export const TELEBURN_DOMAIN = 'kiln:solana:v1';
```

That's it! The constant is used automatically throughout the codebase.

---

### Step 3: Update Tests

#### File: `tests/unit/teleburn.test.ts`

**Update test assertions:**

**Line 167 - Domain check:**
```typescript
// OLD:
expect(TELEBURN_DOMAIN).toBe('SBT01:solana:v1');

// NEW:
expect(TELEBURN_DOMAIN).toBe('kiln:solana:v1');
```

**Lines 376-378 - Domain content checks:**
```typescript
// OLD:
expect(TELEBURN_DOMAIN).toContain('SBT01');
expect(TELEBURN_DOMAIN).toContain('solana');
expect(TELEBURN_DOMAIN).toContain('v1');

// NEW:
expect(TELEBURN_DOMAIN).toContain('kiln');
expect(TELEBURN_DOMAIN).toContain('solana');
expect(TELEBURN_DOMAIN).toContain('v1');
```

**Note:** Test vectors will produce different addresses with new salt - this is expected!

---

### Step 4: Update Documentation

Update all references to the salt value:

1. **`public/docs/TELEBURN_ALGORITHM.md`**
   - Update all `"SBT01:solana:v1"` references
   - Update comparison tables

2. **`public/README.md`**
   - Update salt references

3. **`public/docs/SALT_AND_DOMAIN_SEPARATION.md`**
   - Update examples to use new salt

4. **Code comments**
   - Update JSDoc comments in `src/lib/teleburn.ts`

---

### Step 5: Update Test Vectors (If Any)

If you have hardcoded test addresses that were derived with the old salt, you'll need to:
1. Re-derive them with the new salt
2. Update test expectations
3. Document the change

**Example:**
```typescript
// OLD test vector (with SBT01 salt):
const oldAddress = '7xKXy...'; // Derived with SBT01:solana:v1

// NEW test vector (with Kiln salt):
const newAddress = '9mPqZ...'; // Derived with kiln:solana:v1
```

---

## Files That Need Updates

### Core Code (1 file)
- ✅ `src/lib/teleburn.ts` - Update constant

### Tests (1 file)
- ✅ `tests/unit/teleburn.test.ts` - Update assertions

### Documentation (4+ files)
- ✅ `public/docs/TELEBURN_ALGORITHM.md`
- ✅ `public/README.md`
- ✅ `public/docs/SALT_AND_DOMAIN_SEPARATION.md`
- ✅ Code comments/JSDoc

**Total Files to Update:** ~6-7 files

**Estimated Time:** 15-30 minutes

---

## Backward Compatibility Considerations

### Option A: Clean Break (Recommended for New Projects)

If you haven't deployed to mainnet yet or have very few existing burns:

1. ✅ Change salt to new value
2. ✅ Update all code and docs
3. ✅ Document that old addresses won't work

**Pros:**
- ✅ Clean and simple
- ✅ No code complexity
- ✅ Clear migration

**Cons:**
- ❌ Existing burns can't verify with new salt
- ❌ Need to document old salt for historical verification

---

### Option B: Versioned Support (Recommended for Production)

If you have existing burns that need to be verified:

1. ✅ Keep old salt as `TELEBURN_DOMAIN_V1`
2. ✅ Add new salt as `TELEBURN_DOMAIN_V2`
3. ✅ Support both in verification functions
4. ✅ Use new salt for all new burns

**Implementation:**

```typescript
// src/lib/teleburn.ts

/** Legacy domain separator (v1) */
export const TELEBURN_DOMAIN_V1 = 'SBT01:solana:v1';

/** Current domain separator (v2) */
export const TELEBURN_DOMAIN_V2 = 'kiln:solana:v1';

/** Active domain separator */
export const TELEBURN_DOMAIN = TELEBURN_DOMAIN_V2;

/**
 * Derive teleburn address (supports multiple versions)
 */
export async function deriveTeleburnAddress(
  id: string,
  version: 'v1' | 'v2' = 'v2'
): Promise<PublicKey> {
  const domain = version === 'v1' ? TELEBURN_DOMAIN_V1 : TELEBURN_DOMAIN_V2;
  // ... rest of implementation
}

/**
 * Try to verify burn with any supported salt version
 */
export async function verifyTeleburnAddress(
  id: string,
  expectedAddress: PublicKey
): Promise<{ valid: boolean; version: 'v1' | 'v2' | null }> {
  // Try v2 first (new)
  const v2Address = await deriveTeleburnAddress(id, 'v2');
  if (v2Address.equals(expectedAddress)) {
    return { valid: true, version: 'v2' };
  }
  
  // Try v1 (legacy)
  const v1Address = await deriveTeleburnAddress(id, 'v1');
  if (v1Address.equals(expectedAddress)) {
    return { valid: true, version: 'v1' };
  }
  
  return { valid: false, version: null };
}
```

**Pros:**
- ✅ Backward compatible
- ✅ Can verify old burns
- ✅ Smooth migration

**Cons:**
- ⚠️ Slightly more complex code
- ⚠️ Need to test both versions

---

## Migration Checklist

### Pre-Migration

- [ ] Decide on new salt value (`kiln:solana:v1` recommended)
- [ ] Check if you have existing burns that need verification
- [ ] Choose migration strategy (clean break vs versioned)
- [ ] Review all code references to salt

### Code Changes

- [ ] Update `TELEBURN_DOMAIN` constant in `src/lib/teleburn.ts`
- [ ] Update test assertions in `tests/unit/teleburn.test.ts`
- [ ] Update test vectors (if any)
- [ ] Run full test suite

### Documentation

- [ ] Update `TELEBURN_ALGORITHM.md`
- [ ] Update `README.md`
- [ ] Update `SALT_AND_DOMAIN_SEPARATION.md`
- [ ] Update code comments/JSDoc

### Testing

- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Verify new addresses are derived correctly
- [ ] Test backward compatibility (if versioned)

### Deployment

- [ ] Update version number (if needed)
- [ ] Create migration notes in CHANGELOG
- [ ] Deploy to testnet first
- [ ] Verify on testnet
- [ ] Deploy to mainnet

---

## Example: Complete Code Change

Here's a complete example of changing from `SBT01:solana:v1` to `kiln:solana:v1`:

### Before

```typescript
// src/lib/teleburn.ts
export const TELEBURN_DOMAIN = 'SBT01:solana:v1';
```

```typescript
// tests/unit/teleburn.test.ts
expect(TELEBURN_DOMAIN).toBe('SBT01:solana:v1');
expect(TELEBURN_DOMAIN).toContain('SBT01');
```

### After

```typescript
// src/lib/teleburn.ts
export const TELEBURN_DOMAIN = 'kiln:solana:v1';
```

```typescript
// tests/unit/teleburn.test.ts
expect(TELEBURN_DOMAIN).toBe('kiln:solana:v1');
expect(TELEBURN_DOMAIN).toContain('kiln');
```

**That's literally it!** The algorithm automatically uses the new constant.

---

## Impact Analysis

### What Changes

| Aspect | Impact |
|--------|--------|
| **New addresses** | ✅ Different addresses for same inscription ID |
| **Algorithm** | ✅ No change - same logic |
| **Performance** | ✅ No change - same speed |
| **Security** | ✅ No change - same security |

### What Stays the Same

- ✅ Algorithm logic (still SHA-256 + off-curve)
- ✅ Performance characteristics
- ✅ Security properties
- ✅ Code structure
- ✅ API surface

### Breaking Changes

- ❌ **Address incompatibility**: Old addresses won't match new addresses
- ❌ **Verification**: Can't verify old burns with new salt (unless versioned)

---

## Recommendation

### For New Projects / Testnet

**Go with Option A (Clean Break):**
1. Change to `kiln:solana:v1`
2. Update all code and docs
3. Done!

**Effort:** ⭐⭐☆☆☆ (Easy - 15-30 minutes)

---

### For Production / Mainnet

**Go with Option B (Versioned Support):**
1. Add versioned salt constants
2. Support both in verification
3. Use new salt for all new burns
4. Can verify old burns

**Effort:** ⭐⭐⭐☆☆ (Moderate - 1-2 hours)

---

## Summary

**Difficulty:** ⭐⭐☆☆☆ (Easy)

**Effort:**
- Clean break: 15-30 minutes
- Versioned support: 1-2 hours

**Key Points:**
1. ✅ Changing the salt is just updating one constant
2. ⚠️ But addresses will be completely different
3. ⚠️ Consider backward compatibility
4. ✅ Recommend: `kiln:solana:v1` as new value

**Next Steps:**
1. Decide on new salt value
2. Choose migration strategy
3. Follow checklist above

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** Kiln Development Team

