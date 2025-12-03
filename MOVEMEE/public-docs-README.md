# Kiln Documentation

Complete documentation for the Kiln Teleburn Protocol.

## 🔥 What is Teleburn?

Teleburn is a protocol for **permanently migrating** Solana NFTs to Bitcoin Ordinals:

1. You create a Bitcoin inscription of your NFT artwork
2. You "teleburn" your Solana NFT using Kiln
3. Your NFT is burned on Solana with proof linking to Bitcoin
4. The migration is permanent and verifiable

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [What is Teleburn?](./TELEBURN_SUMMARY.md) | Simple explanation of the protocol |
| [How It Works](./TELEBURN_ALGORITHM.md) | Technical details |
| [API Reference](./API_REFERENCE.md) | For developers |
| [Integration Guide](./INTEGRATION_GUIDE.md) | Integration instructions |

## 🎯 Quick Start

1. **Go to** [kiln.hot/teleburn](https://kiln.hot/teleburn)
2. **Connect** your Solana wallet
3. **Select** the NFT to teleburn
4. **Enter** your Bitcoin inscription ID
5. **Review** and sign the transaction

## 📋 Kiln Memo Format

Every teleburn records this on-chain:

```json
{
  "standard": "Kiln",
  "version": "0.1.1",
  "action": "teleburn",
  "method": "metaplex-burn-v1",
  "inscription": { "id": "abc123...i0" },
  "solana": { "mint": "6ivMgoj..." },
  "media": { "sha256": "3fc113..." },
  "timestamp": 1764732009
}
```

## ❓ FAQ

**Is teleburn reversible?**  
No. Once burned, the NFT cannot be recovered. This is intentional.

**Do I need the Bitcoin inscription first?**  
Yes. Create your inscription before teleburning.

**How do I verify a teleburn?**  
Go to [kiln.hot/verify](https://kiln.hot/verify) and enter the mint address.

## 🔒 Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please email: **fev.dev@proton.me**

**DO NOT** open a public GitHub issue for security vulnerabilities.

## 📞 Support

- **Documentation**: [kiln.hot/docs](https://kiln.hot/docs)
- **Twitter**: [@fevra_](https://twitter.com/fevra_)
- **GitHub**: [github.com/fevra-dev/kiln](https://github.com/fevra-dev/kiln)

---

**Kiln Teleburn Protocol v0.1.1**  
*Last updated: December 3, 2025*  
*Status: Production Ready*
