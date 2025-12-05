# 🔥 Kiln User Guide

**A simple step-by-step guide to teleburning your Solana NFT to Bitcoin**

---

## What is Teleburn?

Teleburn permanently links your Solana NFT to a Bitcoin Ordinals inscription. After teleburning:
- Your Solana NFT is **permanently destroyed** (burned)
- A cryptographic proof links it to your Bitcoin inscription
- Anyone can verify this link forever

⚠️ **This is irreversible!** Make sure you want to do this before proceeding.

---

## Before You Start

You'll need:
1. ✅ A **Solana wallet** (like Phantom) with your NFT
2. ✅ A small amount of **SOL** for transaction fees (~0.01 SOL)
3. ✅ Your **Bitcoin Ordinals inscription ID** (looks like: `abc123...i0`)

That's it! Kiln uses a simple memo format to link your burn to your inscription.

### How to Find Your Inscription ID

1. Go to [ordinals.com](https://ordinals.com)
2. Find your inscription
3. Copy the full inscription ID from the URL (e.g., `7a414bae133fc150086a78419ec3e7a8d808fc0628a36cb85126a44d5e86c2e9i0`)

---

## Don't Have an Inscription Yet?

If you haven't inscribed your art on Bitcoin Ordinals yet, we recommend using a self-custodial inscribing tool.

### Recommended: inscribe.dev by The Wizards of Ord

[**inscribe.dev**](https://inscribe.dev/) is a self-custodial inscription tool built by [The Wizards of Ord](https://wizards.art/) team. It's one of the most feature-rich and reliable tools available.

**Key Features:**
- 🔐 **Self-custodial** - Your keys, your inscriptions
- 📦 **Batch inscriptions** - Inscribe multiple files at once
- 🎨 **Metadata & traits** - Add on-chain attributes
- 👪 **Parent/child inscriptions** - Collection provenance
- 💎 **Rare sat support** - Inscribe on specific sats
- 🔄 **Reinscriptions** - Update existing inscriptions

### 💡 Pro Tip: Use KILN Inscription Metadata Format

When inscribing on Bitcoin, we **highly recommend** using the KILN metadata format. This creates a **two-way on-chain link** between both blockchains:

**KILN Metadata Format (Standard):**
```json
{
  "p": "kiln",
  "op": "teleburn",
  "v": 1,
  "mint": "A4go8JM9uuy6vzbRzPwg8F5ZkCkgqct1htscMpSECMhw",
  "name": "Your NFT Name",
  "collection": "Your Collection"
}
```

**Why this matters:**
- ✅ Creates verifiable connection from **Bitcoin → Solana**
- ✅ Combined with Kiln teleburn memo, creates connection from **Solana → Bitcoin**
- ✅ **Two-way cryptographic proof** on both blockchains
- ✅ Anyone can verify the relationship from either chain
- ✅ Follows BRC-20 conventions for easy indexing

See the [Inscription Metadata Specification](/docs/INSCRIPTION_METADATA_SPEC.md) for complete details.

---

## Step-by-Step Teleburn Process

### Step 1: Enter Your Details

1. Go to [kiln.hot/teleburn](https://kiln.hot/teleburn)
2. Enter your **Solana NFT Mint Address**
   - Find this in your wallet or on Solscan
   - It's a long string like `A4go8JM9uuy6vzbRzPwg8F5ZkCkgqct1htscMpSECMhw`
3. Enter your **Bitcoin Inscription ID**
   - The full ID including the `i0` at the end
4. Click **Continue**

### Step 2: Connect Your Wallet

1. Click **Connect Wallet**
2. Select your wallet (Phantom, Solflare, etc.)
3. Approve the connection in your wallet

### Step 3: Preview the Transaction

Kiln will automatically:
- ✅ Build the burn transaction with memo
- ✅ Simulate the transaction (dry run)
- ✅ Show you exactly what will happen

You'll see:
- 💰 **Estimated fees** (usually ~0.00001 SOL)
- 📝 **What will happen** (burn NFT + record proof)
- ⚠️ **Any warnings** (if something looks wrong)

Review everything carefully. Once you proceed, **this cannot be undone**.

### Step 4: Execute the Teleburn

1. Click **Execute Teleburn**
2. Your wallet will pop up asking you to sign
3. Review the transaction in your wallet
4. Click **Approve** to sign and broadcast

### Step 5: Confirmation

Once confirmed, you'll see:
- 🔥 **Success animation** with sound effects
- 📜 **Transaction signature** (proof of burn)
- 🔗 **Links** to view on blockchain explorers

**Congratulations!** Your NFT has been teleburned. 🎉

---

## How to Verify a Teleburn

Anyone can verify that an NFT was teleburned using the verification page.

### Using the Verify Page

1. Go to [kiln.hot/verify](https://kiln.hot/verify)
2. Enter the **Solana NFT Mint Address**
3. Click **Verify**

### Understanding the Results

**🔥 TELEBURNED** (Orange banner)
- The NFT has been burned (supply = 0)
- A teleburn memo was found on-chain (format: `teleburn:<inscription_id>`)
- The burn is linked to a Bitcoin inscription

**✓ ACTIVE** (Green banner)
- The NFT still exists
- It has NOT been teleburned

### What You'll See

For a teleburned NFT:
- **Status**: Burned/Teleburned
- **Burn Tx**: Link to the burn transaction
- **Inscription**: Link to the Bitcoin inscription
- **Teleburn Memo**: The on-chain proof (format: `teleburn:<inscription_id>`)

You can also:
- 🔗 **View on Helius Orb** to see the full transaction details
- 🔗 **View on Solscan** to see the burn transaction

---

## Frequently Asked Questions

### Is teleburn reversible?
**No.** Once your NFT is burned, it cannot be recovered. The Solana token is permanently destroyed.

### Do I need to own the Bitcoin inscription?
The teleburn protocol doesn't verify ownership of the Bitcoin inscription. However, for authenticity, you should only teleburn to inscriptions you own.

### How much does it cost?
Teleburn only costs Solana transaction fees, typically ~0.00001 SOL (less than $0.01).

### How long does it take?
The burn transaction typically confirms in 5-30 seconds, depending on network congestion.

### What if my transaction fails?
If the transaction fails, your NFT is NOT burned. You can try again. Common issues:
- Insufficient SOL for fees
- Network congestion (try again in a few minutes)
- Invalid inscription ID

### Can I teleburn any NFT?
Kiln supports:
- ✅ Regular Solana NFTs
- ✅ Programmable NFTs (pNFTs)
- ✅ Metaplex standard NFTs

Kiln does NOT support:
- ❌ Fungible tokens (like USDC, SOL)
- ❌ Semi-fungible tokens (supply > 1)

### Where is the proof stored?
The teleburn proof (memo: `teleburn:<inscription_id>`) is stored **on the Solana blockchain** in the same transaction as the burn. It's permanent and publicly verifiable. The memo is ~78 bytes and uses a simple string format for easy parsing and indexing.

---

## Need Help?

- **Twitter**: [@fevra_](https://twitter.com/fevra_)
- **GitHub Issues**: [Report a bug](https://github.com/fevra-dev/kiln/issues)

---

*Last updated: December 5, 2025*  
*Protocol Version: 1.0*

