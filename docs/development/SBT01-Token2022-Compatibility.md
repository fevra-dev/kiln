# Token‑2022 Compatibility Table (SBT‑01.1)

Some Token‑2022 extensions can block or alter retire actions. Use this table to detect and handle incompatibilities.

| Extension                        | Impact on Retire Path                | Mitigation / Notes                                                                 |
|----------------------------------|--------------------------------------|------------------------------------------------------------------------------------|
| **Transfer Hook**                | May block transfers to incinerator/derived ATA | Requires hook approval or alternative method (burn if allowed). Verify preflight. |
| **Permanent Delegate**          | Delegate may control burn/transfer   | Ensure correct delegate signs; otherwise retire may fail.                          |
| **Non-Transferable**            | Disables transfers                    | Use **burn** path if permitted; otherwise cannot retire.                           |
| **Transfer Fee Config**         | Adds fees to transfers                | Account for extra lamports; prefer **burn** to avoid unexpected fees.             |
| **Default Account State**       | Frozen by default                     | Must thaw before transfer/burn.                                                    |
| **Mint Close Authority**        | Might restrict close actions          | Ensure authority alignment; close ATA accounts only when safe.                     |
| **Immutable Owner**             | Prevents owner change                 | Only **burn** possible if allowed.                                                 |
| **Confidential Transfers**      | Obscures balances/state               | Verifier must use the extension’s APIs; status confidence may be downgraded.      |

**Runtime checks (pseudo):**
```ts
const info = await getToken2022MintInfo(mint);
if (info.hasTransferHook) { /* request hook approval or switch to burn */ }
if (info.nonTransferable) { /* burn only, if allowed */ }
if (info.defaultFrozen)   { /* thaw before retire */ }
```

**Docs:** clearly warn users when an extension blocks incinerate/derived paths and guide them to burn (or abort).