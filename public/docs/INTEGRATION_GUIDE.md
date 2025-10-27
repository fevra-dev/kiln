# Integration Guide

Step-by-step guide for integrating the KILN-Teleburn Protocol into your application.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install @solana/web3.js @solana/wallet-adapter-react
```

### 2. Basic Integration

```typescript
import { deriveTeleburnAddress, verifyTeleburnAddress } from '@/lib/teleburn';
import { TransactionBuilder } from '@/lib/transaction-builder';

// Derive address from inscription ID
const inscriptionId = 'abc123...def789i0';
const derivedAddress = deriveTeleburnAddress(inscriptionId);

// Verify the address
const isValid = verifyTeleburnAddress(derivedAddress, inscriptionId);
console.log('Address is valid:', isValid);
```

## 🏗️ Complete Integration

### Step 1: Setup Transaction Builder

```typescript
import { TransactionBuilder } from '@/lib/transaction-builder';

const rpcUrl = 'https://api.mainnet-beta.solana.com';
const builder = new TransactionBuilder(rpcUrl);
```

### Step 2: Build Seal Transaction

```typescript
const sealParams = {
  payer: wallet.publicKey,
  mint: new PublicKey('7xKXy9H8P3ZYQEXxf5...'),
  inscriptionId: 'abc123...def789i0',
  sha256: 'a1b2c3d4e5f6...',
  authority: wallet.publicKey
};

const sealTx = await builder.buildSealTransaction(sealParams);
```

### Step 3: Build Retire Transaction

```typescript
const retireParams = {
  payer: wallet.publicKey,
  mint: new PublicKey('7xKXy9H8P3ZYQEXxf5...'),
  inscriptionId: 'abc123...def789i0',
  authority: wallet.publicKey
};

const retireTx = await builder.buildRetireTransaction(retireParams);
```

### Step 4: Sign and Send Transactions

```typescript
// Sign seal transaction
const signedSealTx = await wallet.signTransaction(sealTx.transaction);
const sealSignature = await connection.sendRawTransaction(signedSealTx.serialize());

// Wait for confirmation
await connection.confirmTransaction(sealSignature);

// Sign retire transaction
const signedRetireTx = await wallet.signTransaction(retireTx.transaction);
const retireSignature = await connection.sendRawTransaction(signedRetireTx.serialize());

// Wait for confirmation
await connection.confirmTransaction(retireSignature);
```

## 🔍 Verification Integration

### Verify Inscription

```typescript
import { InscriptionVerifier } from '@/lib/inscription-verifier';

const verifier = new InscriptionVerifier();
const result = await verifier.verifyInscription('abc123...def789i0');

if (result.valid) {
  console.log('Inscription verified:', result.contentHash);
} else {
  console.error('Invalid inscription');
}
```

### Verify Teleburn

```typescript
// After teleburn is complete, verify the link
const derivedAddress = deriveTeleburnAddress(inscriptionId);
const isValid = verifyTeleburnAddress(derivedAddress, inscriptionId);

if (isValid) {
  console.log('Teleburn verified successfully');
} else {
  console.error('Teleburn verification failed');
}
```

## 🎨 UI Integration

### React Component Example

```tsx
import { useState } from 'react';
import { deriveTeleburnAddress } from '@/lib/teleburn';

function TeleburnForm() {
  const [inscriptionId, setInscriptionId] = useState('');
  const [derivedAddress, setDerivedAddress] = useState<PublicKey | null>(null);

  const handleDerive = () => {
    try {
      const address = deriveTeleburnAddress(inscriptionId);
      setDerivedAddress(address);
    } catch (error) {
      console.error('Invalid inscription ID:', error);
    }
  };

  return (
    <div>
      <input
        value={inscriptionId}
        onChange={(e) => setInscriptionId(e.target.value)}
        placeholder="Enter inscription ID"
      />
      <button onClick={handleDerive}>Derive Address</button>
      {derivedAddress && (
        <p>Derived Address: {derivedAddress.toBase58()}</p>
      )}
    </div>
  );
}
```

## 🔧 Error Handling

### Common Errors

```typescript
try {
  const address = deriveTeleburnAddress(inscriptionId);
} catch (error) {
  if (error.message.includes('Invalid inscription ID')) {
    console.error('Please check your inscription ID format');
  } else if (error.message.includes('Invalid hex')) {
    console.error('Inscription ID must be valid hex');
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Transaction Errors

```typescript
try {
  const tx = await builder.buildSealTransaction(params);
} catch (error) {
  if (error.message.includes('Insufficient funds')) {
    console.error('Not enough SOL for transaction');
  } else if (error.message.includes('Invalid mint')) {
    console.error('NFT mint address is invalid');
  } else if (error.message.includes('Account is frozen')) {
    console.error('NFT is frozen - try using SPL Token program');
  } else {
    console.error('Transaction failed:', error);
  }
}
```

### Token-2022 and pNFT Compatibility

```typescript
// The TransactionBuilder automatically handles Token-2022 compatibility
const builder = new TransactionBuilder(rpcUrl);

// For Token-2022 NFTs, the builder uses SPL Token program for compatibility
// This matches the behavior of sol-incinerator and wallet burn tools
const tokenProgram = await builder.detectTokenProgram(mint);
// Returns TOKEN_PROGRAM_ID for maximum compatibility

// All NFT types are supported:
// ✅ SPL Token NFTs (standard)
// ✅ Token-2022 pNFTs (programmable)
// ✅ Frozen pNFTs (using SPL Token program)
```

## 🧪 Testing

### Unit Tests

```typescript
import { deriveTeleburnAddress } from '@/lib/teleburn';

describe('Teleburn', () => {
  test('derives correct address', () => {
    const inscriptionId = 'abc123...def789i0';
    const address = deriveTeleburnAddress(inscriptionId);
    
    expect(address).toBeDefined();
    expect(address.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });
});
```

### Integration Tests

```typescript
import { TransactionBuilder } from '@/lib/transaction-builder';

describe('Transaction Builder', () => {
  test('builds seal transaction', async () => {
    const builder = new TransactionBuilder(rpcUrl);
    const params = { /* ... */ };
    
    const tx = await builder.buildSealTransaction(params);
    
    expect(tx.transaction).toBeDefined();
    expect(tx.instructions).toHaveLength(2);
  });
});
```

## 📚 Best Practices

### 1. Always Validate Input

```typescript
function validateInscriptionId(id: string): boolean {
  const regex = /^[a-fA-F0-9]{64}i\d+$/;
  return regex.test(id);
}
```

### 2. Handle Network Errors

```typescript
async function sendTransaction(tx: Transaction) {
  try {
    return await connection.sendRawTransaction(tx.serialize());
  } catch (error) {
    if (error.message.includes('429')) {
      // Rate limited - retry with backoff
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await connection.sendRawTransaction(tx.serialize());
    }
    throw error;
  }
}
```

### 3. Verify Before Proceeding

```typescript
// Always verify the inscription before teleburn
const verification = await verifier.verifyInscription(inscriptionId);
if (!verification.valid) {
  throw new Error('Invalid inscription');
}
```

## 🔐 Security Considerations

- **Never trust user input** - always validate inscription IDs
- **Use HTTPS** for all API calls
- **Implement rate limiting** to prevent abuse
- **Log all transactions** for audit purposes
- **Test on devnet** before mainnet deployment

## 📞 Support

- **Documentation**: [API Reference](/docs/API_REFERENCE.md)
- **Examples**: [GitHub Repository](https://github.com/fevra-dev)
- **Issues**: Create an issue on GitHub

---

**Ready to integrate?** Check out our [API Reference](/docs/API_REFERENCE.md) for complete function documentation.
