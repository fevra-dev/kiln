# Sol-Incinerator Burn+Close API Documentation

## Introduction

* This API gives you an easy way to
  * Burn any token or NFT type
  * Close all empty token accounts, both regular and token 2022
* We support both transactions that you just need to sign and send, or instructions that you can compose further.

**Base URL**: `https://v1.api.sol-incinerator.com/`

### Quick Start Examples

Here are the two most common operations to get you started:

#### Close All Empty Token Accounts

```typescript
import axios from 'axios';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import base58 from 'bs58';

const response = await axios.post('https://v1.api.sol-incinerator.com/batch/close-all', {
    userPublicKey: '4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf'
}, {
    headers: {
        'x-api-key': 'your-api-key-here'
    }
});

// Process each transaction
const connection = new Connection('https://api.mainnet-beta.solana.com');
const wallet = Keypair.fromSecretKey(/* your secret key */);

for (const serializedTx of response.data.transactions) {
    const transaction = VersionedTransaction.deserialize(base58.decode(serializedTx));
    transaction.sign([wallet]);
    await connection.sendTransaction(transaction);
}
```

#### Burn an NFT

```typescript
import axios from 'axios';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import base58 from 'bs58';

const response = await axios.post('https://v1.api.sol-incinerator.com/burn', {
    userPublicKey: '4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf',
    assetId: '7tPfzEm87ao3UCK54w1K73CkTz1WmvXWLXeijzDCrn2C'
}, {
    headers: {
        'x-api-key': 'your-api-key-here'
    }
});

// Deserialize and sign the transaction
const transaction = VersionedTransaction.deserialize(base58.decode(response.data.serializedTransaction));
const wallet = Keypair.fromSecretKey(/* your secret key */);
transaction.sign([wallet]);

// Send the transaction
const connection = new Connection('https://api.mainnet-beta.solana.com');
const signature = await connection.sendTransaction(transaction);
```

## Authentication

All endpoints except the status endpoint require an API key. Include your API key in the request headers:

```
x-api-key: your-api-key-here
```

or

```
Authorization: your-api-key-here
```

To acquire an API key, open a ticket in the Sol Slugs Discord server.

## NFT Types Supported

The API supports burning and closing the following asset types:

* **Tokens**: Standard SPL Token Program tokens
* **Token2022**: SPL Token-2022 Program tokens, includeing those with transfer fees enabled
* **Regular Metaplex NFTs**: Standard Metaplex NFTs with metadata accounts
* **Metaplex pNFTs**: Programmable NFTs with token records
* **Metaplex Editions**: Metaplex edition NFTs derived from master editions
* **Metaplex pNFT Editions**: Programmable NFTs with token records derived from master editions
* **MPL Core**: Metaplex Core NFTs

## NFT Types Not Supported

* **Magiceden Open Creator Protocol**
* **Bubblegum cNFTs**

## Endpoints

### GET `/` - Status Check

Check if the API is online.

#### Response

```typescript
interface StatusResponse {
    status: string;
}
```

```json
{
    "status": "ok"
}
```

#### cURL Example

```bash
curl -X GET https://v1.api.sol-incinerator.com/
```

***

### POST `/burn` - Burn Asset

**Destructive Operation**: This permanently destroys the asset.

* Creates and returns a transaction to burn the provided NFT or token.
* You can also use this endpoint with an empty token account to close if desired - it's a unified handler for anything

#### Request Parameters

| Parameter                  | Type    | Required | Description                                                 |
| -------------------------- | ------- | -------- | ----------------------------------------------------------- |
| `userPublicKey`            | string  | Yes      | Public key of the asset owner                               |
| `assetId`                  | string  | Yes      | Token account or mint address of the asset to burn          |
| `feePayer`                 | string  | No       | Account to pay transaction fees (defaults to userPublicKey) |
| `autoCloseTokenAccounts`   | boolean | No       | Auto-close token account after burn (default: true)         |
| `priorityFeeMicroLamports` | number  | No       | Custom priority fee in micro-lamports                       |
| `asLegacyTransaction`      | boolean | No       | Use legacy transaction format (default: false)              |
| `burnAmount`               | number  | No       | Amount to burn in atomic units (defaults to full balance)   |

#### Response

```typescript
interface BurnResponse {
    assetId: string;                    // Asset that was processed
    serializedTransaction: string;      // Base58 encoded transaction
    lamportsReclaimed: number;          // Lamports returned to user
    solanaReclaimed: number;           // SOL equivalent of lamports
    transactionType: string;           // Type of burn operation
    isDestructiveAction: boolean;      // Always true for burns
}
```

#### Node.js Example

```typescript
import axios from 'axios';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import base58 from 'bs58';

async function burnAsset() {
    try {
        // Request burn transaction
        const response = await axios.post('https://v1.api.sol-incinerator.com/burn', {
            userPublicKey: '4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf',
            assetId: '7tPfzEm87ao3UCK54w1K73CkTz1WmvXWLXeijzDCrn2C',
        }, {
            headers: {
                'x-api-key': 'your-api-key-here'
            }
        });

        console.log('Burn response:', response.data);
        // For NFTs: lamportsReclaimed typically ~10000000 (0.01 SOL), or ~7600000 (0.0076 SOL) if resized
        // For tokens: lamportsReclaimed: 2000000 (0.002 SOL)

        // Deserialize transaction
        const transaction = VersionedTransaction.deserialize(
            base58.decode(response.data.serializedTransaction)
        );

        // Sign transaction
        const wallet = Keypair.fromSecretKey(/* your secret key */);
        transaction.sign([wallet]);

        // Send transaction
        const connection = new Connection('https://api.mainnet-beta.solana.com');
        const signature = await connection.sendTransaction(transaction);
        
        console.log('Transaction signature:', signature);
    } catch (error) {
        console.error('Burn failed:', error.response?.data || error.message);
    }
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/burn \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf",
    "assetId": "7tPfzEm87ao3UCK54w1K73CkTz1WmvXWLXeijzDCrn2C"
  }'
```

***

### POST `/burn-instructions` - Get Burn Instructions

**Destructive Operation**: These instructions permanently destroy the asset when executed.

Returns raw instructions for burning an asset and returning the rent to the user.

#### Request Parameters

| Parameter                | Type    | Required | Description                                               |
| ------------------------ | ------- | -------- | --------------------------------------------------------- |
| `userPublicKey`          | string  | Yes      | Public key of the asset owner                             |
| `assetId`                | string  | Yes      | Token account or mint address of the asset to burn        |
| `autoCloseTokenAccounts` | boolean | No       | Auto-close token account after burn (default: true)       |
| `burnAmount`             | number  | No       | Amount to burn in atomic units (defaults to full balance) |

#### Response

```typescript
interface BurnInstructionsResponse {
    assetId: string;                        // Asset that will be processed
    instructions: SerializedInstruction[];  // Array of instructions
    lamportsReclaimed: number;              // Lamports that will be reclaimed
    solanaReclaimed: number;               // SOL equivalent
    instructionType: string;               // Type of burn operation
    isDestructiveAction: boolean;          // Always true for burns
}

interface SerializedInstruction {
    programId: string;                     // Program ID as base58 string
    accounts: SerializedAccount[];         // Account metadata
    data: string;                         // Base64 encoded instruction data
}

interface SerializedAccount {
    pubkey: string;                       // Account public key as base58 string
    isSigner: boolean;                    // Whether account must sign
    isWritable: boolean;                  // Whether account is writable
}
```

#### Node.js Example

```typescript
import axios from 'axios';
import { 
    Connection, 
    Keypair, 
    TransactionInstruction, 
    TransactionMessage,
    VersionedTransaction,
    PublicKey 
} from '@solana/web3.js';

async function getBurnInstructions() {
    // Get burn instructions from API
    const response = await axios.post('https://v1.api.sol-incinerator.com/burn-instructions', {
        userPublicKey: '4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf',
        assetId: 'FHwta9XdRVvNxNven9qK8vRqayiU9U9j86a2kFwsWW8B'
    }, {
        headers: {
            'x-api-key': 'your-api-key-here'
        }
    });

    console.log('Instructions:', response.data.instructions);
    console.log('Lamports reclaimed:', response.data.lamportsReclaimed);

    // Convert serialized instructions to TransactionInstruction objects
    const instructions: TransactionInstruction[] = response.data.instructions.map(ix => {
        return new TransactionInstruction({
            programId: new PublicKey(ix.programId),
            keys: ix.accounts.map(acc => ({
                pubkey: new PublicKey(acc.pubkey),
                isSigner: acc.isSigner,
                isWritable: acc.isWritable
            })),
            data: Buffer.from(ix.data, 'base64')
        });
    });

    // Create transaction
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const wallet = Keypair.fromSecretKey(/* your secret key */);
    
    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    // Create transaction message
    const message = new TransactionMessage({
        payerKey: wallet.publicKey,  // Set fee payer
        recentBlockhash: blockhash,
        instructions: instructions
    }).compileToV0Message();
    
    // Create and sign transaction
    const transaction = new VersionedTransaction(message);
    transaction.sign([wallet]);
    
    // Send transaction
    const signature = await connection.sendTransaction(transaction);
    console.log('Transaction signature:', signature);
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/burn-instructions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf",
    "assetId": "FHwta9XdRVvNxNven9qK8vRqayiU9U9j86a2kFwsWW8B"
  }'
```

***

### POST `/close` - Close Token Account

**Non-Destructive Operation**: Closes an empty token account and reclaims rent.

Creates a transaction that will close the provided token account and reclaim the rent to the user.

#### Request Parameters

| Parameter                  | Type    | Required | Description                     |
| -------------------------- | ------- | -------- | ------------------------------- |
| `userPublicKey`            | string  | Yes      | Public key of the account owner |
| `assetId`                  | string  | Yes      | Token account address to close  |
| `feePayer`                 | string  | No       | Account to pay transaction fees |
| `priorityFeeMicroLamports` | number  | No       | Custom priority fee             |
| `asLegacyTransaction`      | boolean | No       | Use legacy transaction format   |

#### Special Requirements

* Token account must have zero balance
* User must be the account owner or close authority

#### Response

```typescript
interface CloseResponse {
    assetId: string;                    // Token account that was closed
    serializedTransaction: string;      // Base58 encoded transaction
    lamportsReclaimed: number;          // Lamports returned to user (typically 2000000)
    solanaReclaimed: number;           // SOL equivalent (typically 0.002)
    transactionType: string;           // Type of close operation
    isDestructiveAction: boolean;      // Always false for closes
}
```

#### Node.js Example

```typescript
import axios from 'axios';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import base58 from 'bs58';

async function closeAccount() {
    const response = await axios.post('https://v1.api.sol-incinerator.com/close', {
        userPublicKey: '4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf',
        assetId: 'AX8hSyM7j7Qcn7dDQezqu4QVHPqhEbje9DnmoPcRigU9'
    }, {
        headers: {
            'x-api-key': 'your-api-key-here'
        }
    });

    // Response will show lamportsReclaimed: 2000000 for standard accounts
    console.log('Close response:', response.data);

    const transaction = VersionedTransaction.deserialize(
        base58.decode(response.data.serializedTransaction)
    );

    const wallet = Keypair.fromSecretKey(/* your secret key */);
    transaction.sign([wallet]);

    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const signature = await connection.sendTransaction(transaction);
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/close \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf",
    "assetId": "AX8hSyM7j7Qcn7dDQezqu4QVHPqhEbje9DnmoPcRigU9"
  }'
```

***

### POST `/close-instructions` - Get Close Instructions

**Non-Destructive Operation**: Instructions for closing an empty token account.

Returns instructions to close the provided token account and reclaim the rent to the user.

#### Request Parameters

| Parameter       | Type   | Required | Description                     |
| --------------- | ------ | -------- | ------------------------------- |
| `userPublicKey` | string | Yes      | Public key of the account owner |
| `assetId`       | string | Yes      | Token account address to close  |

#### Response

```typescript
interface CloseInstructionsResponse {
    assetId: string;                        // Token account that will be closed
    instructions: SerializedInstruction[];  // Array of instructions
    lamportsReclaimed: number;              // Lamports that will be reclaimed (typically 2000000)
    solanaReclaimed: number;               // SOL equivalent (typically 0.002)
    instructionType: string;               // Type of close operation
    isDestructiveAction: boolean;          // Always false for closes
}

interface SerializedInstruction {
    programId: string;                     // Program ID as base58 string
    accounts: SerializedAccount[];         // Account metadata
    data: string;                         // Base64 encoded instruction data
}

interface SerializedAccount {
    pubkey: string;                       // Account public key as base58 string
    isSigner: boolean;                    // Whether account must sign
    isWritable: boolean;                  // Whether account is writable
}
```

#### Node.js Example

```typescript
import axios from 'axios';
import { 
    Connection, 
    Keypair, 
    TransactionInstruction, 
    TransactionMessage,
    VersionedTransaction,
    PublicKey 
} from '@solana/web3.js';

async function getCloseInstructions() {
    // Get close instructions from API
    const response = await axios.post('https://v1.api.sol-incinerator.com/close-instructions', {
        userPublicKey: '4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf',
        assetId: 'AX8hSyM7j7Qcn7dDQezqu4QVHPqhEbje9DnmoPcRigU9'
    }, {
        headers: {
            'x-api-key': 'your-api-key-here'
        }
    });

    console.log('Close instructions:', response.data);

    // Convert serialized instructions to TransactionInstruction objects
    const instructions: TransactionInstruction[] = response.data.instructions.map(ix => {
        return new TransactionInstruction({
            programId: new PublicKey(ix.programId),
            keys: ix.accounts.map(acc => ({
                pubkey: new PublicKey(acc.pubkey),
                isSigner: acc.isSigner,
                isWritable: acc.isWritable
            })),
            data: Buffer.from(ix.data, 'base64')
        });
    });

    // Create transaction
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const wallet = Keypair.fromSecretKey(/* your secret key */);
    
    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    // Create transaction message
    const message = new TransactionMessage({
        payerKey: wallet.publicKey,  // Set fee payer
        recentBlockhash: blockhash,
        instructions: instructions
    }).compileToV0Message();
    
    // Create and sign transaction
    const transaction = new VersionedTransaction(message);
    transaction.sign([wallet]);
    
    // Send transaction
    const signature = await connection.sendTransaction(transaction);
    console.log('Transaction signature:', signature);
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/close-instructions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf",
    "assetId": "AX8hSyM7j7Qcn7dDQezqu4QVHPqhEbje9DnmoPcRigU9"
  }'
```

***

### POST `/batch/close-all` - Close All Empty Accounts

**Non-Destructive Operation**: Batch closes all empty token accounts.

* Creates transactions to close all empty accounts owned by the user, and return the rent to them.
* This endpoint automatically batches into multiple transactions when required.

#### Request Parameters

| Parameter                  | Type    | Required | Description                     |
| -------------------------- | ------- | -------- | ------------------------------- |
| `userPublicKey`            | string  | Yes      | Public key of the account owner |
| `feePayer`                 | string  | No       | Account to pay transaction fees |
| `priorityFeeMicroLamports` | number  | No       | Custom priority fee             |
| `asLegacyTransaction`      | boolean | No       | Use legacy transaction format   |

#### Response

```typescript
interface BatchCloseAllResponse {
    transactions: string[];            // Array of base58 encoded transactions
    accountsClosed: number;           // Total accounts to be closed
    totalLamportsReclaimed: number;   // Total lamports across all transactions
    totalSolanaReclaimed: number;     // SOL equivalent
    hasDestructiveActions: boolean;   // Whether any operations are destructive
}
```

#### Node.js Example

```typescript
import axios from 'axios';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import base58 from 'bs58';

async function closeAllEmptyAccounts() {
    const response = await axios.post('https://v1.api.sol-incinerator.com/batch/close-all', {
        userPublicKey: '4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf',
    }, {
        headers: {
            'x-api-key': 'your-api-key-here'
        }
    });

    console.log(`Found ${response.data.accountsClosed} accounts to close`);
    console.log(`Will reclaim ${response.data.totalSolanaReclaimed} SOL`);
    console.log(`Need to submit ${response.data.transactions.length} transactions`);

    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const wallet = Keypair.fromSecretKey(/* your secret key */);

    // Process each transaction
    for (let i = 0; i < response.data.transactions.length; i++) {
        const serializedTx = response.data.transactions[i];
        const transaction = VersionedTransaction.deserialize(base58.decode(serializedTx));
        
        transaction.sign([wallet]);
        
        const signature = await connection.sendTransaction(transaction);
        console.log(`Transaction ${i + 1} sent:`, signature);
        
        await connection.confirmTransaction(signature);
    }
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/batch/close-all \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf"
  }'
```

***

### POST `/batch/close-all-instructions` - Get All Close Instructions

**Non-Destructive Operation**: Returns instructions for closing all empty accounts.

* Creates sets of instructions to close all empty accounts owned by the user, and return the rent to them.
* One instruction group = one account closed. You can batch multiple into a single TX, but it adds complexity - see `/batch/close-all` if you want this behavior handled for you

#### Request Parameters

| Parameter       | Type   | Required | Description                     |
| --------------- | ------ | -------- | ------------------------------- |
| `userPublicKey` | string | Yes      | Public key of the account owner |

#### Response

```typescript
interface BatchCloseAllInstructionsResponse {
    instructionGroups: AccountCloseInstructionGroup[];  // Array of instruction groups
    accountsClosed: number;                            // Total accounts to be closed
    totalLamportsReclaimed: number;                    // Total lamports across all groups
    totalSolanaReclaimed: number;                      // SOL equivalent
    hasDestructiveActions: boolean;                    // Whether any operations are destructive
}

interface AccountCloseInstructionGroup {
    assetId: string;                   // Account being closed
    instructions: SerializedInstruction[];  // Instructions for this account
    lamportsReclaimed: number;         // Lamports for this specific account
    solanaReclaimed: number;           // SOL equivalent for this account
    transactionType: string;           // Account type (TOKEN_CLOSE, TOKEN_2022_CLOSE, etc.)
    isDestructiveAction: boolean;      // Whether this action is destructive
}

interface SerializedInstruction {
    programId: string;                 // Program ID as base58 string
    accounts: SerializedAccount[];     // Account metadata
    data: string;                     // Base64 encoded instruction data
}

interface SerializedAccount {
    pubkey: string;                   // Account public key as base58 string
    isSigner: boolean;                // Whether account must sign
    isWritable: boolean;              // Whether account is writable
}
```

#### Node.js Example

```typescript
import axios from 'axios';
import { 
    Connection, 
    Keypair, 
    TransactionInstruction, 
    TransactionMessage,
    VersionedTransaction,
    PublicKey 
} from '@solana/web3.js';

async function getAllCloseInstructions() {
    const response = await axios.post('https://v1.api.sol-incinerator.com/batch/close-all-instructions', {
        userPublicKey: 'TABLEKRgHNkhGQFN8xmXmKhVXW6SGC9jwo7WNkkUpwm'
    }, {
        headers: {
            'x-api-key': 'your-api-key-here'
        }
    });

    console.log(`Total accounts: ${response.data.accountsClosed}`);
    
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const wallet = Keypair.fromSecretKey(/* your secret key */);
    
    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    // Process each account's instructions
    for (const group of response.data.instructionGroups) {
        console.log(`Processing account: ${group.assetId}`);
        console.log(`Type: ${group.transactionType}`);
        console.log(`SOL reclaimed: ${group.solanaReclaimed}`);
        
        // Convert serialized instructions to TransactionInstruction objects
        const instructions: TransactionInstruction[] = group.instructions.map(ix => {
            return new TransactionInstruction({
                programId: new PublicKey(ix.programId),
                keys: ix.accounts.map(acc => ({
                    pubkey: new PublicKey(acc.pubkey),
                    isSigner: acc.isSigner,
                    isWritable: acc.isWritable
                })),
                data: Buffer.from(ix.data, 'base64')
            });
        });
        
        // Create transaction message
        const message = new TransactionMessage({
            payerKey: wallet.publicKey,  // Set fee payer
            recentBlockhash: blockhash,
            instructions: instructions
        }).compileToV0Message();
        
        // Create and sign transaction
        const transaction = new VersionedTransaction(message);
        transaction.sign([wallet]);
        
        // Send transaction
        const signature = await connection.sendTransaction(transaction);
        console.log(`Transaction sent: ${signature}`);
    }
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/batch/close-all-instructions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "TABLEKRgHNkhGQFN8xmXmKhVXW6SGC9jwo7WNkkUpwm"
  }'
```

***

## Preview Endpoints

Preview endpoints allow you to see what would happen before executing operations. These are useful for showing users expected fees and reclaimed amounts.

### POST `/burn/preview` - Preview Burn Operation

Get detailed information about what would happen if you burned an asset.

#### Request Parameters

| Parameter                | Type    | Required | Description                                               |
| ------------------------ | ------- | -------- | --------------------------------------------------------- |
| `userPublicKey`          | string  | Yes      | Public key of the asset owner                             |
| `assetId`                | string  | Yes      | Token account or mint address of the asset to burn        |
| `autoCloseTokenAccounts` | boolean | No       | Auto-close token account after burn (default: true)       |
| `burnAmount`             | number  | No       | Amount to burn in atomic units (defaults to full balance) |

#### Response

```typescript
interface BurnPreviewResponse {
    assetId: string;                    // Asset that would be processed
    transactionType: string;           // Type of burn operation
    lamportsReclaimed: number;          // Lamports that would be reclaimed
    solanaReclaimed: number;           // SOL equivalent
    isDestructiveAction: boolean;      // Whether this action is destructive
    assetInfo: AssetInfo;              // Additional asset information
    feeBreakdown: FeeBreakdown;        // Fee breakdown for transparency
}

interface AssetInfo {
    tokenAccount: string;              // Token account address
    mintAddress?: string;              // Mint address (if available)
    programId?: string;                // Program ID
    isMetaplexNFT?: boolean;          // Whether it's a Metaplex NFT
    isProgrammableNFT?: boolean;       // Whether it's a programmable NFT
    hasCollection?: boolean;           // Whether it has a collection
    tokenStandard?: number;           // Token standard
    frozen?: boolean;                 // Whether the account is frozen
    isZeroBalance?: boolean;          // Whether the account has zero balance
    tokenBalance?: string;            // Token balance as string
    hasHarvestFees?: boolean;         // Whether it has harvest fees (Token-2022)
    isMplCoreNft?: boolean;           // Whether it's an MPL Core NFT
}

interface FeeBreakdown {
    totalFee: number;                 // Total fee amount
    rentReclaimed: {                  // Breakdown of rent reclaimed
        tokenAccount: number;
        metadata?: number;
        edition?: number;
        tokenRecord?: number;
    };
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/burn/preview \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf",
    "assetId": "7tPfzEm87ao3UCK54w1K73CkTz1WmvXWLXeijzDCrn2C"
  }'
```

***

### POST `/close/preview` - Preview Close Operation

Get detailed information about what would happen if you closed a token account.

#### Request Parameters

| Parameter            | Type   | Required | Description                                             |
| -------------------- | ------ | -------- | ------------------------------------------------------- |
| `userPublicKey`      | string | Yes      | Public key of the account owner                         |
| `assetId`            | string | Yes      | Token account address to close                          |
| `reclaimDestination` | string | No       | Where to send reclaimed SOL (defaults to userPublicKey) |

#### Response

```typescript
interface ClosePreviewResponse {
    assetId: string;                    // Token account that would be closed
    transactionType: string;           // Type of close operation
    lamportsReclaimed: number;          // Lamports that would be reclaimed
    solanaReclaimed: number;           // SOL equivalent
    isDestructiveAction: boolean;      // Always false for closes
    assetInfo: AssetInfo;              // Additional asset information
    feeBreakdown: FeeBreakdown;        // Fee breakdown for transparency
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/close/preview \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf",
    "assetId": "AX8hSyM7j7Qcn7dDQezqu4QVHPqhEbje9DnmoPcRigU9"
  }'
```

***

### POST `/batch/close-all/preview` - Preview Batch Close All

Get comprehensive preview of all accounts that would be closed and their details.

#### Request Parameters

| Parameter       | Type   | Required | Description                     |
| --------------- | ------ | -------- | ------------------------------- |
| `userPublicKey` | string | Yes      | Public key of the account owner |

#### Response

```typescript
interface BatchCloseAllPreviewResponse {
    accountPreviews: BatchAccountPreview[];  // Array of account previews
    accountsToClose: number;                // Number of accounts that would be closed
    totalLamportsReclaimed: number;         // Total lamports that would be reclaimed
    totalSolanaReclaimed: number;           // Total SOL equivalent
    estimatedTransactions: number;          // Estimated number of transactions needed
    hasDestructiveActions: boolean;         // Whether any operations are destructive
    summary: {                             // Summary by account type
        standardTokenAccounts: number;
        token2022Accounts: number;
        token2022HarvestAccounts: number;
    };
}

interface BatchAccountPreview {
    assetId: string;                       // Asset being analyzed
    transactionType: string;               // Type of operation
    lamportsReclaimed: number;             // Lamports for this account
    solanaReclaimed: number;               // SOL equivalent for this account
    isDestructiveAction: boolean;          // Whether this action is destructive
    assetInfo: AssetInfo;                  // Enhanced asset information
    feeBreakdown: FeeBreakdown;            // Fee breakdown for this account
}
```

#### cURL Example

```bash
curl -X POST https://v1.api.sol-incinerator.com/batch/close-all/preview \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "userPublicKey": "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf"
  }'
```

***

## Fees

The API charges service fees for burning and closing operations. Fees are automatically deducted from the rent reclaimed.

### Token Account Fees

For standard token accounts (SPL Token and Token-2022), the fee is calculated as:

```
Fee = max(Account Rent - 2,000,000 lamports, 0)
```

Since most token accounts contain exactly 2,039,280 lamports of rent, the typical fee is:

* **39,280 lamports (0.000039 SOL)** per token account

You receive: **2,000,000 lamports (0.002 SOL)** per token account closed/burned.

### NFT Fees

NFT burning fees are fixed amounts based on the NFT type:

| NFT Type                 | Fee (Lamports) | Fee (SOL)  |
| ------------------------ | -------------- | ---------- |
| Standard Metaplex NFT    | 509,600        | 0.0005096  |
| Edition NFT              | 224,240        | 0.00022424 |
| Programmable NFT (pNFT)  | 1,957,280      | 0.00195728 |
| Programmable Edition NFT | 1,671,920      | 0.00167192 |

**Note**: Resized NFTs use the same fee structure as their non-resized counterparts.

### MPL Core NFT Fees

For MPL Core NFTs, the fee is calculated as:

```
Fee = max(Rent Reclaimed - 1,000,000 lamports, 0)
```

Where `Rent Reclaimed = Total Account Rent - 897,840 lamports (retained by metaplex protocol)`

## Parameter Default Behavior

### Required Parameters

* `userPublicKey`: Must be provided for all endpoints
* `assetId`: Required for single asset operations (burn/close)

### Optional Parameters Default Values

* `feePayer`: Defaults to `userPublicKey`
* `autoCloseTokenAccounts`: Defaults to `true`
* `asLegacyTransaction`: Defaults to `false`
* `priorityFeeMicroLamports`: Automatically calculated if not provided
* `burnAmount`: Defaults to full token balance

#### Notes

* If `burnAmount` is not set to the full token balance, the account cannot be closed, and rent will not be reclaimed.
* If `autoCloseTokenAccounts` is set to `false`, rent will not be reclaimed (closing accounts claims rent)

## Destructive vs Non-Destructive Operations

### Destructive Operations (Irreversible)

* `/burn` - Permanently destroys tokens/NFTs/empty token accounts
* `/burn-instructions` - Instructions that destroy tokens/NFTs

**Warning**: These operations cannot be undone. Assets are permanently removed from circulation.

### Non-Destructive Operations (Reversible)

* `/close` - Closes empty accounts (new accounts can be created)
* `/close-instructions` - Instructions for closing accounts
* `/batch/close-all` - Batch close empty accounts
* `/batch/close-all-instructions` - Instructions for batch closing

These operations only reclaim rent from empty accounts and can be reversed by reopening the same token accounts.

## Error Handling

The API returns standard HTTP status codes:

* `200`: Success
* `400`: Bad request (invalid parameters, insufficient balance, etc.)
* `401`: Unauthorized (missing or invalid API key)
* `500`: Internal server error

Example error response:

```json
{
    "error": "Invalid public key format for userPublicKey"
}
```

## Rate Limiting

There is currently no rate limiting in place. This is subject to change.

## Support

For API key requests or technical support, open a ticket in the Sol Slugs Discord server.
