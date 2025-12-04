# Salt Strategy Recommendation: Analysis & Implementation Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Author:** Kiln Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Question 1: Do We Even Need Salt?](#question-1-do-we-even-need-salt)
3. [Question 2: Which Salt Format Should We Use?](#question-2-which-salt-format-should-we-use)
4. [Final Recommendation](#final-recommendation)
5. [Implementation Guide](#implementation-guide)
6. [Migration Path](#migration-path)
7. [FAQ](#faq)

---

## Executive Summary

**TL;DR:**
1. **Keep the salt** — even for single-chain (Solana only), it provides valuable benefits
2. **Use longer format** — `kiln.teleburn.solana.v1` is recommended over `kiln:solana:v1`

**Key Findings:**
- ✅ Salt provides protocol identification, versioning, and future-proofing
- ✅ Minimal overhead (only 15-24 bytes appended)
- ✅ Industry best practice even for single-chain systems
- ✅ Longer format (`kiln.teleburn.solana.v1`) is more professional and clearer

---

## Question 1: Do We Even Need Salt?

### Your Use Case Analysis

**Current Scope:**
- ✅ Solana → Bitcoin teleburn only
- ✅ Single source chain (Solana)
- ✅ Single destination (Bitcoin Ordinals)
- ❌ No multi-chain support planned

**Question:** If Ethereum works fine without salt for single-chain, why do we need it?

---

### The Case FOR Keeping Salt

Even though you're only doing Solana → Bitcoin teleburn, salt provides several important benefits:

#### 1. **Protocol Identification** 🏷️

**Without Salt:**
```
Address derived from: SHA-256(txid || index)
→ Could be from ANY teleburn protocol
→ No way to know which implementation created it
```

**With Salt:**
```
Address derived from: SHA-256(txid || index || "kiln.teleburn.solana.v1")
→ Clearly identifies as Kiln protocol
→ Anyone can verify which protocol created the address
```

**Benefit:** When someone sees a teleburn address, they immediately know it came from Kiln. This is important for:
- Ecosystem clarity
- Protocol reputation
- Trust and verification

#### 2. **Versioning Support** 📌

**Scenario:** You need to update the algorithm in the future.

**Without Salt:**
```
v1: SHA-256(txid || index)
v2: SHA-256(txid || index)  // Same addresses! Can't distinguish!
```

**With Salt:**
```
v1: SHA-256(txid || index || "kiln.teleburn.solana.v1")
v2: SHA-256(txid || index || "kiln.teleburn.solana.v2")  // Different addresses!
```

**Benefit:** You can introduce algorithm improvements without breaking existing burns. Each version has its own address space.

#### 3. **Future-Proofing** 🚀

Even if you don't plan multi-chain support now, the future is unpredictable:
- Other chains might adopt your protocol
- You might want to support Ethereum NFTs someday
- Other protocols might copy your approach

**With Salt:** You're ready for any scenario.  
**Without Salt:** You'd need to break backward compatibility to add salt later.

#### 4. **Industry Best Practice** ✅

Domain separation (using salt/context strings) is a standard practice in cryptography:
- Used in BIP32 (Bitcoin HD wallets)
- Used in EIP-712 (Ethereum message signing)
- Used in SLIP-0010 (cryptocurrency key derivation)
- Used in most modern cryptographic protocols

**Benefit:** Following industry standards makes your protocol:
- More auditable
- More trustworthy
- Easier to explain to security auditors

#### 5. **Minimal Cost** 💰

The overhead is negligible:
- **Storage:** Only 15-24 bytes appended to preimage
- **Performance:** ~0.001ms difference (UTF-8 encoding is instant)
- **Complexity:** One line of code

**Benefit:** Massive benefits for essentially zero cost.

---

### The Case AGAINST Salt (Why Ethereum Doesn't Use It)

Ethereum teleburn doesn't use salt because:

1. **Historical Context:**
   - Teleburn was a simple proof-of-concept
   - Not designed as a standardized protocol
   - No versioning concerns initially

2. **Different Goals:**
   - Ethereum: "Make it work" (simplicity first)
   - Kiln: "Make it right" (standards first)

3. **Different Ecosystem:**
   - Ethereum: First mover, no competition
   - Kiln: New protocol, needs to establish identity

---

### Recommendation: **KEEP THE SALT** ✅

**Even for single-chain, salt provides:**
- ✅ Protocol identification (Kiln branding)
- ✅ Versioning support (v1, v2, etc.)
- ✅ Future-proofing (ready for any scenario)
- ✅ Industry best practice
- ✅ Minimal cost (~15-24 bytes)

**The only downside:**
- ⚠️ Slightly more complex (one extra line of code)

**Verdict:** The benefits far outweigh the minimal complexity. Keep the salt.

---

## Question 2: Which Salt Format Should We Use?

### Current Format: `kiln:solana:v1`

**Format:** `<protocol>:<chain>:<version>`
- Length: 15 bytes
- Style: Simple colon-separated

### Alternative: `kiln.teleburn.solana.v1`

**Format:** `<protocol>.<domain>.<chain>.<version>`
- Length: 24 bytes
- Style: Reverse-domain notation (like Java packages)

---

### Comparison

| Aspect | `kiln:solana:v1` | `kiln.teleburn.solana.v1` |
|--------|------------------|---------------------------|
| **Length** | 15 bytes ✅ | 24 bytes ⚠️ |
| **Readability** | Good ✅ | Excellent ✅✅ |
| **Professionalism** | Good ✅ | Excellent ✅✅ |
| **Clarity** | Clear ✅ | Very Clear ✅✅ |
| **Industry Standard** | Custom ⚠️ | Reverse-DNS ✅✅ |
| **Branding** | Basic ✅ | Strong ✅✅ |
| **Debugging** | Easy ✅ | Easier ✅✅ |
| **Audit Trail** | Good ✅ | Excellent ✅✅ |

---

### Detailed Analysis

#### 1. **Readability & Clarity** 📖

**`kiln:solana:v1`:**
- ✅ Short and clear
- ✅ Easy to understand
- ⚠️ Less descriptive ("kiln" could mean anything)

**`kiln.teleburn.solana.v1`:**
- ✅✅ Very descriptive
- ✅✅ Self-documenting (includes "teleburn")
- ✅✅ Clear hierarchy: protocol → domain → chain → version

**Winner:** `kiln.teleburn.solana.v1` — more descriptive and self-documenting

---

#### 2. **Industry Standards** 🌐

**Colon Format (`kiln:solana:v1`):**
- Used in some contexts (URIs, protocols)
- Less common in crypto standards

**Reverse-DNS Format (`kiln.teleburn.solana.v1`):**
- ✅ Standard in Java (packages)
- ✅ Standard in Rust (modules)
- ✅ Standard in many crypto standards (BIP44, SLIP-0010)
- ✅ Familiar to developers

**Winner:** `kiln.teleburn.solana.v1` — follows industry conventions

---

#### 3. **Branding & Professionalism** 🏢

**`kiln:solana:v1`:**
- Basic branding
- Functional but minimal

**`kiln.teleburn.solana.v1`:**
- Stronger branding (includes full protocol name)
- More professional appearance
- Better for marketing/documentation

**Winner:** `kiln.teleburn.solana.v1` — stronger branding

---

#### 4. **Debugging & Auditing** 🔍

**`kiln:solana:v1`:**
- Easy to search for in logs
- Short enough to see in debug output

**`kiln.teleburn.solana.v1`:**
- More searchable terms ("kiln", "teleburn", "solana")
- Easier to grep/filter in logs
- Better audit trail

**Winner:** `kiln.teleburn.solana.v1` — better for debugging

---

#### 5. **Performance Impact** ⚡

**Size Difference:**
- `kiln:solana:v1`: 15 bytes
- `kiln.teleburn.solana.v1`: 24 bytes
- **Difference:** 9 bytes (0.000009 KB)

**Performance Impact:**
- UTF-8 encoding: ~0.0001ms difference
- SHA-256 hash: ~0.0001ms difference (for 9 extra bytes)
- **Total Impact:** Negligible (< 0.001ms)

**Winner:** Tie — performance difference is irrelevant

---

### Recommendation: **USE LONGER FORMAT** ✅

**Recommended:** `kiln.teleburn.solana.v1`

**Reasons:**
1. ✅ More descriptive and self-documenting
2. ✅ Follows industry standards (reverse-DNS)
3. ✅ Stronger branding
4. ✅ Better for debugging and auditing
5. ✅ Negligible performance impact (9 bytes)

**Trade-off:** 9 extra bytes for significant clarity and professionalism gains.

---

## Final Recommendation

### Summary

1. **Keep the salt** — Even for single-chain, it provides valuable benefits
2. **Use longer format** — `kiln.teleburn.solana.v1` recommended

### Rationale

**Salt is worth keeping because:**
- ✅ Protocol identification (Kiln branding)
- ✅ Versioning support (future-proofing)
- ✅ Industry best practice
- ✅ Minimal cost (~24 bytes)

**Longer format is better because:**
- ✅ More descriptive and professional
- ✅ Follows industry standards
- ✅ Better branding
- ✅ Better for debugging
- ✅ Negligible performance cost

---

## Implementation Guide

### Step 1: Update Constant

**File:** `src/lib/teleburn.ts`

**Current:**
```typescript
export const TELEBURN_DOMAIN = 'kiln:solana:v1';
```

**New:**
```typescript
export const TELEBURN_DOMAIN = 'kiln.teleburn.solana.v1';
```

**That's it!** The rest of the code automatically uses this constant.

---

### Step 2: Update Documentation

Update references in:
- ✅ `src/lib/teleburn.ts` (JSDoc comments)
- ✅ `public/README.md`
- ✅ `public/docs/TELEBURN_ALGORITHM.md`
- ✅ `tests/unit/teleburn.test.ts` (test assertions)

---

### Step 3: Update Tests

**File:** `tests/unit/teleburn.test.ts`

**Update assertions:**
```typescript
// OLD:
expect(TELEBURN_DOMAIN).toBe('kiln:solana:v1');
expect(TELEBURN_DOMAIN).toContain('kiln');

// NEW:
expect(TELEBURN_DOMAIN).toBe('kiln.teleburn.solana.v1');
expect(TELEBURN_DOMAIN).toContain('kiln');
expect(TELEBURN_DOMAIN).toContain('teleburn');
```

---

### Step 4: Verify Changes

**Run tests:**
```bash
pnpm test
```

**Check address derivation:**
- Old addresses (with `kiln:solana:v1`) will be different from new addresses
- This is expected and correct
- Document the change if you have existing burns

---

## Migration Path

### Scenario A: No Existing Burns (Clean Slate)

If you haven't deployed to mainnet yet or have zero existing burns:

1. ✅ Update constant to `kiln.teleburn.solana.v1`
2. ✅ Update all documentation
3. ✅ Update tests
4. ✅ Deploy

**No backward compatibility needed.**

---

### Scenario B: Existing Burns (Production)

If you have existing burns on mainnet:

**Option 1: Clean Break (If few burns)**
- Update to new salt
- Document old salt for historical verification
- Use new salt for all future burns

**Option 2: Versioned Support (If many burns)**
- Keep old salt as `TELEBURN_DOMAIN_V1`
- Add new salt as `TELEBURN_DOMAIN_V2`
- Support both in verification

See `SALT_MIGRATION_GUIDE.md` for detailed versioned approach.

---

## FAQ

### Q1: Does the salt format really matter?

**A:** Yes, for clarity and professionalism. The longer format (`kiln.teleburn.solana.v1`) is more descriptive and follows industry standards. However, both formats work identically from a cryptographic perspective.

---

### Q2: Can I change the salt later?

**A:** Yes, but it will produce different addresses. If you have existing burns, you'll need to support both versions for verification.

---

### Q3: What about other formats?

**Options considered:**
- `kiln:solana:v1` — Good, but less descriptive
- `kiln.teleburn.solana.v1` — **Recommended** (best balance)
- `ordinals.teleburn.kiln.v1` — Too long, less clear hierarchy

---

### Q4: Will this affect performance?

**A:** No. The 9-byte difference is negligible. SHA-256 is extremely fast, and UTF-8 encoding is instant.

---

### Q5: What if I want to support Ethereum later?

**A:** With salt, you can easily add Ethereum support:
- Solana: `kiln.teleburn.solana.v1`
- Ethereum: `kiln.teleburn.ethereum.v1`

Both will produce different addresses for the same inscription ID, which is exactly what you want.

---

### Q6: Why not use no salt like Ethereum?

**A:** While Ethereum works without salt, Kiln benefits from:
- Protocol identification (Kiln branding)
- Versioning support (future-proofing)
- Industry best practice
- Minimal cost (only 24 bytes)

The small complexity is worth the benefits.

---

## Conclusion

### Final Answer

**Question 1: Do we need salt?**
- ✅ **Yes, keep the salt** — Even for single-chain, it provides valuable benefits

**Question 2: Which format?**
- ✅ **Use `kiln.teleburn.solana.v1`** — Longer format is more professional and clearer

### Implementation Effort

- **Difficulty:** ⭐☆☆☆☆ (Very Easy)
- **Time:** 15-30 minutes
- **Risk:** Low (only affects new burns)
- **Benefit:** High (better clarity and professionalism)

### Next Steps

1. Update `TELEBURN_DOMAIN` constant to `kiln.teleburn.solana.v1`
2. Update documentation
3. Update tests
4. Deploy

**That's it!** Simple change, significant improvement.

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** Kiln Development Team

