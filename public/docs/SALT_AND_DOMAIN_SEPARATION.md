# Domain Separation Salt: Deep Dive

**Version:** 1.0  
**Last Updated:** 2024  
**Location:** `src/lib/teleburn.ts` (constant: `TELEBURN_DOMAIN`)

---

## Table of Contents

1. [What is Domain Separation Salt?](#what-is-domain-separation-salt)
2. [Why Do We Need It?](#why-do-we-need-it)
3. [How Does It Work?](#how-does-it-work)
4. [Current Implementation](#current-implementation)
5. [Comparison: Salt vs No Salt](#comparison-salt-vs-no-salt)
6. [Alternatives to Salt](#alternatives-to-salt)
7. [Security Analysis](#security-analysis)
8. [Migration Considerations](#migration-considerations)
9. [FAQ](#faq)

---

## What is Domain Separation Salt?

**Domain separation salt** (also called a "domain separator" or "context string") is a unique string that gets added to the input data before hashing. It acts as a **namespace** or **context identifier** to ensure that the same input produces different outputs in different contexts.

### Simple Analogy

Think of it like adding a room number to a message:
- **Without salt:** "Hello" → always hashes to the same value
- **With salt:** "Hello" in "Room A" vs "Hello" in "Room B" → produces different hashes

This ensures that even if two different systems use the same input data, they'll produce completely different outputs.

### Current Salt Value

```
SBT01:solana:v1
```

**Format Breakdown:**
- `SBT01` = Protocol/Standard identifier
- `solana` = Target blockchain (Solana)
- `v1` = Algorithm version

---

## Why Do We Need It?

### 1. **Cross-Chain Collision Prevention**

**The Problem:**
When teleburning from different blockchains to Bitcoin, we want to ensure that:
- Solana teleburn addresses ≠ Ethereum teleburn addresses
- Even if they use the same Bitcoin inscription ID

**Without Salt (Like Ethereum):**
```
Ethereum: SHA-256(txid + index) → 0xe43A06530BdF8A4e067581f48Fae3b535559dA9e
Solana:   SHA-256(txid + index) → [first 32 bytes of hash]
```

If Ethereum's implementation used 32 bytes instead of 20, there's a small chance of collision! Different chains should produce different addresses for the same inscription ID.

**With Salt (Our Approach):**
```
Ethereum: SHA-256(txid + index) → Address A
Solana:   SHA-256(txid + index + "SBT01:solana:v1") → Address B
```

Now they're **guaranteed** to be different because the salt changes the hash input.

### 2. **Protocol Isolation**

If multiple teleburn protocols exist:
- Protocol A uses `"ProtocolA:solana:v1"`
- Protocol B uses `"ProtocolB:solana:v1"`

Even if both target Solana, they produce different addresses for the same inscription ID. This prevents:
- Cross-protocol confusion
- Accidental address reuse
- Verification errors

### 3. **Version Isolation**

If you need to change the algorithm:
- `v1`: Uses SHA-256(txid + index + salt)
- `v2`: Uses SHA-256(txid + index + salt + new_feature)

Different versions produce different addresses, allowing migration paths without breaking existing burns.

---

## How Does It Work?

### Technical Implementation

The salt is **concatenated** to the preimage before hashing:

```typescript
// Step 1: Parse inscription ID
txid = hex_decode("6fb976ab...")  // 32 bytes
index = 0  // 4 bytes (big-endian)

// Step 2: Add salt
salt = UTF8("SBT01:solana:v1")  // ~18 bytes

// Step 3: Construct preimage
preimage = txid || index || salt
// Layout: [32 bytes txid] [4 bytes index] [18 bytes salt]

// Step 4: Hash
hash = SHA-256(preimage)  // 32 bytes

// Step 5: Iterate until off-curve (Solana-specific)
while isOnCurve(hash):
    hash = SHA-256(hash || 0x00)
```

### Visual Flow

```
Bitcoin Inscription ID
    ↓
Parse: txid + index
    ↓
Add Salt: "SBT01:solana:v1"
    ↓
Concatenate: [txid][index][salt]
    ↓
SHA-256 Hash
    ↓
Off-curve check (Solana)
    ↓
Final Solana Address
```

---

## Current Implementation

### Code Location

**File:** `src/lib/teleburn.ts`  
**Line:** 80  
**Constant:** `TELEBURN_DOMAIN`

```typescript
/**
 * Domain separation string for teleburn address derivation
 * 
 * This prevents cross-chain collisions if the same inscription ID
 * is used on multiple chains (e.g., Solana vs Ethereum).
 * 
 * Format: <protocol>:<chain>:<version>
 */
export const TELEBURN_DOMAIN = 'SBT01:solana:v1';
```

### Usage in Algorithm

```typescript
// Step 2: Prepare domain salt (UTF-8 encoded)
const salt = new TextEncoder().encode(TELEBURN_DOMAIN);

// Step 3: Construct preimage buffer
// Layout: [txid (32 bytes)] [index (4 bytes, big-endian)] [salt]
const preimage = new Uint8Array(32 + 4 + salt.length);
preimage.set(txid, 0);
dataView.setUint32(32, index, false); // big-endian
preimage.set(salt, 36); // Append salt at offset 36
```

### Current Salt Value Analysis

**`SBT01:solana:v1`** breaks down as:
- **`SBT01`**: Protocol identifier (possibly "Solana Bitcoin Teleburn" or similar)
- **`solana`**: Target blockchain (Solana)
- **`v1`**: Algorithm version

**Byte Size:** 18 bytes (UTF-8 encoded)

---

## Comparison: Salt vs No Salt

### Ethereum Teleburn (No Salt)

```
Input:  txid (32 bytes) || index (4 bytes)
Hash:   SHA-256(input)
Output: First 20 bytes of hash
```

**Pros:**
- ✅ Simpler implementation
- ✅ Less data to process
- ✅ Faster (slightly)
- ✅ Proven in production (works for Ethereum)

**Cons:**
- ❌ No cross-chain isolation
- ❌ Could collide with other implementations
- ❌ No versioning support
- ❌ Less secure for multi-chain ecosystems

### Solana Teleburn (With Salt)

```
Input:  txid (32 bytes) || index (4 bytes) || salt (18 bytes)
Hash:   SHA-256(input)
Output: 32 bytes (off-curve Ed25519 point)
```

**Pros:**
- ✅ Cross-chain isolation guaranteed
- ✅ Protocol versioning support
- ✅ Prevents accidental collisions
- ✅ More secure for multi-chain environments
- ✅ Better for ecosystem growth

**Cons:**
- ❌ Slightly more complex
- ❌ ~18 extra bytes in preimage
- ❌ Negligible performance impact (~0.1ms)

### Security Comparison

| Aspect | No Salt (Ethereum) | With Salt (Ours) |
|--------|-------------------|------------------|
| Cross-chain safety | ❌ Weak | ✅ Strong |
| Protocol isolation | ❌ None | ✅ Yes |
| Version support | ❌ None | ✅ Yes |
| Collision resistance | ✅ Strong | ✅ Strong |
| Implementation complexity | ✅ Simple | ⚠️ Slightly complex |

---

## Alternatives to Salt

Let's explore alternative approaches to domain separation:

### Alternative 1: **Prepend Protocol Identifier**

Instead of appending salt, prepend it:

```
preimage = salt || txid || index
```

**Pros:**
- Same security properties
- Slightly different hash output (if you care about order)

**Cons:**
- No real advantage over current approach
- Less intuitive (domain should separate, not prefix)

**Verdict:** ⚠️ Similar to current, no benefit

---

### Alternative 2: **No Salt (Like Ethereum)**

Remove salt entirely:

```
preimage = txid || index
hash = SHA-256(preimage)
```

**Pros:**
- ✅ Simpler
- ✅ Proven (Ethereum uses this)
- ✅ Slightly faster
- ✅ Less data

**Cons:**
- ❌ No cross-chain isolation
- ❌ Could collide with Ethereum if output size matched
- ❌ No versioning support
- ❌ Risk in multi-chain ecosystem

**Security Assessment:**
- **For single-chain:** Safe (like Ethereum)
- **For multi-chain:** Risky (collision potential)

**Verdict:** ⚠️ Only acceptable if you're sure you'll never support other chains

---

### Alternative 3: **Chain-Specific Magic Bytes**

Use fixed byte sequences instead of text:

```
salt = [0x53, 0x42, 0x54, 0x30, 0x31, ...]  // "SBT01" as bytes
```

**Pros:**
- ✅ Fixed size (no UTF-8 encoding)
- ✅ Slightly faster (no encoding step)

**Cons:**
- ❌ Less readable
- ❌ Harder to debug
- ❌ No meaningful advantage

**Verdict:** ⚠️ Not recommended (readability > micro-optimization)

---

### Alternative 4: **HMAC with Protocol Key**

Use HMAC instead of plain hash:

```
hash = HMAC-SHA-256(key="teleburn:solana:v1", message=txid||index)
```

**Pros:**
- ✅ Stronger domain separation (keyed hash)
- ✅ More cryptographic security
- ✅ Can't accidentally forget salt

**Cons:**
- ❌ More complex (requires key management)
- ❌ Slower (HMAC is slightly slower)
- ❌ Overkill for this use case (salt is sufficient)
- ❌ Key could leak (salt is public anyway)

**Verdict:** ❌ Overkill - salt provides same security, simpler

---

### Alternative 5: **Nested Hashing**

Hash twice with different contexts:

```
inner = SHA-256(txid || index)
outer = SHA-256("SBT01:solana:v1" || inner)
```

**Pros:**
- ✅ Clear separation between data and context
- ✅ Mathematically cleaner

**Cons:**
- ❌ Two hash operations (slower)
- ❌ More complex
- ❌ No security benefit over single hash with salt

**Verdict:** ⚠️ Less efficient, no real benefit

---

### Alternative 6: **Variable-Length Domain String**

Use a more descriptive string:

```
salt = "kiln.teleburn.solana.v1"
// or
salt = "ordinals.teleburn.solana.v1"
```

**Pros:**
- ✅ More descriptive/readable
- ✅ Better for branding ("Kiln")
- ✅ Follows reverse-domain notation
- ✅ Easier to identify in audits

**Cons:**
- ❌ Longer (more bytes)
- ❌ Still uses same mechanism (salt)

**Verdict:** ✅ **Good option** - better readability, same security

---

### Alternative 7: **Chain ID as Salt**

Use blockchain chain ID:

```
salt = chain_id || version
// Example: "0x65" (Solana mainnet) || "v1"
```

**Pros:**
- ✅ Standardized (uses official chain IDs)
- ✅ Extensible to any chain

**Cons:**
- ❌ Chain IDs can change
- ❌ Some chains don't have IDs
- ❌ Less readable

**Verdict:** ⚠️ Overcomplicated, current approach is better

---

## Recommended Alternative: Branded Salt

Based on analysis, the best alternative is **Option 6**: Use a branded, readable domain string.

### Recommended Change

**Current:**
```
SBT01:solana:v1
```

**Recommended:**
```
kiln.teleburn.solana.v1
```

**Or:**
```
ordinals.teleburn.kiln.v1
```

### Benefits of Branded Salt

1. ✅ **Better Branding:** Uses "Kiln" name (matching your standard identifier)
2. ✅ **More Readable:** Reverse-domain notation is clearer
3. ✅ **Easier Debugging:** Easier to identify in logs/audits
4. ✅ **Industry Standard:** Matches common practices (like reverse DNS)
5. ✅ **Same Security:** Provides identical security properties

### Format Options

| Option | Example | Pros | Cons |
|--------|---------|------|------|
| Reverse domain | `kiln.teleburn.solana.v1` | ✅ Standard notation, clear hierarchy | Longer |
| Simple branded | `kiln:solana:v1` | ✅ Short, clear | Less descriptive |
| Protocol-based | `teleburn.kiln.v1` | ✅ Focus on protocol | Less chain-specific |
| Current | `SBT01:solana:v1` | ✅ Short | ❌ Unclear what "SBT01" means |

**Recommendation:** `kiln.teleburn.solana.v1` or `kiln:solana:v1` (shorter version)

---

## Security Analysis

### Is Salt Necessary?

**For single-chain teleburn (like Ethereum):**
- ❌ Not strictly necessary
- ✅ But recommended for future-proofing

**For multi-chain teleburn:**
- ✅ **Strongly recommended**
- ✅ Prevents cross-chain collisions
- ✅ Enables protocol versioning

### Salt Security Properties

1. **Collision Resistance:** ✅ Excellent
   - SHA-256 provides 2^256 security
   - Salt adds additional entropy
   - Different salts = different hash spaces

2. **Preimage Resistance:** ✅ Excellent
   - Cannot reverse hash to get original input
   - Salt doesn't weaken this property

3. **Second Preimage Resistance:** ✅ Excellent
   - Cannot find another input with same hash
   - Salt strengthens this (more unique inputs)

4. **Domain Separation:** ✅ Perfect
   - Guaranteed different outputs for different domains
   - No chance of cross-domain collision

### Attack Scenarios

#### Scenario 1: Cross-Chain Collision

**Attacker Goal:** Make Solana address match Ethereum address for same inscription ID

**With Salt:**
- ❌ Impossible - different salt = different hash
- ✅ Attack fails

**Without Salt:**
- ⚠️ Small chance if output sizes matched
- ⚠️ Could confuse verifiers

#### Scenario 2: Protocol Impersonation

**Attacker Goal:** Create addresses that look like they came from your protocol

**With Salt:**
- ✅ Only your protocol can produce addresses with your salt
- ✅ Verifiers check salt in derivation
- ✅ Attack fails

**Without Salt:**
- ❌ Any protocol could produce matching addresses
- ❌ No way to distinguish

### Conclusion

**Salt is a security best practice** for cross-chain systems. While not strictly necessary for single-chain (like Ethereum), it provides:
- ✅ Better security
- ✅ Future-proofing
- ✅ Protocol isolation
- ✅ Minimal overhead

**Recommendation:** Keep the salt, consider upgrading to branded version.

---

## Migration Considerations

### Changing the Salt Value

**⚠️ CRITICAL:** Changing the salt value will produce **completely different addresses** for the same inscription ID.

#### Impact

| Aspect | Impact | Severity |
|--------|--------|----------|
| Existing burns | ❌ Cannot verify with new salt | Critical |
| New burns | ✅ Work with new salt | None |
| Verification tools | ⚠️ Need to support both salts | High |
| Documentation | ⚠️ Must update all docs | Medium |

#### Migration Path (If Needed)

If you need to change salt:

1. **Version the Salt:**
   ```
   v1: "SBT01:solana:v1"
   v2: "kiln:solana:v2"
   ```

2. **Support Both in Verification:**
   - Check v1 first (backward compatibility)
   - Check v2 if v1 fails

3. **Document Migration:**
   - Clearly mark which burns use which salt
   - Provide migration guide

4. **Phase Out Old Salt:**
   - After sufficient time, deprecate v1
   - Only use v2 for new burns

**Recommendation:** Only change salt if absolutely necessary. If changing, use versioned approach.

---

## FAQ

### Q1: What does "SBT01" mean?

**A:** Unknown - it appears to be a protocol identifier. Possible meanings:
- "Solana Bitcoin Teleburn 01"
- "Standard Burn Token 01"
- Legacy identifier

**Recommendation:** Consider changing to branded name like "Kiln" for clarity.

---

### Q2: Can I remove the salt to match Ethereum?

**A:** Technically yes, but **not recommended**:
- ❌ Loses cross-chain safety
- ❌ No versioning support
- ❌ Potential future collisions

Ethereum's approach works because they only target Ethereum. If you want multi-chain support, keep the salt.

---

### Q3: Does the salt order matter?

**A:** Yes! Changing the order changes the hash:

```
SHA-256(txid || index || salt) ≠ SHA-256(salt || txid || index)
```

**Current order:** `txid || index || salt`  
**Why?** Bitcoin data first, then domain separator. This is standard practice.

---

### Q4: How long should the salt be?

**A:** Any length works, but practical considerations:

- **Too short (< 8 bytes):** Risk of collision
- **Too long (> 64 bytes):** Unnecessary overhead
- **Sweet spot:** 16-32 bytes

Current salt (`SBT01:solana:v1`) is 18 bytes - perfect size.

---

### Q5: Can the salt contain special characters?

**A:** Yes, but keep it simple:
- ✅ Alphanumeric: `a-z`, `A-Z`, `0-9`
- ✅ Separators: `:`, `.`, `-`, `_`
- ❌ Avoid: Unicode, emoji, control characters

Current salt uses only safe characters.

---

### Q6: What happens if two protocols use the same salt?

**A:** They'll produce **identical addresses** for the same inscription ID. This could cause:
- Confusion in verification
- Accidental protocol impersonation
- Address reuse issues

**Solution:** Choose unique salt per protocol (e.g., branded names).

---

### Q7: Is salt better than Ethereum's approach?

**A:** For single-chain: Equivalent  
For multi-chain: **Yes, salt is better**

| Criteria | Ethereum | With Salt |
|----------|----------|-----------|
| Single-chain | ✅ Works | ✅ Works |
| Multi-chain | ⚠️ Risky | ✅ Safe |
| Complexity | ✅ Simple | ⚠️ Slightly complex |
| Future-proof | ⚠️ Limited | ✅ Flexible |

**Verdict:** Salt is the safer, more future-proof choice.

---

## Summary

### Key Takeaways

1. **Salt provides domain separation** - prevents cross-chain/protocol collisions
2. **Current salt works well** - but "SBT01" is unclear
3. **Recommended change:** Use branded salt like `"kiln:solana:v1"`
4. **Alternatives exist** - but salt is the best balance of security and simplicity
5. **Migration is possible** - but requires careful versioning

### Recommendations

1. ✅ **Keep using salt** - it's a security best practice
2. ✅ **Consider rebranding** - change to "Kiln" for clarity
3. ✅ **Document clearly** - explain why salt exists
4. ✅ **Version if changing** - support both old and new if migrating

### Final Verdict

**Current implementation is solid.** The salt provides excellent security properties. The only improvement would be rebranding from `"SBT01:solana:v1"` to something more descriptive like `"kiln:solana:v1"` or `"kiln.teleburn.solana.v1"` for better clarity and branding.

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** Kiln Development Team

