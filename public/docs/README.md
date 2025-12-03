# Kiln Documentation

Complete documentation for the Kiln Teleburn Protocol.

## 🔥 What is Teleburn?

Teleburn is a protocol for **permanently migrating** Solana NFTs to Bitcoin Ordinals:

1. You create a Bitcoin inscription of your NFT artwork
2. You "teleburn" your Solana NFT using Kiln
3. Your NFT is burned on Solana with proof linking to Bitcoin
4. The migration is permanent and verifiable

## 📚 Documentation

### Getting Started
- **[TELEBURN_SUMMARY.md](./TELEBURN_SUMMARY.md)** - What is teleburn and why use it
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - How to use Kiln

### Technical Docs
- **[TELEBURN_ALGORITHM.md](./TELEBURN_ALGORITHM.md)** - How the algorithm works
- **[API_REFERENCE.md](./API_REFERENCE.md)** - API endpoints for developers

### Security
- **[SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)** - Security considerations

## 🎯 Quick Start

### For Users

1. Go to [kiln.hot/teleburn](https://kiln.hot/teleburn)
2. Connect your Solana wallet
3. Select the NFT to teleburn
4. Enter your Bitcoin inscription ID
5. Review and sign the transaction

### For Developers

```typescript
// Verify a teleburn
const response = await fetch('/api/verify', {
  method: 'POST',
  body: JSON.stringify({ mint: 'YOUR_MINT_ADDRESS' })
});

const result = await response.json();
// result.isOfficialKilnBurn = true if Kiln memo found
// result.kilnMemo = full memo object
```

## 📋 Kiln Memo Format

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

## 🔐 Security

- All transactions are simulated before execution
- User must sign every transaction
- Content hash verified before burn
- Burns are irreversible - verify carefully!

## ❓ FAQ

**Q: Is teleburn reversible?**
A: No. Once burned, the NFT cannot be recovered. This is by design.

**Q: Do I need the inscription first?**
A: Yes. Create your Bitcoin inscription before teleburning.

**Q: How do I verify a teleburn?**
A: Go to `/verify` and enter the mint address.

**Q: What if I enter the wrong inscription ID?**
A: The burn will still occur but link to the wrong inscription. Always double-check!

## 🔒 Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please email: **fev.dev@proton.me**

**DO NOT** open a public GitHub issue.

## 📞 Support

- **Documentation**: [/docs](/docs)
- **Issues**: [GitHub Issues](https://github.com/fevra-dev/kiln/issues)
- **Twitter**: [@fevra_](https://twitter.com/fevra_)

---

**Built for the Solana and Bitcoin communities**

*Last updated: December 3, 2025*  
*Version: 0.1.1*  
*Status: Production Ready*
