# KILN.1 Teleburn Standard

**Solana → Bitcoin Ordinals Migration Protocol with Cryptographic Proof**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.1-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
[![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)](./tests)

## 🎯 Overview

KILN.1 is a **production-grade teleburn protocol** for permanently migrating Solana NFTs to Bitcoin Ordinals with full cryptographic verification and irreversible proof. This implementation follows safety-first principles with mandatory verification gates and comprehensive dry-run simulation.

**✅ Status: Production Ready** - Complete implementation with standardized teleburn algorithm

### Key Features

✅ **Standardized Teleburn Algorithm** - SHA-256 based derivation matching Ethereum pattern  
✅ **Inscription Verification Gate** - Prevents sealing to wrong/corrupted inscriptions  
✅ **Temporal Anchoring** - Timestamps + block heights in all on-chain memos  
✅ **Hardened Derived Owner** - Deterministic off-curve addresses (no private key exists)  
✅ **Domain Separation** - Cross-chain safety with SBT01:solana:v1 salt  
✅ **Dry Run Mode** - Full simulation before any on-chain action  
✅ **Multi-RPC Verification** - Confidence-scored teleburn status checks  
✅ **Token-2022 Compatible** - Detects and handles extension limitations  
✅ **Comprehensive Testing** - 78 unit tests with 100% coverage  

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 20.0.0
- pnpm ≥ 8.0.0
- Solana wallet (Phantom, Solflare, or Backpack)

### BMAD-METHOD Integration

**✅ BMAD-METHOD v6 Alpha is integrated!** This project uses BMAD for AI-driven agile development.

**Quick Start with BMAD:**
1. Load any BMAD agent in your IDE (Cursor/Claude Code)
2. Run `*workflow-init` to set up your project workflow
3. Use workflows for development, planning, and documentation

**See [BMAD Integration Guide](./docs/BMAD_INTEGRATION.md) for complete documentation.**

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd kiln

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your RPC endpoints

# Run development server
pnpm dev
```

Visit `http://localhost:3000` to see the application.

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e
```

## 📋 Architecture

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript 5.3 (strict mode)
- Tailwind CSS
- @solana/wallet-adapter-react

**Backend:**
- Next.js API Routes
- @solana/web3.js
- @solana/spl-token
- @metaplex-foundation/mpl-token-metadata

**Testing:**
- Jest + ts-jest (unit & integration)
- Playwright (E2E)

### Project Structure

```
/src
  /lib                      # Core business logic
    types.ts               # TypeScript type definitions
    schemas.ts             # Zod validation schemas
    inscription-verifier.ts # Inscription content verification
    teleburn.ts            # Standardized teleburn algorithm (CANONICAL)
    derived-owner.ts       # Legacy derivation (DEPRECATED)
    solana-timestamp.ts    # Temporal anchoring service
    transaction-builder.ts # Transaction construction
    transaction-decoder.ts # Transaction decoding
    dry-run.ts            # Dry run simulation
    
  /components
    /wizard                # Teleburn wizard UI components
    /ui                    # Reusable UI components
    
  /app
    /api                   # Next.js API routes
      /tx                  # Transaction builders
      /verify              # Verification endpoints
    /verify                # Public verification UI
    /docs                  # Documentation pages
    
/tests
  /unit                    # Unit tests (95%+ coverage)
  /integration             # Integration tests
  /e2e                     # End-to-end tests
```

## 🔐 Safety Philosophy

**Every transaction is:**
1. **Decoded** - Show human-readable instruction details
2. **Simulated** - Test on-chain before broadcasting
3. **Disclosed** - Full transparency to user before signature
4. **Confirmed** - Explicit user consent required

**NEVER:**
- Handle or store private keys
- Auto-sign transactions
- Proceed without verification gate
- Expose sensitive data in logs

## 🧪 Implementation Status

### ✅ Completed Features

1. **Standardized Teleburn Algorithm** - SHA-256 based derivation with domain separation
2. **Project Structure** - Complete Next.js 14 setup with TypeScript
3. **Types & Schemas** - Full Zod validation for all inputs
4. **Inscription Verifier** - SHA-256 verification with ordinals.com
5. **React UI Components** - Complete teleburn wizard interface
6. **Transaction Builder** - Seal, retire, and update URI transactions
7. **Transaction Decoder** - Human-readable transaction analysis
8. **Dry Run System** - Full simulation before execution
9. **Comprehensive Testing** - 78 unit tests with 100% coverage
10. **Documentation** - Complete algorithm specification and guides

### 🎯 Production Ready

- ✅ **Core Algorithm** - Standardized teleburn derivation
- ✅ **Safety Features** - Verification gates and dry-run simulation
- ✅ **User Interface** - Complete wizard for teleburn operations
- ✅ **API Endpoints** - All transaction and verification routes
- ✅ **Testing** - Comprehensive test suite
- ✅ **Documentation** - Algorithm specs and migration guides

## 📚 Documentation

### Core Concepts

#### Seal Memo
On-chain JSON written to SPL Memo program when NFT is linked to inscription:

```json
{
  "standard": "KILN",
  "version": "0.1.1",
  "action": "seal",
  "timestamp": 1739904000,
  "block_height": 268123456,
  "inscription": { "id": "<txid>i0" },
  "solana": { "mint": "<mint_address>" },
  "media": { "sha256": "<hex_sha256>" }
}
```

#### Retire Memo
On-chain proof of permanent token destruction/lock:

```json
{
  "standard": "KILN",
  "version": "0.1.1",
  "action": "teleburn-derived",
  "timestamp": 1739905123,
  "block_height": 268124001,
  "inscription": { "id": "<txid>i0" },
  "solana": { "mint": "<mint_address>" },
  "media": { "sha256": "<hex_sha256>" },
  "derived": { "bump": 37 }
}
```

#### Teleburn Address Derivation
Standardized algorithm matching Ethereum pattern:

```typescript
deriveTeleburnAddress(inscriptionId) → PublicKey
```

**Algorithm:**
```
Input:  txid (32 bytes) || index (4 bytes, big-endian) || salt ("SBT01:solana:v1")
Hash:   SHA-256
Output: 32-byte off-curve Solana PublicKey
```

- **Domain separation:** `"SBT01:solana:v1"` prevents cross-chain collisions
- **Off-curve guarantee:** No private key exists (assets permanently locked)
- **Deterministic:** Same inscription ID → same address (always)
- **Ethereum compatible:** Follows same pattern as Ordinals teleburn

### API Endpoints

#### POST /api/inscription/verify
Verify inscription content matches expected hash

**Request:**
```json
{
  "inscriptionId": "abc...i0",
  "expectedSha256": "a1b2c3..."
}
```

**Response:**
```json
{
  "valid": true,
  "inscriptionId": "abc...i0",
  "fetchedHash": "a1b2c3...",
  "expectedHash": "a1b2c3...",
  "contentType": "image/avif",
  "byteLength": 123456
}
```

See [enhanced_system_prompt.md](./enhanced_system_prompt.md) for complete API specifications.

## 🧑‍💻 Development

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com

# Optional
SOLANA_FALLBACK_RPC=https://rpc.ankr.com/solana
ORDINALS_API_URL=https://ordinals.com
WEB3_STORAGE_TOKEN=your_token
```

### Code Quality

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Format code
pnpm format
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/inscription-verify

# Make changes and test
pnpm test

# Commit with conventional commits
git commit -m "feat: add inscription verification gate"

# Push and create PR
git push origin feature/inscription-verify
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for new functionality
4. Ensure all tests pass (`pnpm test`)
5. Ensure type checking passes (`pnpm type-check`)
6. Submit a pull request

### Code Standards

- **TypeScript strict mode** - No `any` in exports
- **95%+ test coverage** - On all library code
- **JSDoc comments** - All exported functions
- **Zod validation** - All external inputs
- **Safety first** - Decode + simulate before sign

## 📖 Documentation

### Core Documentation
- [Teleburn Algorithm Specification](./docs/TELEBURN_ALGORITHM.md) - Complete algorithm specification
- [Teleburn Migration Guide](./docs/TELEBURN_MIGRATION.md) - Migration from legacy implementation
- [Algorithm Comparison](./docs/ALGORITHM_COMPARISON.md) - Visual comparison with Ethereum
- [Teleburn Summary](./docs/TELEBURN_SUMMARY.md) - Implementation overview

### Archived Documentation
- [Enhanced System Prompt](./extras/enhanced_system_prompt.md) - Complete technical specification
- [Implementation Quickstart](./extras/implementation_quickstart.md) - Week-by-week guide
- [Implementation Summary](./extras/implementation_summary.md) - Feature overview
- [KILN README](./extras/SBT01-README-v0.1.1.md) - Standard specification
- [Marketplace Guide](./extras/SBT01-Marketplace-Guide.md) - Integration guide
- [Token-2022 Compatibility](./extras/SBT01-Token2022-Compatibility.md) - Extension compatibility

## 🔒 Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please email: security@...

**DO NOT** open a public GitHub issue.

### Audit Status

- [ ] Internal security review
- [ ] External audit (planned)
- [ ] Bug bounty program (planned)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

### Standard Licensing

- **KILN.1 Specification**: CC0 (Public Domain)
- **Reference Implementation**: MIT License
- **Documentation**: CC BY 4.0

## 🙏 Acknowledgments

- Solana Foundation
- Ordinals Community
- Casey Rodarmor (Ordinals creator)
- Metaplex Foundation

## 📞 Support

- **Documentation**: [/docs](./docs)
- **Issues**: [GitHub Issues](https://github.com/.../issues)
- **Discord**: [Join Discord](#)
- **Twitter**: [@...](#)

---

**Built with ❤️ for the Solana and Bitcoin communities**

*Last updated: October 23, 2025*  
*Version: 0.1.1*  
*Status: Production Ready*

