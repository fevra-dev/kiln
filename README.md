# Kiln ঌ Teleburn Protocol

**Solana → Bitcoin Ordinals Migration with Cryptographic Proof**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

## 🔥 What is Kiln?

Kiln is a **teleburn protocol** for permanently migrating Solana NFTs to Bitcoin Ordinals. When you teleburn an NFT:

1. **Your Solana NFT is burned** (supply = 0)
2. **A cryptographic proof** is recorded on-chain linking to your Bitcoin inscription
3. **The burn is irreversible** - provably permanent migration

### Key Features

- **Single Transaction Burn** - Burn + memo in one atomic transaction
- **On-Chain Proof** - Simple `teleburn:<inscription_id>` memo format
- **Minimal Protocol** - ~78 bytes on-chain (vs 250+ bytes for JSON)
- **Public Verification** - Anyone can verify a teleburn at `/verify`
- **Bidirectional Linkage** - Solana memo ↔ Bitcoin metadata

## 🚀 Quick Start

### Live Site

Visit **[kiln.hot](https://kiln.hot)** to use the teleburn protocol.

### Local Development

```bash
# Clone repository
git clone <repo-url>
cd kiln

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Add your Helius/RPC API key

# Run development server
pnpm dev
```

Visit `http://localhost:3000`

## 📋 How It Works

### The Teleburn Flow

1. **Connect Wallet** - Connect your Solana wallet
2. **Enter Details** - NFT mint address and Bitcoin inscription ID
3. **Preview** - Dry-run the transaction
4. **Execute** - Sign and broadcast the burn

### Kiln Memo Format (v1.0)

Every teleburn records a simple on-chain memo:

```
teleburn:6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0
```

**Size:** ~78 bytes (vs ~250+ bytes for JSON format)

The Bitcoin inscription includes metadata linking back:

```json
{
  "p": "kiln",
  "op": "teleburn",
  "v": 1,
  "mint": "6ivMgojHapfvDKS7pFSwgCPzPvPPCT2y8Pv1zHfLqTBL"
}
```

### Verification

Anyone can verify a teleburn at `/verify`:

- ✅ Check if NFT is burned (supply = 0)
- ✅ Find Kiln memo on-chain
- ✅ View linked Bitcoin inscription
- ✅ Download proof as JSON

## 🏗 Project Structure

```
/src
  /app
    /api              # API routes
      /tx/simulate    # Transaction simulation
      /tx/update-metadata  # Metadata updates
      /verify         # Teleburn verification
    /teleburn         # Teleburn wizard UI
    /verify           # Public verification page
    /docs             # Documentation viewer
    
  /components
    /wizard           # Step-by-step wizard
    /teleburn         # Teleburn-specific components
    /ui               # Reusable UI components
    
  /lib
    /local-burn       # Core burn logic
      build-burn-memo-tx.ts  # Transaction builder
      memo.ts                # Memo format
    teleburn.ts       # Teleburn algorithm
    inscription-verifier.ts  # Content verification
    dry-run.ts        # Transaction simulation
```

## 🔐 Security

### Safety Philosophy

- **Decode** - Show human-readable transaction details
- **Simulate** - Test on-chain before broadcasting
- **Disclose** - Full transparency before signature
- **Confirm** - Explicit user consent required

### What We NEVER Do

- Store or handle private keys
- Auto-sign transactions
- Skip verification steps
- Hide transaction details

## 🧪 Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18 + TypeScript
- Tailwind CSS
- @solana/wallet-adapter-react

**Backend:**
- Next.js API Routes
- @solana/web3.js
- @metaplex-foundation/umi
- @metaplex-foundation/mpl-token-metadata

## 📚 Documentation

- [Teleburn Algorithm](./docs/TELEBURN_ALGORITHM.md) - Technical specification
- [API Reference](./docs/API_REFERENCE.md) - API endpoints
- [Integration Guide](./docs/INTEGRATION_GUIDE.md) - Developer integration

## 🌐 Environment Variables

```bash
# Required - Solana RPC (Helius recommended)
NEXT_PUBLIC_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Optional fallbacks
SOLANA_FALLBACK_RPC=https://solana-rpc.publicnode.com
```

## 🔒 Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please email: **fev.dev@proton.me**

**DO NOT** open a public GitHub issue.

## 📞 Support

- **Documentation**: [/docs](./docs)
- **Issues**: [GitHub Issues](https://github.com/fevra-dev/kiln/issues)
- **Twitter**: [@fevra_](https://twitter.com/fevra_)

## 📄 License

MIT License - See [LICENSE](./LICENSE)

---

**Built for the Solana and Bitcoin communities**

*Last updated: December 3, 2025*  
*Version: 1.0*  
*Status: Production Ready*
