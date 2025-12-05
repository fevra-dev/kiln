/**
 * Zod validation schemas for KILN.1 Teleburn Standard
 * 
 * @description Input validation for all external data sources
 * @version 0.1.1
 */

import { z } from 'zod';
import { STANDARD, STANDARD_VERSION } from './types';

// ============================================================================
// BASE VALIDATORS
// ============================================================================

/**
 * Validates Bitcoin inscription ID format: <64-hex-txid>i<index>
 * 
 * @example "abc123...def789i0"
 */
export const InscriptionIdSchema = z.string().regex(
  /^[0-9a-fA-F]{64}i\d+$/,
  'Invalid inscription ID format. Must be: <64-char-hex-txid>i<index>'
);

/**
 * Validates Solana public key (Base58, 32-44 characters)
 * 
 * @example "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
 */
export const PublicKeySchema = z.string().regex(
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  'Invalid Solana public key format'
);

/**
 * Validates SHA-256 hash (64 character hex string)
 * 
 * @example "a1b2c3d4e5f6..." (64 chars)
 */
export const Sha256Schema = z.string().regex(
  /^[0-9a-f]{64}$/i,
  'Invalid SHA-256 format. Must be 64-character hex string'
);

/**
 * Validates Unix epoch timestamp (reasonable range)
 * Must be after 2020-01-01 and before 2100-01-01
 */
export const TimestampSchema = z.number().int().min(
  1577836800, // 2020-01-01
  'Timestamp too far in the past'
).max(
  4102444800, // 2100-01-01
  'Timestamp too far in the future'
);

/**
 * Validates Solana slot/block height
 * Must be positive integer
 */
export const BlockHeightSchema = z.number().int().positive('Block height must be positive');

/**
 * Validates bump seed (0-255)
 */
export const BumpSchema = z.number().int().min(0).max(255, 'Bump must be 0-255');

/**
 * Validates URL format
 */
export const UrlSchema = z.string().url('Invalid URL format');

// ============================================================================
// ENUM VALIDATORS
// ============================================================================

/**
 * Validates teleburn method
 */
export const TeleburnMethodSchema = z.enum(['teleburn-burn', 'teleburn-incinerate', 'teleburn-derived', 'burn', 'incinerate']); // Includes old values for backward compatibility

/**
 * Validates chain network
 */
export const ChainNetworkSchema = z.enum([
  'solana-mainnet',
  'solana-devnet',
  'bitcoin-mainnet',
  'bitcoin-testnet'
]);

/**
 * Validates memo action
 */
export const MemoActionSchema = z.enum(['teleburn-seal', 'teleburn-burn', 'teleburn-incinerate', 'teleburn-derived', 'seal', 'burn', 'incinerate']); // Includes old values for backward compatibility

// ============================================================================
// MEMO PAYLOAD SCHEMAS
// ============================================================================

/**
 * Validates Seal memo payload structure
 * This is the on-chain JSON written to SPL Memo program
 */
export const Sbt01SealSchema = z.object({
  standard: z.literal(STANDARD),
  version: z.literal(STANDARD_VERSION),
  source_chain: ChainNetworkSchema,
  target_chain: ChainNetworkSchema,
  action: z.literal('teleburn-seal').or(z.literal('seal')), // Support both for backward compatibility
  timestamp: TimestampSchema,
  block_height: BlockHeightSchema,
  inscription: z.object({
    id: InscriptionIdSchema,
    network: z.enum(['bitcoin-mainnet', 'bitcoin-testnet'])
  }),
  solana: z.object({
    mint: PublicKeySchema,
    collection: PublicKeySchema.optional()
  }),
  media: z.object({
    sha256: Sha256Schema
  }),
  extra: z.object({
    signers: z.array(PublicKeySchema).optional(),
    note: z.string().max(200).optional()
  }).optional()
});

/**
 * Validates Retire memo payload structure
 */
export const Sbt01RetireSchema = z.object({
  standard: z.literal(STANDARD),
  version: z.literal(STANDARD_VERSION),
  action: TeleburnMethodSchema,
  timestamp: TimestampSchema,
  block_height: BlockHeightSchema,
  inscription: z.object({
    id: InscriptionIdSchema
  }),
  solana: z.object({
    mint: PublicKeySchema
  }),
  media: z.object({
    sha256: Sha256Schema
  }),
  derived: z.object({
    bump: BumpSchema
  }).optional()
}).refine(
  (data) => {
    // If action is 'teleburn-derived', derived.bump is REQUIRED
    if (data.action === 'teleburn-derived') {
      return data.derived?.bump !== undefined;
    }
    return true;
  },
  {
    message: 'derived.bump is required when action is "teleburn-derived"',
    path: ['derived']
  }
);

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================

/**
 * Validates seal transaction build request
 */
export const SealTransactionRequestSchema = z.object({
  feePayer: PublicKeySchema,
  mint: PublicKeySchema,
  inscriptionId: InscriptionIdSchema,
  sha256: Sha256Schema,
  network: z.enum(['mainnet', 'devnet']).optional().default('mainnet'),
  signers: z.array(PublicKeySchema).optional()
});

/**
 * Validates seal API request (route handler)
 */
export const sealRequestSchema = z.object({
  payer: PublicKeySchema,
  mint: PublicKeySchema,
  inscriptionId: InscriptionIdSchema,
  authority: z.array(PublicKeySchema).optional(),
  priorityMicrolamports: z.number().int().min(0).optional(), // Optional priority fee
  computeUnits: z.number().int().min(1_000).max(1_400_000).optional() // Optional compute unit limit
});

/**
 * Validates retire transaction build request
 */
export const RetireTransactionRequestSchema = z.object({
  feePayer: PublicKeySchema,
  mint: PublicKeySchema,
  inscriptionId: InscriptionIdSchema,
  sha256: Sha256Schema,
  method: TeleburnMethodSchema,
  bump: BumpSchema.optional()
}).refine(
  (data) => {
    // Bump is REQUIRED for teleburn-derived method
    if (data.method === 'teleburn-derived') {
      return data.bump !== undefined;
    }
    return true;
  },
  {
    message: 'bump is required when method is "teleburn-derived"',
    path: ['bump']
  }
);

/**
 * Validates retire API request (route handler)
 */
export const retireRequestSchema = z.object({
  payer: PublicKeySchema,
  owner: PublicKeySchema,
  mint: PublicKeySchema,
  inscriptionId: InscriptionIdSchema,
  method: TeleburnMethodSchema,
  amount: z.string().optional(),
  priorityMicrolamports: z.number().int().min(0).optional(), // Optional priority fee
  computeUnits: z.number().int().min(1_000).max(1_400_000).optional() // Optional compute unit limit
});

/**
 * Validates update metadata URI request
 */
export const UpdateUriRequestSchema = z.object({
  feePayer: PublicKeySchema,
  mint: PublicKeySchema,
  newUri: UrlSchema,
  updateAuthority: PublicKeySchema
});

/**
 * Validates verification request
 */
export const VerifyRequestSchema = z.object({
  mint: PublicKeySchema,
  inscriptionId: InscriptionIdSchema.optional(),
  rpcUrls: z.array(UrlSchema).optional()
});

/**
 * Validates inscription content verification request
 */
export const InscriptionVerifyRequestSchema = z.object({
  inscriptionId: InscriptionIdSchema,
  expectedSha256: Sha256Schema
});

/**
 * Validates dry run request
 */
export const DryRunRequestSchema = z.object({
  feePayer: PublicKeySchema,
  mint: PublicKeySchema,
  inscriptionId: InscriptionIdSchema,
  sha256: Sha256Schema,
  method: TeleburnMethodSchema,
  pointerUri: UrlSchema.optional(),
  updateMetadata: z.boolean().optional().default(false)
});

// ============================================================================
// BATCH PROCESSING SCHEMAS
// ============================================================================

/**
 * Validates individual batch item
 */
export const BatchItemSchema = z.object({
  mint: PublicKeySchema,
  inscriptionId: InscriptionIdSchema,
  sha256: Sha256Schema,
  method: TeleburnMethodSchema,
  pointerUri: UrlSchema.optional(),
  updateMetadata: z.boolean().optional().default(false)
});

/**
 * Validates batch processing request
 */
export const BatchRequestSchema = z.object({
  feePayer: PublicKeySchema,
  items: z.array(BatchItemSchema).min(1).max(100, 'Batch size limited to 100 items'),
  maxConcurrent: z.number().int().min(1).max(5).optional().default(3),
  maxRetries: z.number().int().min(0).max(5).optional().default(3)
});

// ============================================================================
// DERIVED OWNER SCHEMA
// ============================================================================

/**
 * Validates derived owner derivation request
 */
export const DeriveOwnerRequestSchema = z.object({
  inscriptionId: InscriptionIdSchema,
  startBump: BumpSchema.optional().default(0)
});

// ============================================================================
// TRANSACTION DECODE SCHEMA
// ============================================================================

/**
 * Validates transaction decode request
 */
export const DecodeRequestSchema = z.object({
  transaction: z.string().min(1, 'Transaction string cannot be empty'),
  encoding: z.enum(['base64', 'base58']).optional().default('base64')
});

/**
 * Validates transaction simulation request
 */
export const SimulateRequestSchema = z.object({
  transaction: z.string().min(1, 'Transaction string cannot be empty'),
  encoding: z.enum(['base64', 'base58']).optional().default('base64'),
  commitment: z.enum(['processed', 'confirmed', 'finalized']).optional().default('confirmed')
});

// ============================================================================
// POINTER JSON SCHEMA
// ============================================================================

/**
 * Validates pointer JSON metadata for updated NFT
 */
export const PointerJsonSchema = z.object({
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  description: z.string().max(500),
  image: UrlSchema,
  external_url: UrlSchema.optional(),
  attributes: z.array(z.object({
    trait_type: z.string(),
    value: z.union([z.string(), z.number()])
  })).optional(),
  properties: z.object({
    ordinal: z.object({
      inscription_id: InscriptionIdSchema,
      sha256: Sha256Schema,
      network: z.enum(['bitcoin-mainnet', 'bitcoin-testnet'])
    }),
    files: z.array(z.object({
      uri: UrlSchema,
      type: z.string()
    })).optional()
  }).optional(),
  recovery: z.object({
    originalMetadataUri: UrlSchema.optional(),
    originalMetadataHash: z.string().optional(),
    teleburn_date: z.string().datetime().optional(),
    authority: PublicKeySchema.optional()
  }).optional()
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely parse and validate data with zod schema
 * Returns parsed data or throws descriptive error
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Parsed and validated data
 * @throws ZodError with detailed validation errors
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data);
}

/**
 * Safely parse and validate data with zod schema (safe version)
 * Returns success/error object instead of throwing
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Result object with success flag and data or errors
 */
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Format zod validation errors into user-friendly messages
 * 
 * @param error - ZodError from failed validation
 * @returns Array of human-readable error messages
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}

/**
 * Validate inscription ID format (quick check without full schema)
 * 
 * @param id - Inscription ID to validate
 * @returns true if format is valid
 */
export function isValidInscriptionId(id: string): boolean {
  return /^[0-9a-fA-F]{64}i\d+$/.test(id);
}

/**
 * Validate Solana public key format (quick check without full schema)
 * 
 * @param key - Public key to validate
 * @returns true if format is valid
 */
export function isValidPublicKey(key: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key);
}

/**
 * Validate SHA-256 hash format (quick check without full schema)
 * 
 * @param hash - Hash to validate
 * @returns true if format is valid
 */
export function isValidSha256(hash: string): boolean {
  return /^[0-9a-f]{64}$/i.test(hash);
}

/**
 * Validate timestamp is within acceptable range (±5 minutes from now)
 * Used to detect clock drift issues
 * 
 * @param timestamp - Unix epoch timestamp in seconds
 * @returns true if timestamp is within acceptable range
 */
export function isTimestampValid(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  return diff <= 300; // 5 minutes tolerance
}

// ============================================================================
// TYPE EXPORTS (for TypeScript inference from schemas)
// ============================================================================

export type SealTransactionRequest = z.infer<typeof SealTransactionRequestSchema>;
export type RetireTransactionRequest = z.infer<typeof RetireTransactionRequestSchema>;
export type UpdateUriRequest = z.infer<typeof UpdateUriRequestSchema>;
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
export type InscriptionVerifyRequest = z.infer<typeof InscriptionVerifyRequestSchema>;
export type DryRunRequest = z.infer<typeof DryRunRequestSchema>;
export type BatchRequest = z.infer<typeof BatchRequestSchema>;
export type DecodeRequest = z.infer<typeof DecodeRequestSchema>;
export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;
export type PointerJson = z.infer<typeof PointerJsonSchema>;

