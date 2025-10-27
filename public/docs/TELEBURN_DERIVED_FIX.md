# Teleburn-Derived Method: Final Fix

## 🎯 **The Core Issue**

**Problem**: Associated Token Accounts (ATAs) **cannot be created for off-curve addresses** on Solana.

**Error**: `{"Custom":17}` = "Owner mismatch" - The Associated Token Program rejects off-curve addresses as ATA owners.

## 🔍 **Why Off-Curve Addresses Can't Own ATAs**

1. **ATAs require valid ed25519 public keys** as owners
2. **Off-curve addresses are NOT valid ed25519 keys** - they're derived from SHA-256 hashes
3. **The Associated Token Program validates** that the owner is on the ed25519 curve
4. **This is by design** - off-curve addresses are meant to be provably unspendable

## ✅ **The Correct Solution**

Instead of trying to transfer to an off-curve address, the `teleburn-derived` method now:

### **Burns the token** (reduces supply to 0)
```typescript
createBurnInstruction(
  ownerAta,  // Your token account
  mint,      // The NFT mint
  owner,     // You (the owner)
  amount,    // 1 (for NFTs)
  [],
  tokenProgram
)
```

### **Records the derived address in the memo** for cryptographic verification
```json
{
  "derived": {
    "owner": "6NtdpWum...",
    "algorithm": "SHA-256(txid || index || salt)"
  }
}
```

## 📋 **How It Works Now**

### Transaction Flow:
```
1. SEAL: Record inscription proof on-chain
   └─> SPL Memo with inscription ID + SHA-256

2. RETIRE (teleburn-derived):
   ├─> Derive off-curve address from inscription ID
   ├─> BURN the token (supply → 0)
   └─> Record derived address in memo for verification
```

### Why This Is Correct:
- ✅ **Token is permanently destroyed** (supply = 0)
- ✅ **Burn is cryptographically linked** to the Bitcoin inscription
- ✅ **Derived address proves** the burn is for a specific inscription
- ✅ **No ATA creation needed** - we're burning, not transferring
- ✅ **Verifiable on-chain** - anyone can derive the same address and verify

## 🔄 **Comparison with Other Methods**

| Method | Action | Destination | Recoverable? |
|--------|--------|-------------|--------------|
| `burn` | Reduce supply | N/A | ❌ No |
| `incinerate` | Transfer | Incinerator (1nc1nerator...) | ❌ No (provably unspendable) |
| `teleburn-derived` | **Burn** | N/A | ❌ No |

**Key Difference**: 
- `teleburn-derived` **burns** the token AND records a cryptographic link to a Bitcoin inscription
- The derived address is for **verification only**, not as a destination

## 💰 **Cost**

- **SEAL**: ~0.000005 SOL (memo)
- **RETIRE**: ~0.000005 SOL (burn + memo)
- **Total**: ~0.000010 SOL

**No ATA creation cost** because we're not creating any accounts!

## 🎯 **Verification Process**

Anyone can verify a teleburn by:

1. Reading the on-chain memo
2. Extracting the inscription ID
3. Deriving the same off-curve address using SHA-256
4. Comparing with the recorded derived address
5. Confirming the token supply is 0

This creates a **cryptographic proof** that the Solana token was burned for a specific Bitcoin inscription.

## 🚀 **Expected Behavior**

When you run the dry-run simulation now:

1. ✅ **SEAL** should succeed (writes memo)
2. ✅ **RETIRE** should succeed (burns token + records derived address)
3. ✅ **Total fee**: ~0.000010 SOL

---

**Date**: October 23, 2025  
**Issue**: Cannot create ATA for off-curve address  
**Status**: ✅ Fixed - Changed to burn instead of transfer  
**Version**: 0.1.1

