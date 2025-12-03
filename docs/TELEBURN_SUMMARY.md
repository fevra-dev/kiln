# What is Teleburn?

**Teleburn** is a protocol for permanently migrating Solana NFTs to Bitcoin Ordinals with cryptographic proof.

## 🎯 The Concept

When you "teleburn" an NFT:

1. 🔥 **Your Solana NFT is burned** - Supply goes to 0, permanently
2. 📝 **A Kiln memo is recorded** - On-chain proof linking to your Bitcoin inscription
3. ✅ **The burn is verifiable** - Anyone can verify the migration

## 🤔 Why Teleburn?

**Problem:** NFTs are trapped on their original blockchain with no native cross-chain solution.

**Solution:** Burn the Solana NFT and record proof of its migration to Bitcoin Ordinals.

## 🔥 How Kiln Works

### Step 1: Prepare
- Create your Bitcoin inscription (ordinals.com)
- Get your inscription ID (e.g., `abc123...i0`)
- Have your Solana NFT ready

### Step 2: Teleburn
- Connect wallet at [kiln.hot](https://kiln.hot)
- Select NFT to burn
- Enter inscription ID
- Verify content hash matches
- Sign the transaction

### Step 3: Verify
- Check burn at `/verify`
- Download your Kiln memo as JSON
- Share verification link

## 📝 The Kiln Memo

Every teleburn records this on-chain:

```json
{
  "standard": "Kiln",
  "version": "0.1.1",
  "action": "teleburn",
  "method": "metaplex-burn-v1",
  "inscription": {
    "id": "3196a9df76157962...i0"
  },
  "solana": {
    "mint": "6ivMgojprszJjAhu..."
  },
  "media": {
    "sha256": "3fc11368f195da08..."
  },
  "timestamp": 1764732009
}
```

## ✅ NFT Compatibility

| Type | Supported | Notes |
|------|-----------|-------|
| Standard NFTs | ✅ Yes | SPL Token program |
| pNFTs | ✅ Yes | Metaplex Programmable NFTs |
| Compressed NFTs | ⚠️ Limited | Coming soon |
| Token-2022 | ✅ Yes | With SPL compatibility |

## 🔐 Security

- **No Private Keys**: Kiln never sees your keys
- **Simulated First**: All transactions dry-run before execution
- **User Signed**: You sign every transaction
- **Irreversible**: Burns are permanent - verify carefully!

## ❓ FAQ

**Is teleburn reversible?**
No. Once burned, the NFT cannot be recovered. This is intentional.

**Do I need the Bitcoin inscription first?**
Yes. Create your inscription before teleburning.

**What if I enter the wrong inscription ID?**
The burn will link to the wrong inscription. Always verify before signing!

**How do I verify a teleburn?**
Go to `/verify` and enter the Solana mint address.

**Can I update the inscription ID after burning?**
No. The link is permanent once recorded on-chain.

---

**Ready to teleburn?** Visit [kiln.hot/teleburn](https://kiln.hot/teleburn)
