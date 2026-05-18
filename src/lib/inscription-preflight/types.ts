/**
 * Type contracts for the pre-burn inscription pre-flight check.
 * See: docs/superpowers/specs/2026-05-17-pre-burn-inscription-check-design.md §4.2
 */

export type SatRarity =
  | 'common' | 'uncommon' | 'rare'
  | 'epic' | 'legendary' | 'mythic';

export type IndexerName = 'ordinals.com' | 'hiro.so';

export type IndexerCheckStatus =
  | 'not_found'
  | 'timeout'
  | 'error'
  | 'rate_limited';

export interface IndexerCheck {
  name: IndexerName;
  status: IndexerCheckStatus;
  httpStatus?: number;
}

export interface PreflightSuccess {
  exists: true;
  inscriptionId: string;
  confirmations: number;
  genesisBlockHeight: number | null;
  genesisTimestamp: number | null;
  contentType: string;
  contentLength: number;
  contentSha256: string | null;
  contentUrl: string;
  sat: number;
  satRarity: SatRarity;
  cursed: boolean;
  burned: boolean;
  indexerUsed: IndexerName;
  cached: boolean;
  checkedAt: number;
}

export interface PreflightNotFound {
  exists: false;
  inscriptionId: string;
  reason: 'not_found' | 'all_unreachable';
  indexersChecked: IndexerCheck[];
  checkedAt: number;
}

export type PreflightResponse = PreflightSuccess | PreflightNotFound;

/**
 * Intermediate normalized shape returned by individual indexer clients.
 * Orchestration layer transforms this into PreflightResponse.
 */
export interface IndexerResponse {
  inscriptionId: string;
  sat: number;
  satRarity: SatRarity;
  genesisBlockHeight: number | null;
  genesisTimestamp: number | null;
  confirmations: number;
  contentType: string;
  contentLength: number;
  contentSha256: string | null;
  cursed: boolean;
  burned: boolean;
}

export interface IndexerResult {
  ok: true;
  data: IndexerResponse;
  source: IndexerName;
}

export interface IndexerError {
  ok: false;
  source: IndexerName;
  status: IndexerCheckStatus;
  httpStatus?: number;
}
