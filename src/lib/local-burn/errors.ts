/**
 * Typed errors for asset detection + burn dispatch.
 * Each maps to a specific HTTP status + user-facing message in /api/tx/burn-memo.
 */

/**
 * String literal codes attached to each typed error. Consumers (esp. the
 * /api/tx/burn-memo route handler) discriminate on `err.code` to map errors
 * to HTTP responses with user-friendly messages.
 */
export const ErrorCode = {
  NOT_AN_NFT: 'NOT_AN_NFT',
  NOT_YET_IMPLEMENTED: 'NOT_YET_IMPLEMENTED',
  UNSUPPORTED_STANDARD: 'UNSUPPORTED_STANDARD',
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  CNFT_STALE_PROOF: 'CNFT_STALE_PROOF',
  CNFT_TOO_DEEP: 'CNFT_TOO_DEEP',
  CNFT_OWNERSHIP_MISMATCH: 'CNFT_OWNERSHIP_MISMATCH',
  CNFT_DELEGATED: 'CNFT_DELEGATED',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export class NotAnNftError extends Error {
  readonly code: ErrorCode = ErrorCode.NOT_AN_NFT;
  constructor(public daInterface: string) {
    super(`asset is a fungible token, not an NFT (interface: ${daInterface})`);
  }
}

export class NotYetImplementedError extends Error {
  readonly code: ErrorCode = ErrorCode.NOT_YET_IMPLEMENTED;
  constructor(public standard: string) {
    super(`asset standard '${standard}' is recognized but not yet supported`);
  }
}

export class UnsupportedStandardError extends Error {
  readonly code: ErrorCode = ErrorCode.UNSUPPORTED_STANDARD;
  constructor(public daInterface: string) {
    super(`unrecognized asset standard (interface: ${daInterface})`);
  }
}

export class AssetNotFoundError extends Error {
  readonly code: ErrorCode = ErrorCode.ASSET_NOT_FOUND;
  constructor(public id: string) {
    super(`asset not found: ${id}`);
  }
}

export class CnftStaleProofError extends Error {
  readonly code: ErrorCode = ErrorCode.CNFT_STALE_PROOF;
  constructor() {
    super('cNFT proof is stale; tree state changed during sign');
  }
}

export class CnftTooDeepError extends Error {
  readonly code: ErrorCode = ErrorCode.CNFT_TOO_DEEP;
  constructor(public tree: string, public proofLength: number, public estimatedSize: number) {
    super(`cNFT tree ${tree} produces a ${proofLength}-node proof (~${estimatedSize} bytes) that exceeds the 1232-byte transaction size limit`);
  }
}

export class CnftOwnershipMismatchError extends Error {
  readonly code: ErrorCode = ErrorCode.CNFT_OWNERSHIP_MISMATCH;
  constructor(public daOwner: string, public signer: string) {
    super(`cNFT is owned by ${daOwner} but signer is ${signer}`);
  }
}

export class CnftDelegatedError extends Error {
  readonly code: ErrorCode = ErrorCode.CNFT_DELEGATED;
  constructor(public delegate: string) {
    super(`cNFT has an active non-owner delegate: ${delegate}`);
  }
}
