# Inscription "Immutability" Feature - Explanation

## You're Right - Bitcoin Inscriptions ARE Immutable!

Bitcoin inscriptions are **permanently immutable** on-chain. Once an inscription is minted, its content **cannot change**. This is guaranteed by the Bitcoin blockchain itself.

## So What Is This Feature Actually Doing?

The "inscription immutability" feature is **NOT** checking if Bitcoin changed (which is impossible). Instead, it's:

### 1. **API Reliability Verification** 🔍
Verifies that the **APIs we fetch from** (ordinals.com, etc.) consistently return the correct content. This catches:
- API bugs serving wrong data
- API corruption/caching issues
- API serving incorrect inscriptions

### 2. **Multi-Source Validation** ✅
Since we use multiple data sources with failover, this ensures:
- All sources return the same content
- No source is serving corrupted data
- Our failover system is working correctly

### 3. **Cache Consistency Check** 💾
Validates that our cached inscription data matches fresh API fetches:
- Ensures cache hasn't become stale
- Verifies cache integrity
- Detects cache corruption

## Example Scenario

```typescript
// During seal operation (Day 1)
const originalHash = 'abc123...';
storeInscriptionSnapshot('inscriptionId', originalHash, 'seal-operation');

// Later (Day 30) - verify API is still serving correct data
const result = await verifyInscriptionImmutability('inscriptionId', originalHash);

// If result.unchanged === false:
// - Bitcoin inscription hasn't changed (impossible)
// - BUT: API might be serving wrong/corrupted data
// - OR: Our cache might be corrupted
// - OR: Network issue corrupted the fetch
```

## Why This Matters

Even though Bitcoin inscriptions are immutable, **the APIs we use to fetch them are not perfect**:
- APIs can have bugs
- APIs can serve cached/corrupted data
- APIs can be compromised
- Network issues can corrupt data in transit

This feature ensures **we detect and handle API inconsistencies** before they cause problems.

## Better Name?

The feature could be better named:
- `inscription-api-consistency.ts`
- `inscription-verification-tracking.ts`
- `inscription-content-verification.ts`

But "immutability" was chosen because it's checking that the content **appears unchanged** (from API perspective), which is a proxy for verifying the APIs are working correctly.

## Summary

**What it checks:** API reliability and data consistency  
**What it doesn't check:** Whether Bitcoin changed (impossible)  
**Why it matters:** APIs can serve wrong data, and we need to catch that  

The feature is essentially a **quality assurance check for our data sources**, not a verification that Bitcoin itself changed.

---

**TL;DR:** Bitcoin inscriptions are immutable. This feature verifies that **APIs are serving correct data**, not that Bitcoin changed.

