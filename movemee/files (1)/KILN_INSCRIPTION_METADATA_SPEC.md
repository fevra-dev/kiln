# KILN Inscription Metadata Standard

**Version:** 1.0  
**Status:** Final Specification  
**Date:** December 5, 2025  
**Author:** Fevra (KILN)  
**Companion To:** KILN Teleburn Protocol v1.0

---

## 1. Abstract

This specification defines the metadata standard for Bitcoin Ordinal inscriptions that originate from Solana NFT teleburns. The format follows BRC-20 conventions (`p`, `op`, `v`) for maximum ecosystem compatibility.

When embedded in an inscription, this metadata creates **bidirectional linkage**:

```
Solana → Bitcoin:  Burn memo (teleburn:...)
Bitcoin → Solana:  Inscription metadata (p: "kiln", mint: "...")
```

---

## 2. Format

### 2.1 Minimal (Required Fields Only)

```json
{
  "p": "kiln",
  "op": "teleburn",
  "v": 1,
  "mint": "6ivMgojHapfvDKS7pFSwgCPzPvPPCT2y8Pv1zHfLqTBL"
}
```

### 2.2 Standard (Recommended)

```json
{
  "p": "kiln",
  "op": "teleburn",
  "v": 1,
  "mint": "6ivMgojHapfvDKS7pFSwgCPzPvPPCT2y8Pv1zHfLqTBL",
  "name": "DeGod #1234",
  "collection": "DeGods"
}
```

### 2.3 Full (Complete Preservation)

```json
{
  "p": "kiln",
  "op": "teleburn",
  "v": 1,
  "mint": "6ivMgojHapfvDKS7pFSwgCPzPvPPCT2y8Pv1zHfLqTBL",
  "name": "DeGod #1234",
  "collection": "DeGods",
  "symbol": "DGOD",
  "burn_tx": "5Kj2nFvH8mPqR3xYtZ9wBcVdE6fGhJkLmNpQrStUvWxYzA1B2C3D4E5F6G7H8I9J0K",
  "attributes": [
    { "trait_type": "Background", "value": "Sunset" },
    { "trait_type": "Eyes", "value": "Laser" }
  ]
}
```

---

## 3. Field Definitions

### 3.1 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `p` | string | Protocol identifier. MUST be `"kiln"` |
| `op` | string | Operation. MUST be `"teleburn"` or `"provenance"` |
| `v` | integer | Version. MUST be `1` |
| `mint` | string | Solana mint address (base58, 32-44 chars) |

### 3.2 Recommended Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | NFT name |
| `collection` | string | Collection name |

### 3.3 Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | string | Collection symbol |
| `burn_tx` | string | Solana burn transaction signature |
| `attributes` | array | Trait attributes `[{trait_type, value}, ...]` |

---

## 4. Why This Format?

### 4.1 BRC-20 Convention

The `p`, `op`, `v` pattern is the Ordinals ecosystem standard:

```json
{"p": "brc-20", "op": "deploy", "tick": "ordi"}
{"p": "kiln", "op": "teleburn", "mint": "6iv..."}
```

Every Ordinals indexer already knows how to query `$.p` and `$.op`.

### 4.2 No Nested Origin

Since `p: "kiln"` already implies Solana origin, we don't need:
```json
"origin": { "chain": "solana", "mint": "..." }
```

Just:
```json
"mint": "..."
```

~20 bytes saved per inscription.

---

## 5. Provenance Records

For adding metadata to existing inscriptions:

```json
{
  "p": "kiln",
  "op": "provenance",
  "v": 1,
  "inscription": "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0",
  "mint": "6ivMgojHapfvDKS7pFSwgCPzPvPPCT2y8Pv1zHfLqTBL",
  "burn_tx": "5Kj2nF..."
}
```

---

## 6. Verification

### 6.1 Bidirectional Check

```
1. Parse inscription → extract mint
2. Query Solana for burn tx of that mint
3. Parse memo (teleburn:...) → extract inscription ID
4. Confirm IDs match
5. ✓ Verified
```

### 6.2 Pseudocode

```typescript
async function verify(inscriptionId: string) {
  const meta = await getInscription(inscriptionId);
  if (meta.p !== 'kiln') return false;
  
  const burn = await findBurn(meta.mint);
  if (!burn || burn.supply !== 0) return false;
  
  const memoId = burn.memo.slice(9); // "teleburn:"
  return memoId === inscriptionId;
}
```

---

## 7. Indexing

```sql
-- Find all KILN inscriptions
SELECT * FROM inscriptions 
WHERE JSON_EXTRACT(content, '$.p') = 'kiln';

-- Find teleburns
SELECT * FROM inscriptions 
WHERE JSON_EXTRACT(content, '$.p') = 'kiln'
AND JSON_EXTRACT(content, '$.op') = 'teleburn';

-- Find by collection
SELECT * FROM inscriptions 
WHERE JSON_EXTRACT(content, '$.p') = 'kiln'
AND JSON_EXTRACT(content, '$.collection') = 'DeGods';
```

---

## 8. Size Comparison

| Tier | Example | Size |
|------|---------|------|
| Minimal | `p`, `op`, `v`, `mint` | ~75 bytes |
| Standard | + `name`, `collection` | ~120 bytes |
| Full | + `burn_tx`, `attributes` | ~300+ bytes |

---

## 9. References

- KILN Teleburn Protocol v1.0
- BRC-20 Standard: https://domo-2.gitbook.io/brc-20-experiment/
- KILN Repository: https://github.com/fevra-dev/kiln
- Ordinals: https://docs.ordinals.com

---

*End of Specification*
