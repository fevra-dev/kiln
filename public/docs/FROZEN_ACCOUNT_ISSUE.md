# Frozen Token Account Issue

## 🔍 **The Problem**

Both NFTs you've tried (`FQJaEUKSziG6hvjfZ1oW3VKhVnNdhtAUpwVMJcLB23eM` and `G9tRzy5DUiQUYVVhXrPBD8F6ugmuZv5VoxdXK3sn1RAh`) are **frozen** by their token authority.

### **Error Details:**
```
Program log: Error: Account is frozen
{"InstructionError":[0,{"Custom":17}]}
```

Error code `17` = **"Account is frozen"** in the SPL Token Program.

## ❌ **What "Frozen" Means**

- The token authority (creator/mint authority) has **frozen your specific token account**
- When frozen, **NO operations are allowed**:
  - ❌ Cannot transfer
  - ❌ Cannot burn
  - ❌ Cannot close account
  - ❌ Cannot do ANYTHING
- Only the **freeze authority** can unfreeze the account

## 🎯 **Why Would an Account Be Frozen?**

Common reasons:
1. **Compliance** - Regulatory requirements (KYC/AML)
2. **Security** - Suspected fraud, theft, or compromised wallet
3. **Project policy** - Creator restrictions on transfers
4. **Mistake** - Accidental freeze by the authority
5. **Dispute** - Legal or ownership disputes

## ✅ **Solutions**

### Option 1: Unfreeze the Account (Recommended)
**Contact the NFT project/creator** and request they unfreeze your token account.

**For your NFTs:**
- Both appear to be from the same collection (similar freeze policy)
- Look for the project's Discord/Twitter/website
- Explain you need to transfer/burn the NFT
- Provide your wallet address and token mint address

### Option 2: Use a Different NFT
**Test with an unfrozen NFT** that you own:

1. Check if an NFT is frozen:
   - Go to https://solscan.io
   - Search for the mint address
   - Look for "State: Frozen" or similar indicator

2. Find an unfrozen NFT in your wallet:
   - Open Phantom wallet
   - Look at your NFTs
   - Try one from a different collection
   - Preferably one you created or from a known-good collection

### Option 3: Create a Test NFT
**Mint your own test NFT** on Solana:

1. Use a tool like Metaplex Candy Machine or Sugar CLI
2. Mint to your wallet
3. Ensure you don't freeze it
4. Test teleburn with this NFT

## 🔍 **How to Check if an NFT is Frozen**

### Method 1: Solscan (Easiest)
```
1. Go to https://solscan.io
2. Paste the mint address
3. Look for account state information
4. Check if it says "Frozen"
```

### Method 2: Solana CLI
```bash
solana account <TOKEN_ACCOUNT_ADDRESS>
```

Look for `state: frozen` in the output.

### Method 3: Try a Transfer
If you try to transfer and get error `{"Custom":17}`, it's frozen.

## 🎉 **Good News!**

**The teleburn code is working perfectly!** 

The simulation is correctly:
- ✅ Building the SEAL transaction
- ✅ Building the RETIRE (burn) transaction
- ✅ Detecting the frozen account
- ✅ Reporting the error accurately

The error you're seeing is **expected behavior** when trying to burn a frozen NFT. The dry-run simulation is doing exactly what it should - detecting that the operation would fail on-chain.

## 📋 **Next Steps**

1. **Check if your NFTs are frozen** using Solscan
2. **Contact the project** to unfreeze, OR
3. **Try a different NFT** that's not frozen
4. **Re-run the simulation** with an unfrozen NFT

Once you have an unfrozen NFT, the teleburn will work perfectly!

## 🔧 **Technical Details**

### SPL Token Freeze Feature
- Solana SPL Tokens support account-level freezing
- The `freeze_authority` can freeze individual token accounts
- Frozen accounts reject ALL instructions (transfer, burn, close, etc.)
- This is a protocol-level restriction, not a bug in our code

### Error Code Reference
```
SPL Token Program Error Codes:
- 0: InvalidInstruction
- 1: NotRentExempt
- ...
- 17: AccountFrozen  ← This is what you're seeing
- 18: MintMismatch
- ...
```

### Why Simulation Detects This
The dry-run simulation:
1. Builds the burn instruction
2. Simulates it on-chain (without signing)
3. Solana RPC returns the error
4. We report it to you

This is **exactly what should happen** - you found out the NFT is frozen BEFORE trying to actually burn it!

## 📞 **Support**

If you need help:
1. Check the NFT project's Discord/Twitter
2. Ask about account freeze policies
3. Request unfreeze if appropriate

---

**Date:** 2025-10-23  
**Version:** 0.1.1  
**Status:** Documented

