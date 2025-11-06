/**
 * RPC Initialization
 * 
 * Initializes RPC failover manager on server startup.
 * Reads configuration from environment variables.
 * 
 * @version 0.1.1
 */

import { initializeRpcFailover } from './rpc-failover';

/**
 * Initialize RPC failover system
 * 
 * Reads RPC endpoints from environment variables:
 * - SOLANA_RPC_URL (primary)
 * - SOLANA_RPC_BACKUP_1, SOLANA_RPC_BACKUP_2, etc. (backups)
 * - NEXT_PUBLIC_SOLANA_RPC (fallback primary)
 */
export function initializeRpcSystem(): void {
  // Get primary RPC URL
  const primary =
    process.env['SOLANA_RPC_URL'] ||
    process.env['NEXT_PUBLIC_SOLANA_RPC'] ||
    'https://api.mainnet-beta.solana.com';

  // Get backup RPCs from environment
  const backups: string[] = [];
  
  // Check for numbered backup variables (SOLANA_RPC_BACKUP_1, SOLANA_RPC_BACKUP_2, etc.)
  let backupIndex = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const backupUrl = process.env[`SOLANA_RPC_BACKUP_${backupIndex}`];
    if (!backupUrl) break;
    backups.push(backupUrl);
    backupIndex++;
  }

  // Add common public RPCs as fallbacks if no backups configured
  if (backups.length === 0) {
    backups.push(
      'https://solana-rpc.publicnode.com',
      'https://api.mainnet-beta.solana.com',
      'https://rpc.ankr.com/solana'
    );
  }

  // Initialize failover manager
  initializeRpcFailover({
    primary,
    backups,
    healthCheckInterval: 30_000, // 30 seconds
    maxFailures: 3,
    healthCheckTimeout: 5_000, // 5 seconds
    commitment: 'confirmed',
  });

  console.log(`✅ RPC Failover initialized:`);
  console.log(`   Primary: ${primary}`);
  console.log(`   Backups: ${backups.join(', ')}`);
}

// Auto-initialize on module load (server-side only)
if (typeof window === 'undefined') {
  initializeRpcSystem();
}

