# KILN Teleburn Protocol v1.0 — Summary

**Teleburn** permanently links Solana NFTs to Bitcoin Ordinals through a minimal, verifiable burn mechanism.

## The Protocol

### Solana Burn Memo
```
teleburn:6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0
```

### Bitcoin Inscription Metadata

**Minimal:**
```json
{"p":"kiln","op":"teleburn","v":1,"mint":"7i3co96..."}
```

**Standard (recommended):**
```json
{"p":"kiln","op":"teleburn","v":1,"mint":"7i3co96...","name":"Little Swag World #1657","collection":"Little Swag World"}
```

**Full:**
```json
{"p":"kiln","op":"teleburn","v":1,"mint":"7i3co96...","name":"Little Swag World #1657","collection":"Little Swag World","burn_tx":"5Kj2nF...","attributes":[{"trait_type":"Eyes","value":"Glow"}]}
```

## How It Works

1. **Burn NFT**: Permanently destroy the Solana NFT (supply → 0)
2. **Record Memo**: Store inscription ID in simple string format: `teleburn:<inscription_id>`
3. **Inscribe on Bitcoin**: Include metadata with Solana mint address
4. **Verify Bidirectionally**: Check link from either chain

## Key Benefits

- **Minimal**: ~78 bytes on Solana, ~75-300 bytes on Bitcoin
- **Simple**: No complex JSON, no derived addresses, no SHA-256 verification
- **Verifiable**: Anyone can verify the burn is linked to your inscription
- **Ecosystem-Friendly**: Generic `teleburn:` prefix for wide adoption

## NFT Compatibility

- **✅ Standard NFTs**: SPL Token program NFTs work perfectly
- **✅ Programmable NFTs (pNFTs)**: Token-2022 NFTs supported with SPL Token compatibility
- **✅ Frozen pNFTs**: Can be burned using SPL Token program
- **✅ All Solana NFTs**: Compatible with existing burn tools and wallets

## Bidirectional Verification

```
Solana → Bitcoin:  teleburn:abc123...i0
Bitcoin → Solana:  {"p":"kiln","mint":"7i3co96..."}
```

Both chains point to each other. Verify from either direction.

## Size Comparison

| Format | Size |
|--------|------|
| Solana memo | ~78 bytes |
| Minimal inscription | ~75 bytes |
| Standard inscription | ~120 bytes |
| Full inscription | ~300 bytes |
| Old JSON memo (v0.1.x) | ~250 bytes |

---

**Ready to teleburn?** Start with our [User Guide](/docs/USER_GUIDE.md) or learn the [technical specification](/docs/TELEBURN_SPEC_v1.0.md).