# Token-2022 Extension Compatibility Guide

## Overview

KILN teleburn operations involve transferring tokens and closing token accounts. Some Token-2022 extensions may interfere with these operations. This document outlines known compatibility issues and workarounds.

---

## ✅ Compatible Extensions

These extensions work seamlessly with KILN teleburn:

### Metadata Extension
- **Status**: ✅ Fully Compatible
- **Notes**: Native Token-2022 metadata works identically to Metaplex metadata for KILN purposes
- **Seal Impact**: None
- **Retire Impact**: None

### Metadata Pointer
- **Status**: ✅ Fully Compatible
- **Notes**: Points to external metadata; does not affect token transfers
- **Seal Impact**: None
- **Retire Impact**: None

### Group Pointer / Member Pointer
- **Status**: ✅ Fully Compatible
- **Notes**: Collection grouping mechanisms work normally
- **Seal Impact**: None
- **Retire Impact**: None

### Interest-Bearing / Transfer Fee
- **Status**: ✅ Compatible with Caution
- **Notes**: Fees will be applied during retire transaction; ensure sufficient balance
- **Seal Impact**: None
- **Retire Impact**: May increase transaction cost

---

## ⚠️ Partially Compatible Extensions

These extensions may work but require special handling:

### Non-Transferable Extension
- **Status**: ⚠️ Incompatible with Standard Flow
- **Issue**: Tokens cannot be transferred, blocking all three retire methods (burn, incinerate, teleburn-derived)
- **Workaround**: 
  - If you have the **Mint Authority**, you can:
    1. Remove the non-transferable extension
    2. Complete the teleburn
    3. This is the ONLY viable path
  - If you lack mint authority, teleburn is **impossible**
- **Detection**: Check for `NonTransferable` extension before attempting teleburn
- **Recommendation**: **Block teleburn attempts** and display clear error message

### Permanent Delegate
- **Status**: ⚠️ Requires Delegate Approval
- **Issue**: A permanent delegate can control transfers
- **Workaround**:
  - Ensure the permanent delegate is the current token owner OR
  - Have the delegate co-sign the retire transaction
- **Detection**: Check `permanentDelegate` field in mint account
- **Recommendation**: Display warning and require additional signatures if needed

### Transfer Hook
- **Status**: ⚠️ May Block Transfers
- **Issue**: Custom program runs on every transfer; may reject teleburn transfers
- **Workaround**:
  - Test with dry run simulation first
  - If hook program rejects: contact the hook authority to whitelist teleburn operations
  - Some hooks may allow transfers to specific addresses (incinerator, derived owners)
- **Detection**: Check for `TransferHook` extension and program ID
- **Recommendation**: **Always run dry run simulation** and surface hook errors clearly

### Immutable Owner
- **Status**: ✅ Compatible
- **Issue**: None - only affects ATA ownership, not transfers
- **Notes**: This is actually beneficial as it prevents accidental ATA ownership changes

---

## ❌ Incompatible Extensions

These extensions completely block KILN teleburn:

### Mint Close Authority
- **Status**: ❌ Potential Issue
- **Issue**: If mint can be closed after burn, could affect verification
- **Workaround**: Check mint status before claiming "burned" status
- **Recommendation**: Document that mint closure voids verification

### Confidential Transfers
- **Status**: ❌ Verification Impossible
- **Issue**: Token balances are encrypted; cannot verify burn status on-chain
- **Workaround**: None - confidential transfer tokens cannot be verified as teleburned
- **Recommendation**: **Block teleburn attempts** with clear explanation

---

## Detection Implementation

### Checking Extensions Before Teleburn

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { 
  getMint, 
  ExtensionType,
  getExtensionData,
  TOKEN_2022_PROGRAM_ID 
} from '@solana/spl-token';

interface ExtensionCheckResult {
  compatible: boolean;
  warnings: string[];
  blockers: string[];
  extensions: string[];
}

export async function checkToken2022Compatibility(
  connection: Connection,
  mintAddress: PublicKey
): Promise<ExtensionCheckResult> {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const extensions: string[] = [];

  try {
    const mintInfo = await getMint(
      connection,
      mintAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    // Check for extensions
    const extensionTypes = mintInfo.tlvData ? getExtensionTypes(mintInfo.tlvData) : [];
    
    for (const extType of extensionTypes) {
      extensions.push(extType);

      switch (extType) {
        case ExtensionType.NonTransferable:
          blockers.push(
            'NON-TRANSFERABLE: This token cannot be transferred. Teleburn is impossible unless you have mint authority to remove this extension.'
          );
          break;

        case ExtensionType.TransferHook:
          warnings.push(
            'TRANSFER HOOK: A custom program controls transfers. Run dry run simulation to verify compatibility.'
          );
          break;

        case ExtensionType.ConfidentialTransferMint:
          blockers.push(
            'CONFIDENTIAL TRANSFERS: Token balances are encrypted. On-chain verification is impossible.'
          );
          break;

        case ExtensionType.PermanentDelegate:
          warnings.push(
            'PERMANENT DELEGATE: An external authority can control this token. Ensure delegate approval if needed.'
          );
          break;

        case ExtensionType.TransferFeeConfig:
          warnings.push(
            'TRANSFER FEE: Additional fees will apply during retirement. Ensure sufficient balance.'
          );
          break;

        case ExtensionType.MintCloseAuthority:
          warnings.push(
            'MINT CLOSE AUTHORITY: Mint can be closed after burn, potentially affecting verification.'
          );
          break;

        default:
          // Other extensions are generally compatible
          break;
      }
    }

    return {
      compatible: blockers.length === 0,
      warnings,
      blockers,
      extensions
    };

  } catch (error) {
    return {
      compatible: false,
      warnings: [],
      blockers: ['Failed to fetch mint information: ' + (error as Error).message],
      extensions: []
    };
  }
}

function getExtensionTypes(tlvData: Buffer): ExtensionType[] {
  const types: ExtensionType[] = [];
  let offset = 0;

  while (offset < tlvData.length) {
    const type = tlvData.readUInt16LE(offset);
    const length = tlvData.readUInt16LE(offset + 2);
    types.push(type);
    offset += 4 + length;
  }

  return types;
}
```

---

## UI Integration

### Pre-Flight Check Component

```typescript
// Display before allowing teleburn
export function Token2022CompatibilityCheck({ mint }: { mint: string }) {
  const [result, setResult] = useState<ExtensionCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkCompatibility();
  }, [mint]);

  const checkCompatibility = async () => {
    setChecking(true);
    const connection = new Connection(RPC_URL);
    const result = await checkToken2022Compatibility(
      connection,
      new PublicKey(mint)
    );
    setResult(result);
    setChecking(false);
  };

  if (checking) return <div>Checking Token-2022 extensions...</div>;
  if (!result) return null;

  return (
    <div className="space-y-3">
      {/* Blockers - prevent proceeding */}
      {result.blockers.length > 0 && (
        <div className="p-4 bg-red-50 border-2 border-red-400 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🚫</span>
            <span className="font-bold text-red-900">Teleburn Blocked</span>
          </div>
          <ul className="text-sm text-red-800 space-y-2">
            {result.blockers.map((blocker, idx) => (
              <li key={idx}>• {blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings - allow proceeding with caution */}
      {result.warnings.length > 0 && result.compatible && (
        <div className="p-4 bg-yellow-50 border border-yellow-400 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚠️</span>
            <span className="font-bold text-yellow-900">Compatibility Warnings</span>
          </div>
          <ul className="text-sm text-yellow-800 space-y-2">
            {result.warnings.map((warning, idx) => (
              <li key={idx}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* All clear */}
      {result.compatible && result.warnings.length === 0 && (
        <div className="p-4 bg-green-50 border border-green-400 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <span className="font-bold text-green-900">
              {result.extensions.length > 0 
                ? 'Token-2022 Extensions Compatible'
                : 'Standard Token Program - Fully Compatible'
              }
            </span>
          </div>
          {result.extensions.length > 0 && (
            <div className="mt-2 text-sm text-green-800">
              Detected extensions: {result.extensions.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Recommended Flow

1. **Detect Program**: Check if mint uses Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
2. **Check Extensions**: Run compatibility check before displaying teleburn options
3. **Block if Incompatible**: Display clear error with specific extension names
4. **Warn if Risky**: Show warnings but allow user to proceed
5. **Dry Run Always**: For Token-2022 mints, **always require dry run simulation** before actual teleburn

---

## Testing Matrix

| Extension | Burn | Incinerate | Teleburn-Derived | Verification |
|-----------|------|------------|------------------|--------------|
| None (T22 base) | ✅ | ✅ | ✅ | ✅ |
| Metadata | ✅ | ✅ | ✅ | ✅ |
| Non-Transferable | ❌ | ❌ | ❌ | N/A |
| Transfer Hook | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Permanent Delegate | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Transfer Fee | ✅ | ✅ | ✅ | ✅ |
| Confidential Transfer | ❌ | ❌ | ❌ | ❌ |
| Immutable Owner | ✅ | ✅ | ✅ | ✅ |
| Interest Bearing | ✅ | ✅ | ✅ | ✅ |

---

## Support Contact

If you encounter a Token-2022 extension not documented here, please:
1. Run dry run simulation and capture errors
2. Export mint account data
3. Report to KILN maintainers with extension details

---

## Future Work

- Automatic transfer hook negotiation
- Permanent delegate signature collection flow
- Extension-specific retry strategies
- Registry of known compatible/incompatible hook programs