# Marketplace Integration Guide (SBT‑01.1)

**Audience:** Marketplaces (Magic Eden, Tensor, etc.), indexers, wallets.

## 1) Detect Teleburned Tokens
1. **SPL Memo events**: parse recent transactions for SBT‑01.1 `seal` and `retire` payloads.
2. **Pointer JSON**: check for `attributes` trait `Teleburn: KILN.1` and `properties.ordinal.inscription_id`.
3. **On‑chain state**:
   - **burned**: mint supply = 0
   - **incinerated**: incinerator ATA balance ≥ 1
   - **derived**: derived ATA (from memo/algorithm) balance ≥ 1

## 2) Display
- Show a pill: **“Migrated to Bitcoin (SBT‑01.1)”** with link to `https://ordinals.com/inscription/<id>`.
- Provide **proof details** (mint, inscription id, SHA‑256, tx signatures).

## 3) Relisting Rules
- If status is not `unknown`, **block primary listing** or add a “Retired” state that disables purchase.
- Optionally allow **read‑only** display pages with the pointer image from Ordinals.

## 4) Edge Cases
- **Partial collections**: show collection badge “N teleburned / M total”; link to a collection manifest when provided.
- **Immutable metadata**: rely on Memo + retire state; pointer trait may be absent.
- **cNFTs**: detect Bubblegum and use appropriate verifier hooks.

## 5) API Contract (suggested)
```json
GET /api/teleburn/status?mint=<addr>
→ {
  "standard":"KILN",
  "version":"0.1.1",
  "status":"burned|incinerated|derived|unknown",
  "confidence":"high|medium|low",
  "inscription":"<txid>i0",
  "pointerUri":"ipfs://...",
  "proof": { "sealTx":"...", "retireTx":"...", "sha256":"..." }
}
```

## 6) Badges
Offer an embeddable badge:
```
[ Teleburned to Bitcoin — Verified ]
```
Link to the public verification page for that mint.
