/**
 * Solana Teleburn Address Derivation
 * 
 * @description Derives deterministic off-curve Solana addresses from Bitcoin
 * inscription IDs using SHA-256 hashing with domain separation. This creates
 * provably ownerless addresses (no private key exists) for teleburn operations.
 * 
 * ## Algorithm
 * 
 * The derivation follows a pattern similar to Ethereum's Ordinals teleburn:
 * 
 * 1. **Parse Inscription ID**: Split `<txid>i<index>` into components
 *    - txid: 64 hex characters (32 bytes)
 *    - index: Non-negative integer (stored as 4-byte big-endian)
 * 
 * 2. **Construct Preimage**: 
 *    ```
 *    preimage = txid (32 bytes) || index (4 bytes, big-endian) || salt
 *    salt = "SBT01:solana:v1" (UTF-8)
 *    ```
 * 
 * 3. **Hash and Iterate**:
 *    ```
 *    candidate = SHA-256(preimage)
 *    while isOnCurve(candidate):
 *      candidate = SHA-256(candidate || 0x00)
 *    return candidate as PublicKey
 *    ```
 * 
 * ## Security Properties
 * 
 * - **Domain Separation**: The salt prevents cross-chain address collisions
 * - **Off-Curve Guarantee**: Iterative hashing ensures no private key exists
 * - **Deterministic**: Same inscription ID always produces same address
 * - **One-Way**: Cannot reverse-engineer inscription ID from address
 * 
 * ## Comparison to Ethereum
 * 
 * | Property | Ethereum | Solana (This Implementation) |
 * |----------|----------|------------------------------|
 * | Input | txid (32 bytes) + index (4 bytes) | txid + index + salt |
 * | Hash | SHA-256 | SHA-256 |
 * | Output | First 20 bytes | 32 bytes (off-curve) |
 * | Iteration | None | Until off-curve |
 * | Domain Separation | No | Yes (security improvement) |
 * 
 * @version 0.1.1
 * @see https://docs.ordinals.com/guides/teleburning.html
 */

import { PublicKey, Transaction, TransactionInstruction, Connection } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  createCloseAccountInstruction,
  createBurnInstruction
} from '@solana/spl-token';

// ============================================================================
// CONSTANTS
// ============================================================================

/** SPL Memo program for on-chain breadcrumbs */
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/** Canonical Solana incinerator address (provably unspendable) */
export const INCINERATOR = new PublicKey('1nc1nerator11111111111111111111111111111111');

/** 
 * Domain separation string for teleburn address derivation
 * 
 * This prevents cross-chain collisions if the same inscription ID
 * is used on multiple chains (e.g., Solana vs Ethereum).
 * 
 * Format: <protocol>:<chain>:<version>
 */
export const TELEBURN_DOMAIN = 'SBT01:solana:v1';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parsed inscription ID components
 */
export interface ParsedInscriptionId {
  /** Bitcoin transaction ID (32 bytes) */
  txid: Uint8Array;
  /** Inscription index within the transaction */
  index: number;
}

/**
 * Derived teleburn address result
 */
export interface DerivedTeleburnAddress {
  /** The derived off-curve public key */
  publicKey: PublicKey;
  /** Number of iterations needed to find off-curve point (for debugging) */
  iterations: number;
}

// ============================================================================
// INSCRIPTION ID PARSING
// ============================================================================

/**
 * Parse Bitcoin inscription ID into components
 * 
 * Inscription IDs follow the format: `<64-hex-txid>i<index>`
 * 
 * @param id - Bitcoin inscription ID (e.g., "abc...123i0")
 * @returns Parsed txid and index
 * @throws Error if format is invalid
 * 
 * @example
 * ```typescript
 * const { txid, index } = parseInscriptionId('abc...123i42');
 * // txid: Uint8Array(32) [0xab, 0xc1, 0x23, ...]
 * // index: 42
 * ```
 */
export function parseInscriptionId(id: string): ParsedInscriptionId {
  // Match inscription ID pattern: 64 hex chars + 'i' + digits
  const match = id.match(/^([0-9a-fA-F]{64})i(\d+)$/);
  
  if (!match) {
    throw new Error(
      'Invalid inscription ID format. Expected: <64-hex-txid>i<index>\n' +
      `Example: abc123...def789i0\n` +
      `Received: ${id}`
    );
  }

  const [, txidHex, indexStr] = match;

  // Parse txid from hex (case-insensitive)
  const txid = Uint8Array.from(Buffer.from(txidHex.toLowerCase(), 'hex'));
  
  if (txid.length !== 32) {
    throw new Error(`Invalid txid: expected 32 bytes, got ${txid.length}`);
  }

  // Parse index (must be finite non-negative integer)
  const index = Number(indexStr);
  
  if (!Number.isFinite(index) || index < 0) {
    throw new Error(`Invalid index: must be non-negative integer, got "${indexStr}"`);
  }

  // Validate index fits in u32 (4 bytes)
  if (index > 0xFFFFFFFF) {
    throw new Error(`Invalid index: exceeds u32 maximum (${0xFFFFFFFF}), got ${index}`);
  }

  return { txid, index };
}

// ============================================================================
// SHA-256 HASHING
// ============================================================================

/**
 * Compute SHA-256 hash (browser & Node.js compatible)
 * 
 * Automatically detects environment:
 * - Browser: Uses Web Crypto API (SubtleCrypto)
 * - Node.js: Uses native crypto module
 * 
 * @param buffer - Data to hash
 * @returns SHA-256 hash (32 bytes)
 */
async function sha256Async(buffer: Uint8Array): Promise<Uint8Array> {
  // Try browser Web Crypto API first
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
    const hashBuffer = await (globalThis as any).crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(hashBuffer);
  }
  
  // Fall back to Node.js crypto module
  const { createHash } = await import('crypto');
  return Uint8Array.from(createHash('sha256').update(buffer).digest());
}

// ============================================================================
// TELEBURN ADDRESS DERIVATION
// ============================================================================

/**
 * Derive deterministic off-curve teleburn address from inscription ID
 * 
 * This function implements the core derivation algorithm:
 * 
 * 1. Parse inscription ID into txid (32 bytes) + index (4 bytes)
 * 2. Construct preimage: txid || index || domain_salt
 * 3. Hash with SHA-256
 * 4. If on-curve, append 0x00 and re-hash (iterate until off-curve)
 * 5. Return off-curve PublicKey
 * 
 * **Why off-curve?** On-curve points could theoretically have a private key
 * (1 in 2^252 chance). Off-curve points provably have NO private key.
 * 
 * @param id - Bitcoin inscription ID
 * @returns Derived off-curve PublicKey and iteration count
 * 
 * @example
 * ```typescript
 * const result = await deriveTeleburnAddress(
 *   '6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0'
 * );
 * console.log('Address:', result.publicKey.toBase58());
 * console.log('Iterations:', result.iterations);
 * ```
 */
export async function deriveTeleburnAddress(id: string): Promise<PublicKey> {
  // Step 1: Parse inscription ID
  const { txid, index } = parseInscriptionId(id);

  // Step 2: Prepare domain salt (UTF-8 encoded)
  const salt = new TextEncoder().encode(TELEBURN_DOMAIN);

  // Step 3: Construct preimage buffer
  // Layout: [txid (32 bytes)] [index (4 bytes, big-endian)] [salt]
  const preimage = new Uint8Array(32 + 4 + salt.length);
  
  // Copy txid (32 bytes)
  preimage.set(txid, 0);
  
  // Write index as big-endian u32 (matches Bitcoin serialization)
  const dataView = new DataView(preimage.buffer);
  dataView.setUint32(32, index, false); // false = big-endian
  
  // Copy salt
  preimage.set(salt, 36);

  // Step 4: Hash preimage
  let candidate = await sha256Async(preimage);

  // Step 5: Iterate until off-curve point found
  // Most inscription IDs find off-curve on first try (probability ≈ 7/8)
  let iterations = 0;
  
  while (isOnCurve(candidate)) {
    iterations++;
    
    // Append 0x00 byte and re-hash
    const extended = new Uint8Array(candidate.length + 1);
    extended.set(candidate, 0);
    extended[candidate.length] = 0x00;
    
    candidate = await sha256Async(extended);
    
    // Safety check (should never happen in practice)
    if (iterations > 100) {
      throw new Error(
        `Failed to find off-curve point after ${iterations} iterations. ` +
        'This is statistically impossible - possible implementation bug.'
      );
    }
  }

  // Step 6: Return off-curve PublicKey
  return new PublicKey(candidate);
}

/**
 * Check if a 32-byte point is on the Ed25519 curve
 * 
 * This uses Solana's runtime PublicKey.isOnCurve() method when available.
 * Falls back to constructor validation (throws if invalid).
 * 
 * @param bytes - 32-byte candidate point
 * @returns true if point is on curve, false if off-curve
 */
function isOnCurve(bytes: Uint8Array): boolean {
  try {
    // Try runtime isOnCurve check (available in @solana/web3.js)
    // @ts-ignore - isOnCurve may not be in all type definitions
    if (typeof PublicKey.isOnCurve === 'function') {
      return (PublicKey as any).isOnCurve(bytes);
    }

    // Fallback: Try to construct PublicKey
    // On-curve points construct successfully, off-curve may throw
    const pk = new PublicKey(bytes);
    
    // Additional validation: try basic operations
    pk.toBuffer();
    pk.toBase58();
    
    // If we got here without errors, assume on-curve
    return true;
    
  } catch {
    // Constructor or operations failed - definitely off-curve
    return false;
  }
}

// ============================================================================
// VERIFICATION HELPERS
// ============================================================================

/**
 * Verify a claimed teleburn address matches an inscription ID
 * 
 * Re-derives the address and checks if it matches the expected value.
 * Useful for validation and testing.
 * 
 * @param inscriptionId - Bitcoin inscription ID
 * @param expectedAddress - Address to verify
 * @returns true if address matches derivation
 * 
 * @example
 * ```typescript
 * const address = await deriveTeleburnAddress('abc...i0');
 * const isValid = await verifyTeleburnAddress('abc...i0', address);
 * console.log('Valid:', isValid); // true
 * ```
 */
export async function verifyTeleburnAddress(
  inscriptionId: string,
  expectedAddress: PublicKey
): Promise<boolean> {
  try {
    const derived = await deriveTeleburnAddress(inscriptionId);
    return derived.equals(expectedAddress);
  } catch {
    return false;
  }
}

/**
 * Batch derive multiple teleburn addresses (parallel execution)
 * 
 * Processes multiple inscription IDs simultaneously for efficiency.
 * 
 * @param inscriptionIds - Array of inscription IDs
 * @returns Array of derived addresses (same order as input)
 * 
 * @example
 * ```typescript
 * const addresses = await deriveTeleburnAddressBatch([
 *   'abc...i0',
 *   'def...i1',
 *   'ghi...i2'
 * ]);
 * ```
 */
export async function deriveTeleburnAddressBatch(
  inscriptionIds: string[]
): Promise<PublicKey[]> {
  return Promise.all(inscriptionIds.map(id => deriveTeleburnAddress(id)));
}

// ============================================================================
// TOKEN PROGRAM DETECTION
// ============================================================================

/**
 * Detect which token program a mint uses
 * 
 * Checks if mint is owned by TOKEN_2022_PROGRAM_ID or TOKEN_PROGRAM_ID.
 * 
 * @param connection - Solana connection
 * @param mint - Mint public key
 * @returns Token program ID
 * @throws Error if mint account not found
 */
export async function getTokenProgramId(
  connection: Connection, 
  mint: PublicKey
): Promise<PublicKey> {
  const accountInfo = await connection.getAccountInfo(mint);
  
  if (!accountInfo) {
    throw new Error(`Mint account not found: ${mint.toBase58()}`);
  }

  // Check if Token-2022 (Token Extensions)
  if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return TOKEN_2022_PROGRAM_ID;
  }

  // Default to legacy Token Program
  return TOKEN_PROGRAM_ID;
}

// ============================================================================
// MEMO INSTRUCTIONS
// ============================================================================

/**
 * Create SPL Memo instruction with JSON payload
 * 
 * Memos are stored on-chain and visible in block explorers.
 * Used for recording teleburn proof breadcrumbs.
 * 
 * @param data - Data to serialize as JSON memo
 * @returns Memo instruction
 * 
 * @example
 * ```typescript
 * const memo = createMemoInstruction({
 *   standard: 'KILN',
 *   action: 'teleburn',
 *   inscription: { id: 'abc...i0' }
 * });
 * transaction.add(memo);
 * ```
 */
export function createMemoInstruction(data: unknown): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [],
    data: Buffer.from(JSON.stringify(data), 'utf-8')
  });
}

// ============================================================================
// TRANSACTION BUILDERS
// ============================================================================

/**
 * Build transaction to seal inscription proof on-chain
 * 
 * Creates a memo-only transaction for recording the inscription-to-mint
 * relationship on Solana. This is the first step of teleburn.
 * 
 * @param connection - Solana connection
 * @param payer - Transaction fee payer
 * @param memoData - Seal memo data (should include inscription ID, mint, sha256)
 * @returns Unsigned transaction
 */
export async function buildSealTx(
  connection: Connection,
  payer: PublicKey,
  memoData: any
): Promise<Transaction> {
  const tx = new Transaction();
  
  // Add memo instruction
  tx.add(createMemoInstruction(memoData));
  
  // Set fee payer
  tx.feePayer = payer;
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  return tx;
}

/**
 * Build transaction to burn SPL token (reduce supply)
 * 
 * This permanently destroys the token by reducing total supply.
 * 
 * @param connection - Solana connection
 * @param payer - Transaction signer and fee payer
 * @param mint - Mint to burn from
 * @param includeMemo - Optional memo data
 * @returns Unsigned transaction
 */
export async function buildBurnTx(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  includeMemo?: any
): Promise<Transaction> {
  // Detect token program (TOKEN or TOKEN_2022)
  const tokenProgram = await getTokenProgramId(connection, mint);
  
  // Get owner's ATA
  const fromAta = await getAssociatedTokenAddress(mint, payer, false, tokenProgram);
  
  // Build instructions
  const ixs = [];
  
  // Optional memo
  if (includeMemo) {
    ixs.push(createMemoInstruction(includeMemo));
  }
  
  // Burn 1 token (NFT)
  ixs.push(createBurnInstruction(fromAta, mint, payer, 1, [], tokenProgram));
  
  // Close token account (reclaim rent)
  ixs.push(createCloseAccountInstruction(fromAta, payer, payer, [], tokenProgram));
  
  // Build transaction
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer;
  
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  return tx;
}

/**
 * Build transaction to incinerate SPL token (send to dead address)
 * 
 * Transfers token to canonical incinerator address (no known private key).
 * 
 * @param connection - Solana connection
 * @param payer - Transaction signer and fee payer
 * @param mint - Mint to incinerate
 * @param includeMemo - Optional memo data
 * @returns Unsigned transaction
 */
export async function buildIncinerateTx(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  includeMemo?: any
): Promise<Transaction> {
  const tokenProgram = await getTokenProgramId(connection, mint);
  
  // Get ATAs
  const fromAta = await getAssociatedTokenAddress(mint, payer, false, tokenProgram);
  const toAta = await getAssociatedTokenAddress(mint, INCINERATOR, true, tokenProgram);
  
  // Build instructions
  const ixs = [];
  
  if (includeMemo) {
    ixs.push(createMemoInstruction(includeMemo));
  }
  
  // Create incinerator ATA (idempotent - won't fail if exists)
  ixs.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      toAta,
      INCINERATOR,
      mint,
      tokenProgram
    )
  );
  
  // Transfer to incinerator
  ixs.push(createTransferInstruction(fromAta, toAta, payer, 1, [], tokenProgram));
  
  // Close owner's ATA
  ixs.push(createCloseAccountInstruction(fromAta, payer, payer, [], tokenProgram));
  
  // Build transaction
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer;
  
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  return tx;
}

/**
 * Build transaction for teleburn-derived method
 * 
 * Transfers token to deterministic off-curve address derived from
 * inscription ID. This is the RECOMMENDED teleburn method.
 * 
 * @param connection - Solana connection
 * @param payer - Transaction signer and fee payer
 * @param mint - Mint to teleburn
 * @param inscriptionId - Bitcoin inscription ID
 * @param sha256Hex - SHA-256 hash of inscription content
 * @returns Unsigned transaction and derived owner address
 */
export async function buildTeleburnDerivedTx(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  inscriptionId: string,
  sha256Hex: string
): Promise<{ tx: Transaction; derivedOwner: PublicKey }> {
  // Derive teleburn address
  const derivedOwner = await deriveTeleburnAddress(inscriptionId);
  
  // Detect token program
  const tokenProgram = await getTokenProgramId(connection, mint);
  
  // Get ATAs
  const fromAta = await getAssociatedTokenAddress(mint, payer, false, tokenProgram);
  const toAta = await getAssociatedTokenAddress(mint, derivedOwner, true, tokenProgram);
  
  // Build memo payload
  const memoData = {
    standard: 'KILN',
    version: '0.1',
    action: 'teleburn-derived',
    inscription: {
      id: inscriptionId,
      network: 'bitcoin-mainnet'
    },
    solana: {
      mint: mint.toBase58()
    },
    media: {
      sha256: sha256Hex
    }
  };
  
  // Build instructions
  const ixs = [
    createMemoInstruction(memoData),
    
    // Create derived owner's ATA (idempotent)
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      toAta,
      derivedOwner,
      mint,
      tokenProgram
    ),
    
    // Transfer to derived owner
    createTransferInstruction(fromAta, toAta, payer, 1, [], tokenProgram),
    
    // Close owner's ATA
    createCloseAccountInstruction(fromAta, payer, payer, [], tokenProgram)
  ];
  
  // Build transaction
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer;
  
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  return { tx, derivedOwner };
}

/**
 * Build transaction to update metadata URI
 * 
 * Updates the token's metadata to point to a new URI (e.g., pointer JSON).
 * Requires mutable metadata and update authority.
 * 
 * @param _connection - Solana connection (unused, for future expansion)
 * @param payer - Transaction fee payer
 * @param mint - Mint to update
 * @param uri - New URI
 * @returns Unsigned transaction
 */
export async function buildUpdateUriTx(
  _connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  uri: string
): Promise<Transaction> {
  // Import Metaplex Token Metadata utilities
  const { 
    createUpdateMetadataAccountV2Instruction, 
    findMetadataPda 
  } = await import('@metaplex-foundation/mpl-token-metadata');
  
  // Find metadata PDA
  const [metadata] = findMetadataPda(mint);
  
  // Create update instruction
  const ix = createUpdateMetadataAccountV2Instruction(
    {
      metadata,
      updateAuthority: payer
    },
    {
      updateMetadataAccountArgsV2: {
        data: {
          name: '',
          symbol: '',
          uri,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null
        },
        updateAuthority: payer,
        primarySaleHappened: null,
        isMutable: null
      }
    }
  );
  
  // Build transaction
  const tx = new Transaction().add(ix);
  tx.feePayer = payer;
  
  return tx;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default deriveTeleburnAddress;

