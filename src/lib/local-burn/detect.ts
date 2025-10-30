/**
 * NFT standard detection for local burn routing.
 */
import { publicKey, type Umi } from '@metaplex-foundation/umi';
import { fetchMetadata, TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import type { NftStandard } from './types';

/**
 * Detect whether a mint is PNFT or REGULAR using Metaplex metadata.
 * CORE can be added later via mpl-core.
 */
export async function detectNftStandard(umi: Umi, mint: string): Promise<NftStandard> {
  try {
    const md = await fetchMetadata(umi, publicKey(mint));
    
    // tokenStandard is an Option<TokenStandard>, need to unwrap it
    if (md.tokenStandard.__option === 'Some') {
      const std = md.tokenStandard.value;
      if (std === TokenStandard.ProgrammableNonFungible) return 'PNFT';
      if (std === TokenStandard.NonFungible || std === TokenStandard.NonFungibleEdition) return 'REGULAR';
    }
  } catch (e) {
    // Continue to throw for unknown assets; caller decides fallback
  }
  throw new Error('Unknown NFT standard or metadata not found');
}


