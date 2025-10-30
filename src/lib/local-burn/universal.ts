/**
 * Universal local burn orchestrator with inline memo and smart fallback trigger.
 */
import type { Umi } from '@metaplex-foundation/umi';
import { detectNftStandard } from './detect';
import { buildAndSendPnftBurnWithMemo } from './pnft-burn';
import { buildAndSendRegularBurnWithMemo } from './regular-burn';
import type { LocalBurnArgs, LocalBurnResult } from './types';

/**
 * Attempt a local burn first; throw a special error to signal fallback cases.
 */
export async function universalLocalBurnWithMemo(
  umi: Umi,
  args: LocalBurnArgs
): Promise<LocalBurnResult> {
  const standard = await detectNftStandard(umi, args.mint);

  try {
    if (standard === 'PNFT') {
      const { signature } = await buildAndSendPnftBurnWithMemo(umi, args);
      return { signature, type: 'PNFT' };
    }
    if (standard === 'REGULAR') {
      const { signature } = await buildAndSendRegularBurnWithMemo(umi, args);
      return { signature, type: 'REGULAR' };
    }
    throw new Error('CORE not implemented');
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    const shouldFallback =
      msg.includes('rule') ||
      msg.includes('authorization') ||
      msg.includes('tokenrecord') ||
      msg.includes('unknown nft standard') ||
      msg.includes('metadata not found');

    if (shouldFallback) {
      const e = new Error('FALLBACK_SOL_INCINERATOR');
      if (err instanceof Error) {
        (e as Error & { cause?: Error }).cause = err;
      }
      throw e;
    }
    throw err;
  }
}


