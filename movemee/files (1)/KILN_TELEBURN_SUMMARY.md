# KILN Teleburn Protocol v1.0 — Final Summary

## The Protocol

### Solana Burn Memo
```
teleburn:6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0
```

### Bitcoin Inscription Metadata

**Minimal:**
```json
{"p":"kiln","op":"teleburn","v":1,"mint":"6ivMgoj..."}
```

**Standard (recommended):**
```json
{"p":"kiln","op":"teleburn","v":1,"mint":"6ivMgoj...","name":"DeGod #1234","collection":"DeGods"}
```

**Full:**
```json
{"p":"kiln","op":"teleburn","v":1,"mint":"6ivMgoj...","name":"DeGod #1234","collection":"DeGods","burn_tx":"5Kj2nF...","attributes":[{"trait_type":"Eyes","value":"Laser"}]}
```

---

## Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `p` | ✅ | Protocol: `"kiln"` |
| `op` | ✅ | Operation: `"teleburn"` or `"provenance"` |
| `v` | ✅ | Version: `1` |
| `mint` | ✅ | Solana mint address |
| `name` | ⭐ | NFT name |
| `collection` | ⭐ | Collection name |
| `symbol` | ○ | Collection symbol |
| `burn_tx` | ○ | Solana burn tx signature |
| `attributes` | ○ | Trait array |

✅ Required · ⭐ Recommended · ○ Optional

---

## Why This Format?

| Decision | Reason |
|----------|--------|
| `teleburn:` memo | Generic prefix for ecosystem adoption |
| `p`, `op`, `v` | BRC-20 convention — indexers expect it |
| Flat `mint` field | No need for nested `origin.chain` — KILN implies Solana |
| No JSON memo | 78 bytes vs 250+ bytes |
| No derived address | Vestigial on Solana |

---

## Bidirectional Verification

```
Solana → Bitcoin:  teleburn:abc123...i0
Bitcoin → Solana:  {"p":"kiln","mint":"6ivMgoj..."}
```

Both chains point to each other. Verify from either direction.

---

## Size Comparison

| Format | Size |
|--------|------|
| Solana memo | ~78 bytes |
| Minimal inscription | ~75 bytes |
| Standard inscription | ~120 bytes |
| Full inscription | ~300 bytes |
| Old JSON memo (v0.1.x) | ~250 bytes |

---

## Implementation

### Memo
```typescript
const memo = `teleburn:${inscriptionId}`;
```

### Inscription
```typescript
const inscription = {
  p: 'kiln',
  op: 'teleburn',
  v: 1,
  mint: '6ivMgoj...',
  name: 'DeGod #1234',
  collection: 'DeGods'
};
```

### Indexing
```sql
-- Solana
WHERE memo LIKE 'teleburn:%'

-- Bitcoin
WHERE JSON_EXTRACT(content, '$.p') = 'kiln'
```

---

## Files

| File | Purpose |
|------|---------|
| `KILN_TELEBURN_SPEC_v1.0.docx` | Formal Solana memo spec |
| `KILN_INSCRIPTION_METADATA_SPEC.md` | Bitcoin metadata spec |
| `teleburn-v1.ts` | Solana implementation |
| `kiln-inscription.ts` | Bitcoin implementation |

---

## Quick Reference

```
┌────────────────────────────────────────────────────────┐
│  SOLANA                                                │
│  Burn TX + Memo: teleburn:<inscription_id>             │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│  BITCOIN                                               │
│  Inscription: {"p":"kiln","mint":"<solana_mint>"}      │
└────────────────────────────────────────────────────────┘
```

---

*Finalized December 5, 2025*  
*Reviewed by: Claude, GPT-4, Grok*
