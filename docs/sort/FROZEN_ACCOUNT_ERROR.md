# Frozen Token Account Error

## 🔍 **Error Details**

```
Error: {"InstructionError":[0,{"Custom":17}]}
Program log: Error: Account is frozen
```

## ❌ **What This Means**

Your NFT token account has been **frozen** by the token authority (the creator/mint authority).

### **What is a Frozen Account?**

- Solana SPL Tokens support an "account freeze" feature
- When frozen, **NO operations are allowed**:
  - ❌ Cannot transfer
  - ❌ Cannot burn
  - ❌ Cannot do anything
- Only the **freeze authority** can unfreeze the account

## 🎯 **Why Would an Account Be Frozen?**

Common reasons:
1. **Compliance** - Regulatory requirements
2. **Security** - Suspected fraud or theft
3. **Project policy** - Creator restrictions
4. **Mistake** - Accidental freeze

## ✅ **Solutions**

### Option 1: Unfreeze the Account
**Contact the NFT project/creator** and request they unfreeze your token account.

Once unfrozen, the teleburn will work normally.

### Option 2: Use a Different NFT
Test the teleburn with a different NFT that is **not frozen**.

To check if an NFT is frozen:
1. Go to https://solscan.io
2. Enter your wallet address
3. Click on the NFT
4. Look for "Account State" - if it says "Frozen", you cannot burn it

### Option 3: Wait for Unfreeze
Some projects automatically unfreeze accounts after certain conditions are met.

## 🔧 **Technical Details**

### SPL Token Error Code 17:
```rust
/// Account is frozen
AccountFrozen = 17,
```

From `spl_token::error::TokenError`

### What Happens When You Try to Burn:
```
1. Burn instruction is sent
2. SPL Token Program checks account state
3. Sees account is frozen
4. Rejects with error code 17
5. Transaction fails
```

## 📋 **How to Check if Your NFT is Frozen**

### Method 1: Solscan
1. Visit https://solscan.io
2. Search for your wallet address
3. Find the NFT in your tokens
4. Check "State" field

### Method 2: Solana CLI
```bash
spl-token account-info <TOKEN_ACCOUNT_ADDRESS>
```

Look for:
```
State: Frozen
```

## 🚀 **Next Steps**

1. **Verify the account is frozen** using Solscan
2. **Contact the NFT creator** to request unfreeze
3. **Or test with a different NFT** that you own

---

**Note**: This is **not a bug** in the teleburn code. The simulation is working correctly - it's detecting that your specific NFT cannot be burned because it's frozen by the creator.

**Date**: October 23, 2025  
**Error**: Account is frozen (Custom:17)  
**Status**: Expected behavior - NFT is frozen by creator  
**Version**: 0.1.1

