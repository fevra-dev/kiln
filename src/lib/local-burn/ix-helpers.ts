/**
 * Instruction helpers for compute budget and SPL memo in Umi builders.
 */
import { publicKey, transactionBuilder, type Umi } from '@metaplex-foundation/umi';
import { setComputeUnitLimit, setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';

const MEMO_PROGRAM_ID = publicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

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
 * Attach a raw SPL Memo instruction with a plain string payload (v1.0 format).
 *
 * Used for KILN Teleburn Protocol v1.0: teleburn:<inscription_id>
 */
export function withSplMemoString(
  tb: ReturnType<typeof transactionBuilder>,
  memoString: string
) {
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


