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

That's it! Kiln automatically fetches and calculates the SHA-256 hash for you.

### How to Find Your Inscription ID

1. Go to [ordinals.com](https://ordinals.com)
2. Find your inscription
3. Copy the full inscription ID from the URL (e.g., `3196a9df76157962672238a18e450d0398a78c77d114bd552c832d59b7081a2di0`)

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

### 💡 Pro Tip: Link Your Solana NFT in Inscription Metadata

When inscribing on Bitcoin, we **highly recommend** adding your Solana NFT mint address as a **trait/attribute** in the inscription metadata. This creates a **two-way on-chain link** between both blockchains:

**How to do it on inscribe.dev:**
1. Go to [inscribe.dev](https://inscribe.dev/)
2. Connect your Bitcoin wallet (Xverse, Unisat, or Magic Eden)
3. Upload your art file
4. In the **Attributes** section, click **+ Add trait**:
   - **Title**: `solana_mint` (or similar)
   - **Value**: Your Solana NFT mint address (e.g., `6ivMgojprszJjAhuGwGQShwUtn98mm3pQ6idqzwy66Kb`)
5. Complete the inscription process

**Why this matters:**
- ✅ Creates verifiable connection from **Bitcoin → Solana**
- ✅ Combined with Kiln teleburn, creates connection from **Solana → Bitcoin**
- ✅ **Two-way cryptographic proof** on both blockchains
- ✅ Anyone can verify the relationship from either chain

---

## Step-by-Step Teleburn Process

### Step 1: Enter Your Details

1. Go to [kiln.hot/teleburn](https://kiln.hot/teleburn)
2. Enter your **Solana NFT Mint Address**
   - Find this in your wallet or on Solscan
   - It's a long string like `6ivMgojprszJjAhuGwGQShwUtn98mm3pQ6idqzwy66Kb`
3. Enter your **Bitcoin Inscription ID**
   - The full ID including the `i0` at the end
4. Click **Continue**

### Step 2: Connect Your Wallet

1. Click **Connect Wallet**
2. Select your wallet (Phantom, Solflare, etc.)
3. Approve the connection in your wallet

### Step 3: Verify Your Inscription

Kiln will automatically:
- ✅ Fetch your inscription from Bitcoin
- ✅ Calculate the SHA-256 hash of the media
- ✅ Verify everything matches

If verification passes, you'll see a green checkmark. If not, double-check your inscription ID.

### Step 4: Preview the Transaction

Before burning, Kiln simulates the transaction to show you:
- 💰 **Estimated fees** (usually ~0.00001 SOL)
- 📝 **What will happen** (burn NFT + record proof)
- ⚠️ **Any warnings** (if something looks wrong)

Review everything carefully. Once you proceed, **this cannot be undone**.

### Step 5: Execute the Teleburn

1. Click **Execute Teleburn**
2. Your wallet will pop up asking you to sign
3. Review the transaction in your wallet
4. Click **Approve** to sign and broadcast

### Step 6: Confirmation

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
- An official Kiln memo was found on-chain
- The burn is linked to a Bitcoin inscription

**✓ ACTIVE** (Green banner)
- The NFT still exists
- It has NOT been teleburned

### What You'll See

For a teleburned NFT:
- **Status**: Burned/Teleburned
- **Burn Tx**: Link to the burn transaction
- **Inscription**: Link to the Bitcoin inscription
- **Kiln Memo**: The on-chain proof with all details

You can also:
- 📥 **Download the Kiln Memo** as JSON for your records
- 🔗 **View on Helius Orb** to see the full transaction details

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
The teleburn proof (Kiln memo) is stored **on the Solana blockchain** in the same transaction as the burn. It's permanent and publicly verifiable.

---

## Need Help?

- **Twitter**: [@fevra_](https://twitter.com/fevra_)
- **GitHub Issues**: [Report a bug](https://github.com/fevra-dev/kiln/issues)

---

*Last updated: December 3, 2025*

