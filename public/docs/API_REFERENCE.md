# API Reference

Complete API documentation for the KILN-Teleburn Protocol.

## 🔧 Core Functions

### `deriveTeleburnAddress(inscriptionId: string): PublicKey`

Derives a Solana address from a Bitcoin inscription ID.

**Parameters:**
- `inscriptionId` (string): Bitcoin inscription ID in format `<txid>i<index>`

**Returns:**
- `PublicKey`: Derived Solana address (off-curve, no private key)

**Example:**
```typescript
import { deriveTeleburnAddress } from '@/lib/teleburn';

const address = deriveTeleburnAddress('abc123...def789i0');
console.log(address.toBase58()); // "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
```

### `verifyTeleburnAddress(address: PublicKey, inscriptionId: string): boolean`

Verifies that a Solana address was derived from a specific inscription ID.

**Parameters:**
- `address` (PublicKey): Solana address to verify
- `inscriptionId` (string): Bitcoin inscription ID

**Returns:**
- `boolean`: True if the address was derived from the inscription ID

**Example:**
```typescript
import { verifyTeleburnAddress } from '@/lib/teleburn';

const isValid = verifyTeleburnAddress(address, inscriptionId);
console.log(isValid); // true
```

## 🏗️ Transaction Builder

### `TransactionBuilder`

Main class for building teleburn transactions.

**Constructor:**
```typescript
new TransactionBuilder(rpcUrl: string)
```

**Methods:**

#### `buildSealTransaction(params: SealTransactionParams): Promise<BuiltTransaction>`

Builds a seal transaction to prepare the NFT for burning.

**Parameters:**
```typescript
interface SealTransactionParams {
  payer: PublicKey;           // Transaction payer
  mint: PublicKey;           // NFT mint address
  inscriptionId: string;     // Bitcoin inscription ID
  sha256: string;           // Content hash
  authority: PublicKey;     // NFT authority
}
```

#### `buildRetireTransaction(params: RetireTransactionParams): Promise<BuiltTransaction>`

Builds a retire transaction to burn the NFT to the derived address.

**Parameters:**
```typescript
interface RetireTransactionParams {
  payer: PublicKey;           // Transaction payer
  mint: PublicKey;           // NFT mint address
  inscriptionId: string;     // Bitcoin inscription ID
  authority: PublicKey;     // NFT authority
}
```

## 📝 Memo Structure

### `Sbt01Seal`

Seal transaction memo structure.

```typescript
interface Sbt01Seal {
  standard: 'KILN';                    // Protocol standard
  version: '0.1.1';                   // Protocol version
  source_chain: 'solana-mainnet';      // Source blockchain
  target_chain: 'bitcoin-mainnet';     // Target blockchain
  action: 'seal';                     // Transaction action
  timestamp: number;                  // Unix timestamp
  block_height: number;               // Block height
  inscription: {
    id: string;                      // Bitcoin inscription ID
  };
  solana: {
    mint: string;                    // Solana mint address
  };
  media: {
    sha256: string;                  // Content hash
  };
}
```

### `Sbt01Retire`

Retire transaction memo structure.

```typescript
interface Sbt01Retire {
  standard: 'KILN';                    // Protocol standard
  version: '0.1.1';                   // Protocol version
  source_chain: 'solana-mainnet';      // Source blockchain
  target_chain: 'bitcoin-mainnet';     // Target blockchain
  action: 'retire';                    // Transaction action
  timestamp: number;                  // Unix timestamp
  block_height: number;               // Block height
  inscription: {
    id: string;                      // Bitcoin inscription ID
  };
  solana: {
    mint: string;                    // Solana mint address
  };
  derived: {
    owner: string;                   // Derived address
    algorithm: 'teleburn-derived';   // Derivation method
  };
}
```

## 🔍 Verification

### `InscriptionVerifier`

Class for verifying Bitcoin inscriptions.

**Methods:**

#### `verifyInscription(inscriptionId: string): Promise<InscriptionVerificationResult>`

Verifies a Bitcoin inscription and returns its details.

**Returns:**
```typescript
interface InscriptionVerificationResult {
  valid: boolean;
  inscriptionId: string;
  contentHash: string;
  contentType: string;
  contentSize: number;
  blockHeight: number;
  timestamp: number;
}
```

## 🛠️ Utility Functions

### `parseInscriptionId(inscriptionId: string): ParsedInscriptionId`

Parses a Bitcoin inscription ID into its components.

**Returns:**
```typescript
interface ParsedInscriptionId {
  txid: string;      // Transaction ID (64 hex characters)
  index: number;     // Inscription index
  valid: boolean;    // Whether the format is valid
}
```

### `validateInscriptionId(inscriptionId: string): boolean`

Validates that an inscription ID has the correct format.

**Returns:**
- `boolean`: True if the inscription ID format is valid

## 🔐 Security Notes

- All derived addresses are **off-curve** (no private key exists)
- SHA-256 hashing ensures **cryptographic security**
- Domain separation prevents **cross-protocol attacks**
- All transactions are **simulated before execution**

## 🎯 NFT Compatibility

### Supported NFT Types

- **✅ SPL Token NFTs**: Standard Solana NFTs work perfectly
- **✅ Token-2022 pNFTs**: Programmable NFTs supported with SPL Token compatibility
- **✅ Frozen pNFTs**: Can be burned using SPL Token program (same as sol-incinerator)
- **✅ All Solana NFTs**: Compatible with existing burn tools and wallets

### Token Program Detection

The `TransactionBuilder` automatically detects the token program:

```typescript
// Automatically detects Token-2022 but uses SPL Token for compatibility
const tokenProgram = await builder.detectTokenProgram(mint);
// Returns TOKEN_PROGRAM_ID for maximum compatibility
```

### Error Handling

Common error scenarios and solutions:

- **"Account is frozen"**: Use SPL Token program instead of Token-2022
- **"Insufficient SOL"**: Ensure wallet has at least 0.00001 SOL for fees
- **"Token account not found"**: Refresh wallet connection or check NFT ownership

## 📚 Examples

See the [Integration Guide](/docs/INTEGRATION_GUIDE.md) for complete examples and use cases.
