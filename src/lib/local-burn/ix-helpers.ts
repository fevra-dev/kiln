/**
 * Instruction helpers for compute budget and SPL memo in Umi builders.
 */
import { publicKey, transactionBuilder, some } from '@metaplex-foundation/umi';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';

/**
 * Attach compute budget instructions with sensible defaults.
 */
export function withComputeBudget(
  tb: ReturnType<typeof transactionBuilder>,
  opts?: { cu?: number; microLamports?: number }
) {
  const cu = opts?.cu ?? 500_000;
  const microLamports = opts?.microLamports ?? 2_000;
  return tb.add(setComputeUnitLimit({ units: cu })).add(setComputeUnitPrice({ microLamports }));
}

/**
 * Attach a raw SPL Memo instruction carrying the provided JSON payload.
 *
 * Note: Umi versions differ on raw-bytes support; this path uses a minimal
 * instruction descriptor to pass bytes for Memo.
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
      bytesCreatedOnChain: 0n,
    },
    signers: [],
    // No additional on-chain bytes besides the instruction itself
    bytesCreatedOnChain: some(0n),
  });
}


