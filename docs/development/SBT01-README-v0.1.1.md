# SBT‑01 Teleburn Standard — README & Technical Plan (v0.1.1)

**Scope:** Solana → Bitcoin Ordinals  
**Status:** Working draft, closed‑beta ready

This revision (**v0.1.1**) incorporates improvements for safety, verifiability, and future‑proofing:
- **Time anchoring** in memos (`timestamp`, `block_height`)
- **Mandatory inscription verification** before sealing
- **Hardened derived owner** (domain separation + `bump`)
- **Confidence‑rated verifier** with multi‑RPC cross‑checks
- **Dry Run** mode + rehearsal receipts
- Batch **rate limiting + retries**; WASM **worker pool**
- **Marketplace integration** guidance
- **Token‑2022** compatibility notes

---

## 0) Versioning & Migration
- Keep `standard: "KILN"`; bump **`version: "0.1.1"`**.
- Add chain fields & method for clarity and future upgrades (SBT‑02 can adopt Ordinals‑official Solana scheme if it emerges):
```json
"source_chain": "solana-mainnet",
"target_chain": "bitcoin-mainnet",
"teleburn_method": "burn|incinerate|teleburn-derived",
"upgrade_hint": "SBT-02-ready"
```
- **Migration path**: If SBT‑02 is standardized later, publish a *Migration Memo* linking the original SBT‑01.1 proof tuple (mint, inscription, sha256, tx sigs) to the new semantics. The verifier should recognize both and prefer the newest valid standard.

---

## 1) SBT‑01.1 Payloads

### 1.1 Seal Memo (SPL Memo JSON)
```jsonc
{
  "standard": "KILN",
  "version": "0.1.1",
  "source_chain": "solana-mainnet",
  "target_chain": "bitcoin-mainnet",
  "action": "seal",
  "timestamp": 1739904000,              // unix seconds (UTC)
  "block_height": 268123456,            // Solana slot at submission
  "inscription": { "id": "<txid>i0" },
  "solana": { "mint": "<mint_address>" },
  "media": { "sha256": "<hex_sha256>" },
  "extra": {
    "signers": ["<authority1>", "<authority2>"]  // optional multi-sig disclosure
  }
}
```

### 1.2 Retire Memo (Burn / Incinerate / Derived Teleburn)
```jsonc
{
  "standard": "KILN",
  "version": "0.1.1",
  "action": "burn|incinerate|teleburn-derived",
  "timestamp": 1739905123,
  "block_height": 268124001,
  "inscription": { "id": "<txid>i0" },
  "solana": { "mint": "<mint_address>" },
  "media": { "sha256": "<hex_sha256>" },
  "derived": { "bump": 37 } // only if teleburn-derived was used
}
```

> **Incinerator address:** `1nc1nerator11111111111111111111111111111111` (no private key).

---

## 2) Derived Owner (Hardened)
- **Domain:** `ordinals.teleburn.sbt01.v1`
- **Bump** recorded in retire memo (reproducibility).

**TS helper:**
```ts
const DOMAIN = "ordinals.teleburn.sbt01.v1";
export function deriveOwner(inscriptionId: string, startBump = 0) {
  const [txidHex, iStr] = inscriptionId.split("i");
  const txid = Uint8Array.from(Buffer.from(txidHex, "hex"));
  const idx = new Uint8Array(4); new DataView(idx.buffer).setUint32(0, parseInt(iStr,10), false);
  let bump = startBump, pk: Uint8Array;
  while (true) {
    pk = sha256(concat(utf8(DOMAIN), txid, idx, new Uint8Array([bump])));
    if (!isOnCurve(pk) || bump === 255) break;
    bump++;
  }
  return { publicKey: new PublicKey(pk), bump };
}
```

---

## 3) Mandatory Inscription Verification (Gate)
Between **Inscribe** and **Seal**, verify the inscription’s bytes match your expected `media.sha256`:

```ts
async function verifyInscription(id: string, expectedHexSha256: string) {
  const res = await fetch(`https://ordinals.com/content/${id}`);
  if (!res.ok) throw new Error(`Inscription ${id} not found`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  if (hex !== expectedHexSha256.toLowerCase()) throw new Error("SHA-256 mismatch");
  return { ok: true, byteLength: buf.byteLength };
}
```
If this fails, **do not** allow the Seal step.

---

## 4) Dry Run Mode & Rehearsal Receipt
- Build all txs (seal, optional URI update, retire), **decode**, **simulate**, compute **fee estimates**, show all details—no signatures requested.
- Export *Rehearsal Receipt*:
```json
{
  "mode": "dry-run",
  "mint": "<mint>",
  "inscription": "<id>",
  "planned": ["seal-memo","update-uri","retire:burn"],
  "txs": [
    {"name":"seal","programs":[...],"accounts":[...],"fee_lamports":12345}
  ],
  "fees": {"sol_total_lamports": 23456},
  "createdAt": "2025-10-19T00:00:00Z"
}
```

---

## 5) Verifier with Confidence
```ts
type VerificationResult = {
  method: 'derived' | 'incinerated' | 'burned' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  sources: Array<{ rpc: string; status: string }>;
  sealMemo?: Sbt01Seal;
  retireMemo?: Sbt01Retire;
};
```
- **high** = ≥2 RPCs agree + matching memos + balances/supply checks.
- **medium** = partial agreement.
- **low** = weak signals.

---

## 6) Batch, Rate Limits & Worker Pool
```ts
export const BATCH_CFG = {
  maxConcurrent: 3,
  retryDelays: [1000, 5000, 15000],
  priorityFeeMultiplier: 1.5,
  maxRetriesPerItem: 3,
};
```
- Reuse WASM compression workers via a simple worker pool; tear down after idle.

---

## 7) Pointer JSON (with Recovery Block)
```json
{
  "name": "<name>",
  "symbol": "<symbol>",
  "description": "Teleburned to Bitcoin Ordinals (KILN.1)",
  "image": "https://ordinals.com/content/<inscription_id>",
  "external_url": "https://ordinals.com/inscription/<inscription_id>",
  "attributes": [{ "trait_type": "Teleburn", "value": "KILN.1" }],
  "properties": {
    "ordinal": { "inscription_id": "<txid>i0", "sha256": "<hex>", "network": "bitcoin-mainnet" },
    "files": [{ "uri": "https://ordinals.com/content/<inscription_id>", "type": "image/avif" }]
  },
  "recovery": {
    "originalMetadataUri": "https://...",
    "originalMetadataHash": "sha256:...",
    "teleburn_date": "2025-10-19T00:00:00Z",
    "authority": "<pubkey>"
  }
}
```

---

## 8) Token‑2022 & cNFT Notes
See the separate **Token‑2022 Compatibility Table** for known blockers (transfer hooks, permanent delegate, etc.). For cNFTs (Bubblegum), sealing is identical (memo), retirement/burn differs—document proof tuple and use a specialized verifier path.

---

## 9) Public Verification UI
Read‑only UI to validate any (mint, inscription) pair, display status with **confidence**, offer an embeddable badge, and expose permalinks to Solana and Ordinals explorers.

---

## 10) Marketplace Integration (Overview)
- Detect SBT‑01.1 via: Seal/Retire Memos + Pointer JSON trait + on‑chain state.
- Display “Migrated to Bitcoin” + link to Ordinals.
- Prevent relisting when `status != "unknown"`.
See **Marketplace Integration Guide** for details.

---

## 11) Legal & Licensing
- **Standard text/spec:** CC0 (public domain).  
- **Reference code:** MIT or Apache‑2.0.  
- Include IP ownership notice: creators must own rights to inscribe; tooling disclaimer.

---

## 12) Changelog
- **v0.1.1** — time anchoring, verification gate, hardened derived owner, verifier confidence, dry run, batch hardening, marketplace & token‑2022 docs.
- **v0.1.0** — initial SBT‑01 spec and wizard.

