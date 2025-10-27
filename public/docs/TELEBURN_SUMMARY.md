# What is Teleburn?

**Teleburn** permanently links Solana NFTs to Bitcoin Ordinals through cryptographic burning.

## The Problem

NFTs are trapped on their original blockchain with no native way to move between chains.

## The Solution

1. **Burn** your Solana NFT (permanently destroy it)
2. **Record** the burn with your Bitcoin inscription ID
3. **Verify** the link using SHA-256 cryptography

## Key Benefits

- **Irreversible**: Permanent cross-chain link
- **No Custody**: Your assets are never held by third parties
- **Cryptographically Secure**: SHA-256 ensures tamper-proof verification
- **Verifiable**: Anyone can verify the burn is linked to your inscription

## How It Works

1. **Derive Address**: Create unique Solana address from Bitcoin inscription ID
2. **Burn NFT**: Permanently destroy the NFT (supply → 0)
3. **Record Memo**: Store inscription ID and burn details
4. **Verify Link**: Use inscription ID to verify burn legitimacy

## Use Cases

- **Permanent Migration**: Move NFTs from Solana to Bitcoin
- **Cross-Chain Proof**: Prove ownership across blockchains
- **Asset Linking**: Create verifiable connections between digital assets

## Security

- **Off-Curve Addresses**: No private key exists for derived addresses
- **SHA-256 Hashing**: Cryptographically secure derivation
- **Public Verification**: Anyone can verify burn legitimacy

---

**Ready to teleburn?** Start with our [Getting Started Guide](/README.md) or learn the [technical details](/docs/TELEBURN_ALGORITHM.md).