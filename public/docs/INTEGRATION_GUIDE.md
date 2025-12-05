# Integration Guide

Step-by-step guide for integrating the KILN Teleburn Protocol v1.0 into your application.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install @solana/web3.js @solana/wallet-adapter-react
```

### 2. Basic Integration

```typescript
import { buildTeleburnMemo, parseTeleburnMemo } from '@/lib/teleburn';
import { TransactionBuilder } from '@/lib/transaction-builder';

// Build memo
const inscriptionId = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';
const memo = buildTeleburnMemo(inscriptionId);
console.log(memo); // "teleburn:6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"

// Parse memo
const parsed = parseTeleburnMemo(memo);
console.log(parsed); // "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0"
```

## 🏗️ Complete Integration

### Step 1: Setup Transaction Builder

```typescript
import { TransactionBuilder } from '@/lib/transaction-builder';

const rpcUrl = 'https://api.mainnet-beta.solana.com';
const builder = new TransactionBuilder(rpcUrl);
```

### Step 2: Build Burn Transaction

```typescript
const burnParams = {
  payer: wallet.publicKey,
  owner: wallet.publicKey,
  mint: new PublicKey('7xKXy9H8P3ZYQEXxf5...'),
  inscriptionId: '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0',
  method: 'teleburn-burn' as const
};

const burnTx = await builder.buildRetireTransaction(burnParams);
```

### Step 3: Sign and Send Transaction

```typescript
// Sign transaction
const signedTx = await wallet.signTransaction(burnTx.transaction);
const signature = await connection.sendRawTransaction(signedTx.serialize());

// Wait for confirmation
await connection.confirmTransaction(signature);
console.log('Teleburn complete:', signature);
```

## 🔍 Verification Integration

### Verify Memo

```typescript
import { parseAnyTeleburnMemo, verifyMemo } from '@/lib/teleburn';

// Parse memo from transaction
const memo = 'teleburn:abc123...i0';
const result = parseAnyTeleburnMemo(memo);

if (result.format === 'v1') {
  console.log('v1.0 format detected');
  console.log('Inscription ID:', result.inscriptionId);
}

// Or use verify function
const verification = verifyMemo(memo);
if (verification.valid) {
  console.log('Valid teleburn memo');
  console.log('Format:', verification.format);
}
```

### Verify Teleburn Transaction

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { parseAnyTeleburnMemo } from '@/lib/teleburn';

async function verifyTeleburn(mint: PublicKey, connection: Connection) {
  // Get recent transactions for the mint
  const signatures = await connection.getSignaturesForAddress(mint, { limit: 10 });
  
  for (const sigInfo of signatures) {
    const tx = await connection.getTransaction(sigInfo.signature);
    
    // Check for memo instruction
    const memoIx = tx?.transaction.message.instructions.find(
      ix => ix.programId.equals(MEMO_PROGRAM_ID)
    );
    
    if (memoIx) {
      const memoData = Buffer.from(memoIx.data).toString('utf-8');
      
      try {
        const result = parseAnyTeleburnMemo(memoData);
        console.log('Found teleburn:', result.inscriptionId);
        return result;
      } catch {
        // Not a teleburn memo
      }
    }
  }
  
  return null;
}
```

## 🎨 UI Integration

### React Component Example

```tsx
import { useState } from 'react';
import { buildTeleburnMemo, isValidInscriptionId } from '@/lib/teleburn';
import { TransactionBuilder } from '@/lib/transaction-builder';

function TeleburnForm() {
  const [inscriptionId, setInscriptionId] = useState('');
  const [mint, setMint] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTeleburn = async () => {
    if (!isValidInscriptionId(inscriptionId)) {
      alert('Invalid inscription ID');
      return;
    }

    setLoading(true);
    try {
      const builder = new TransactionBuilder(rpcUrl);
      const result = await builder.buildRetireTransaction({
        payer: wallet.publicKey,
        owner: wallet.publicKey,
        mint: new PublicKey(mint),
        inscriptionId,
        method: 'teleburn-burn'
      });

      // Sign and send
      const signed = await wallet.signTransaction(result.transaction);
      await connection.sendRawTransaction(signed.serialize());
      
      alert('Teleburn successful!');
    } catch (error) {
      console.error('Teleburn failed:', error);
      alert('Teleburn failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={mint}
        onChange={(e) => setMint(e.target.value)}
        placeholder="NFT Mint Address"
      />
      <input
        value={inscriptionId}
        onChange={(e) => setInscriptionId(e.target.value)}
        placeholder="Inscription ID"
      />
      <button onClick={handleTeleburn} disabled={loading}>
        {loading ? 'Processing...' : 'Teleburn NFT'}
      </button>
    </div>
  );
}
```

## 🔧 Error Handling

### Common Errors

```typescript
import { buildTeleburnMemo, isValidInscriptionId } from '@/lib/teleburn';

try {
  if (!isValidInscriptionId(inscriptionId)) {
    throw new Error('Invalid inscription ID format');
  }
  
  const memo = buildTeleburnMemo(inscriptionId);
} catch (error) {
  if (error.message.includes('Invalid inscription ID')) {
    console.error('Please check your inscription ID format');
    console.error('Expected format: <64-hex-chars>i<number>');
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Transaction Errors

```typescript
try {
  const tx = await builder.buildRetireTransaction(params);
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
// All NFT types are supported:
// ✅ SPL Token NFTs (standard)
// ✅ Token-2022 pNFTs (programmable)
// ✅ Frozen pNFTs (using SPL Token program)
```

## 🧪 Testing

### Unit Tests

```typescript
import { buildTeleburnMemo, parseTeleburnMemo, isValidInscriptionId } from '@/lib/teleburn';

describe('Teleburn', () => {
  test('builds memo correctly', () => {
    const inscriptionId = '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0';
    const memo = buildTeleburnMemo(inscriptionId);
    
    expect(memo).toBe('teleburn:6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0');
  });

  test('parses memo correctly', () => {
    const memo = 'teleburn:abc123...i0';
    const inscriptionId = parseTeleburnMemo(memo);
    
    expect(inscriptionId).toBe('abc123...i0');
  });

  test('validates inscription ID', () => {
    expect(isValidInscriptionId('6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0')).toBe(true);
    expect(isValidInscriptionId('invalid')).toBe(false);
  });
});
```

### Integration Tests

```typescript
import { TransactionBuilder } from '@/lib/transaction-builder';

describe('Transaction Builder', () => {
  test('builds burn transaction', async () => {
    const builder = new TransactionBuilder(rpcUrl);
    const params = {
      payer: testWallet.publicKey,
      owner: testWallet.publicKey,
      mint: testMint,
      inscriptionId: '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0',
      method: 'teleburn-burn' as const
    };
    
    const tx = await builder.buildRetireTransaction(params);
    
    expect(tx.transaction).toBeDefined();
    expect(tx.estimatedFee).toBeGreaterThan(0);
  });
});
```

## 📚 Best Practices

### 1. Always Validate Input

```typescript
import { isValidInscriptionId } from '@/lib/teleburn';

function validateInput(inscriptionId: string, mint: string): boolean {
  if (!isValidInscriptionId(inscriptionId)) {
    console.error('Invalid inscription ID format');
    return false;
  }
  
  try {
    new PublicKey(mint);
  } catch {
    console.error('Invalid mint address');
    return false;
  }
  
  return true;
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
// Always validate the inscription ID before building transaction
if (!isValidInscriptionId(inscriptionId)) {
  throw new Error('Invalid inscription ID format');
}

// Build transaction
const tx = await builder.buildRetireTransaction({
  // ... params
});
```

## 🔐 Security Considerations

- **Never trust user input** - always validate inscription IDs
- **Use HTTPS** for all API calls
- **Implement rate limiting** to prevent abuse
- **Log all transactions** for audit purposes
- **Test on devnet** before mainnet deployment
- **Verify memo format** before processing transactions

## 📞 Support

- **Documentation**: [API Reference](/docs/API_REFERENCE.md)
- **Specification**: [Teleburn Protocol v1.0](/docs/TELEBURN_SPEC_v1.0.md)
- **Examples**: [GitHub Repository](https://github.com/fevra-dev/kiln)
- **Issues**: Create an issue on GitHub

---

**Ready to integrate?** Check out our [API Reference](/docs/API_REFERENCE.md) for complete function documentation.
