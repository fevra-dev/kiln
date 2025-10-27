# UI Simplification: Teleburn-Derived Only

## 📋 **Changes Made**

Simplified the teleburn form to only use the `teleburn-derived` method, removing the confusing dropdown with multiple options.

### **Before:**
- Dropdown with 3 options: `teleburn-derived`, `burn`, `incinerate`
- Users had to choose between methods
- Confusing comparison table

### **After:**
- Fixed to `teleburn-derived` method only
- Clear explanation of what this method does
- No dropdown - method is automatically set

## 🎯 **Why This Change?**

1. **Teleburn-derived is the correct method** for linking Solana burns to Bitcoin Ordinals
2. **Other methods don't provide the cryptographic link** to the inscription
3. **Simpler UX** - users don't need to understand technical differences
4. **Matches the protocol spec** - this is what "teleburn" means

## 📄 **Updated UI**

The form now displays:

```
[ RETIRE METHOD: TELEBURN-DERIVED ]

✓ Cryptographically linked to Bitcoin inscription
  Derives deterministic off-curve address from inscription ID

✓ Provably unspendable
  No private key exists for the derived address

✓ Verifiable on-chain
  Anyone can verify the burn is linked to your inscription
```

## 🔧 **Technical Details**

### What `teleburn-derived` Does:

1. **Derives off-curve address** from inscription ID using SHA-256
2. **Burns the token** (reduces supply to 0)
3. **Records derived address** in on-chain memo for verification

### Why Not Transfer?

- Off-curve addresses **cannot own ATAs** on Solana
- The derived address is for **verification only**, not as a destination
- Burning + recording the derivation achieves the same goal

## 🚀 **User Flow**

1. Enter Solana mint address
2. Enter Bitcoin inscription ID
3. SHA-256 auto-fills from inscription
4. Method is automatically set to `teleburn-derived`
5. Continue to verification

**No confusing choices!** ✅

---

**Date**: October 23, 2025  
**Change**: Simplified UI to only show teleburn-derived method  
**Status**: ✅ Complete  
**Version**: 0.1.1

