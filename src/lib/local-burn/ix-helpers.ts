/**
 * Instruction helpers for compute budget and SPL memo in Umi builders.
 */
import { publicKey, transactionBuilder, type Umi } from '@metaplex-foundation/umi';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';

/**
 * Attach compute budget instructions with sensible defaults.
 */
export function withComputeBudget(
  umi: Umi,
  tb: ReturnType<typeof transactionBuilder>,
  opts?: { cu?: number; microLamports?: number }
) {
  const cu = opts?.cu ?? 500_000;
  const microLamports = opts?.microLamports ?? 2_000;
  return tb.add(setComputeUnitLimit(umi, { units: cu })).add(setComputeUnitPrice(umi, { microLamports }));
}

/**
 * Attach a raw SPL Memo instruction carrying the provided JSON payload.
 *
 * Note: Umi versions differ on raw-bytes support; this path uses a minimal
 * instruction descriptor to pass bytes for Memo.
 * 
 * @deprecated Use withSplMemoString for v1.0 protocol (string format)
 */
export function withSplMemo(
  tb: ReturnType<typeof transactionBuilder>,
  memoJson: object
) {
  const MEMO_PROGRAM_ID = publicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  const data = new TextEncoder().encode(JSON.stringify(memoJson));
  return tb.add({
    instruction: {
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data,
    },
    signers: [],
    // No additional on-chain bytes besides the instruction itself (memo is instruction data only)
    bytesCreatedOnChain: 0,
  });
}

/**
 * Attach a raw SPL Memo instruction with a plain string payload (v1.0 format).
 * 
 * Used for KILN Teleburn Protocol v1.0: teleburn:<inscription_id>
 * 
 * @param tb - Transaction builder
 * @param memoString - Plain string memo (e.g., "teleburn:abc123...i0")
 */
export function withSplMemoString(
  tb: ReturnType<typeof transactionBuilder>,
  memoString: string
) {
  const MEMO_PROGRAM_ID = publicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  const data = new TextEncoder().encode(memoString);
  return tb.add({
    instruction: {
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data,
    },
    signers: [],
    bytesCreatedOnChain: 0,
  });
}


