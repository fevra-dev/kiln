# Associated Token Account (ATA) Creation Fix

## 🐛 Problem Identified

**Issue 1**: Dry-run simulation was failing with `InvalidAccountData` error when attempting to transfer NFTs using the `teleburn-derived` or `incinerate` methods.

**Root Cause 1**: The destination Associated Token Account (ATA) didn't exist on-chain, and Solana requires the ATA to exist before you can transfer tokens to it.

**Issue 2**: After adding ATA creation, received `{"Custom":1}` error from Associated Token Program.

**Root Cause 2**: The standard `createAssociatedTokenAccountInstruction` fails if the account already exists. Needed to use the **idempotent** version instead.

## 🔧 Solution Implemented

Updated `src/lib/transaction-builder.ts` to automatically create the destination ATA if it doesn't exist before attempting the transfer.

### Changes Made:

1. **Added idempotent import**:
   ```typescript
   import {
     // ... existing imports
     createAssociatedTokenAccountIdempotentInstruction,
   } from '@solana/spl-token';
   ```

2. **Updated `teleburn-derived` case**:
   - Always add `createAssociatedTokenAccountIdempotentInstruction` before transfer
   - **Idempotent** means it won't fail if the account already exists
   - The payer pays the rent for ATA creation (~0.002 SOL) only on first creation
   - Subsequent calls with the same inscription ID are free

3. **Updated `incinerate` case**:
   - Same idempotent logic for incinerator ATA
   - Ensures incinerator ATA exists before transfer without throwing errors

## 📋 Transaction Flow (After Fix)

### Before (Failed):
```
1. SEAL: Write memo ✅
2. RETIRE: Transfer to non-existent ATA ❌ InvalidAccountData
```

### After (Fixed):
```
1. SEAL: Write memo ✅
2. RETIRE: 
   a. Check if destination ATA exists
   b. If not, create ATA (costs ~0.002 SOL rent)
   c. Transfer NFT to ATA ✅
```

## 💰 Cost Implications

- **SEAL**: ~0.000005 SOL (unchanged)
- **RETIRE**: 
  - First time for a given NFT/inscription combo: ~0.002005 SOL (includes ATA rent)
  - Subsequent times (ATA already exists): ~0.000005 SOL

## ✅ Expected Behavior Now

When you run the dry-run simulation with your Chungos NFT:
1. ✅ SEAL will succeed (writes memo)
2. ✅ RETIRE will succeed (creates ATA + transfers)
3. Total estimated fee: ~0.002010 SOL on first burn for this inscription

## 🎯 Test Instructions

1. Navigate to `http://localhost:3000/teleburn`
2. Connect your wallet (FmbbyB...rMV4fj)
3. Enter:
   - Mint: `FQJaEUKSziG6hvjfZ1oW3VKhVnNdhtAUpwVMJcLB23eM`
   - Inscription: Your Bitcoin inscription ID
   - Method: `teleburn-derived`
4. Click "Execute Dry Run Simulation"
5. **Expected**: Both SEAL and RETIRE should show ✅ success

---

**Date**: October 23, 2025  
**Issue**: InvalidAccountData on RETIRE simulation  
**Status**: ✅ Fixed  
**Version**: 0.1.1

