# API Reference

Complete API documentation for the KILN Teleburn Protocol v1.0.

## 🔧 Core Functions

### `buildTeleburnMemo(inscriptionId: string): string`

Builds a teleburn memo string in v1.0 format.

**Parameters:**
- `inscriptionId` (string): Bitcoin inscription ID in format `<txid>i<index>`

**Returns:**
- `string`: Memo string in format `teleburn:<inscription_id>`

**Example:**
```typescript
import { buildTeleburnMemo } from '@/lib/teleburn';

const memo = buildTeleburnMemo('6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0');
console.log(memo); // "teleburn:6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
```

### `parseTeleburnMemo(memo: string): string`

Parses a teleburn memo and extracts the inscription ID.

**Parameters:**
- `memo` (string): Memo string starting with `teleburn:`

**Returns:**
- `string`: Extracted inscription ID

**Example:**
```typescript
import { parseTeleburnMemo } from '@/lib/teleburn';

const inscriptionId = parseTeleburnMemo('teleburn:abc123...i0');
console.log(inscriptionId); // "abc123...i0"
```

### `parseAnyTeleburnMemo(memo: string): MemoParseResult`

Parses any supported memo format (v1.0 or legacy).

**Parameters:**
- `memo` (string): Memo string (v1.0 format or legacy JSON)

**Returns:**
```typescript
interface MemoParseResult {
  inscriptionId: string;
  format: 'v1' | 'legacy-prefix' | 'legacy-json';
}
```

**Example:**
```typescript
import { parseAnyTeleburnMemo } from '@/lib/teleburn';

const result = parseAnyTeleburnMemo('teleburn:abc123...i0');
console.log(result.inscriptionId); // "abc123...i0"
console.log(result.format); // "v1"
```

### `isTeleburnMemo(memo: string): boolean`

Checks if a string is a valid teleburn memo.

**Parameters:**
- `memo` (string): String to check

**Returns:**
- `boolean`: True if valid teleburn memo

**Example:**
```typescript
import { isTeleburnMemo } from '@/lib/teleburn';

const isValid = isTeleburnMemo('teleburn:abc123...i0');
console.log(isValid); // true
```

### `isValidInscriptionId(inscriptionId: string): boolean`

Validates an inscription ID format.

**Parameters:**
- `inscriptionId` (string): Inscription ID to validate

**Returns:**
- `boolean`: True if format is valid

**Example:**
```typescript
import { isValidInscriptionId } from '@/lib/teleburn';

const valid = isValidInscriptionId('6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0');
console.log(valid); // true
```

### `parseInscriptionId(inscriptionId: string): ParsedInscriptionId`

Parses an inscription ID into its components.

**Returns:**
```typescript
interface ParsedInscriptionId {
  txid: string;      // Transaction ID (64 hex characters)
  index: number;     // Inscription index
}
```

**Example:**
```typescript
import { parseInscriptionId } from '@/lib/teleburn';

const parsed = parseInscriptionId('6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0');
console.log(parsed.txid);  // "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799"
console.log(parsed.index); // 0
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

Builds a seal transaction to record inscription proof on-chain.

**Parameters:**
```typescript
interface SealTransactionParams {
  payer: PublicKey;           // Transaction payer
  mint: PublicKey;           // NFT mint address
  inscriptionId: string;     // Bitcoin inscription ID
  authority?: PublicKey[];   // Optional multi-sig authorities
  rpcUrl?: string;           // Optional RPC URL
  priorityFee?: PriorityFeeConfig; // Optional priority fee
}
```

**Returns:**
```typescript
interface BuiltTransaction {
  transaction: Transaction;
  description: string;
  estimatedFee: number; // in lamports
}
```

#### `buildRetireTransaction(params: RetireTransactionParams): Promise<BuiltTransaction>`

Builds a retire transaction to burn the NFT.

**Parameters:**
```typescript
interface RetireTransactionParams {
  payer: PublicKey;           // Transaction payer
  owner: PublicKey;           // NFT owner
  mint: PublicKey;           // NFT mint address
  inscriptionId: string;     // Bitcoin inscription ID
  method: TeleburnMethod;    // 'teleburn-burn' | 'teleburn-incinerate' | 'teleburn-derived' (legacy support)
  amount?: bigint;           // Amount to retire (default: 1 for NFTs)
  rpcUrl?: string;           // Optional RPC URL
  priorityFee?: PriorityFeeConfig; // Optional priority fee
}
```

**Example:**
```typescript
import { TransactionBuilder } from '@/lib/transaction-builder';

const builder = new TransactionBuilder('https://api.mainnet-beta.solana.com');

const result = await builder.buildRetireTransaction({
  payer: wallet.publicKey,
  owner: wallet.publicKey,
  mint: nftMint,
  inscriptionId: 'abc123...i0',
  method: 'teleburn-burn'
});

// Sign and send
const signed = await wallet.signTransaction(result.transaction);
await connection.sendRawTransaction(signed.serialize());
```

## 📝 Memo Format

### v1.0 Format

The v1.0 protocol uses a simple string format:

```
teleburn:<inscription_id>
```

**Example:**
```
teleburn:6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0
```

**Size:** ~78 bytes

### Legacy Format Support

The parser also supports legacy formats for backwards compatibility:
- `kiln:<inscription_id>` (legacy prefix)
- JSON format with `standard: "Kiln"` (v0.1.x)

## 🔍 Verification

### `verifyMemo(memo: string): TeleburnVerification`

Verifies a memo and extracts teleburn data.

**Returns:**
```typescript
interface TeleburnVerification {
  valid: boolean;
  inscriptionId: string | null;
  format: 'v1' | 'legacy-prefix' | 'legacy-json' | null;
  error: string | null;
}
```

**Example:**
```typescript
import { verifyMemo } from '@/lib/teleburn';

const verification = verifyMemo('teleburn:abc123...i0');
if (verification.valid) {
  console.log('Inscription ID:', verification.inscriptionId);
  console.log('Format:', verification.format);
}
```

## 🛠️ Utility Functions

### `createMemoInstruction(memo: string): TransactionInstruction`

Creates an SPL Memo instruction with the memo string.

**Parameters:**
- `memo` (string): Memo string to include

**Returns:**
- `TransactionInstruction`: Memo instruction ready to add to transaction

**Example:**
```typescript
import { createMemoInstruction, buildTeleburnMemo } from '@/lib/teleburn';

const memo = buildTeleburnMemo('abc123...i0');
const instruction = createMemoInstruction(memo);
transaction.add(instruction);
```

## 🔐 Security Notes

- Memo format is minimal (~78 bytes vs ~250+ bytes for JSON)
- No derived addresses needed (Solana burns destroy tokens directly)
- Simple string format is easy to parse and index
- Legacy format support ensures backwards compatibility

## 🎯 NFT Compatibility

### Supported NFT Types

- **✅ SPL Token NFTs**: Standard Solana NFTs work perfectly
- **✅ Token-2022 pNFTs**: Programmable NFTs supported with SPL Token compatibility
- **✅ Frozen pNFTs**: Can be burned using SPL Token program
- **✅ All Solana NFTs**: Compatible with existing burn tools and wallets

### Token Program Detection

The `TransactionBuilder` automatically detects the token program:

```typescript
// Automatically detects Token-2022 but uses SPL Token for compatibility
const tokenProgram = await getTokenProgramId(connection, mint);
// Returns TOKEN_PROGRAM_ID for maximum compatibility
```

### Error Handling

Common error scenarios and solutions:

- **"Invalid inscription ID"**: Check format is `<64-hex-chars>i<number>`
- **"Insufficient SOL"**: Ensure wallet has at least 0.00001 SOL for fees
- **"Token account not found"**: Refresh wallet connection or check NFT ownership
- **"Account is frozen"**: Use SPL Token program instead of Token-2022

## 📚 Examples

See the [Integration Guide](/docs/INTEGRATION_GUIDE.md) for complete examples and use cases.

## 🔗 Related Documentation

- [Teleburn Protocol Specification](/docs/TELEBURN_SPEC_v1.0.md)
- [User Guide](/docs/USER_GUIDE.md)
- [Integration Guide](/docs/INTEGRATION_GUIDE.md)
