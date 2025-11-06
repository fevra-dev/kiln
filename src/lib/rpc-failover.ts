/**
 * RPC Failover Utility
 * 
 * Provides automatic failover to backup RPC endpoints when primary fails.
 * Implements health checks, automatic switching, and retry logic.
 * 
 * Supports multiple RPC providers (Helius, QuickNode, Alchemy, public RPCs).
 * 
 * @version 0.1.1
 */

import { Connection, Commitment } from '@solana/web3.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RpcEndpoint {
  /** RPC URL */
  url: string;
  /** Provider name (for logging) */
  provider: string;
  /** Priority (lower = higher priority, 0 = primary) */
  priority: number;
  /** Whether this endpoint is currently healthy */
  healthy: boolean;
  /** Last health check timestamp */
  lastHealthCheck?: number;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Custom headers for this endpoint */
  headers?: Record<string, string>;
}

export interface RpcFailoverConfig {
  /** Primary RPC endpoint */
  primary: string;
  /** Backup RPC endpoints (optional) */
  backups?: string[];
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
  /** Maximum consecutive failures before marking unhealthy */
  maxFailures?: number;
  /** Health check timeout in milliseconds */
  healthCheckTimeout?: number;
  /** Commitment level for health checks */
  commitment?: Commitment;
}

export interface HealthCheckResult {
  healthy: boolean;
  latency?: number;
  error?: string;
}

// ============================================================================
// RPC FAILOVER MANAGER
// ============================================================================

/**
 * RPC Failover Manager
 * 
 * Manages multiple RPC endpoints with automatic failover and health checks.
 */
export class RpcFailoverManager {
  private endpoints: RpcEndpoint[] = [];
  private currentIndex: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckIntervalMs: number;
  private maxFailures: number;
  private healthCheckTimeout: number;
  private commitment: Commitment;

  constructor(config: RpcFailoverConfig) {
    this.healthCheckIntervalMs = config.healthCheckInterval || 30_000; // 30 seconds
    this.maxFailures = config.maxFailures || 3;
    this.healthCheckTimeout = config.healthCheckTimeout || 5_000; // 5 seconds
    this.commitment = config.commitment || 'confirmed';

    // Initialize endpoints
    this.endpoints.push({
      url: config.primary,
      provider: this.extractProviderName(config.primary),
      priority: 0,
      healthy: true,
      consecutiveFailures: 0,
    });

    // Add backup endpoints
    if (config.backups && config.backups.length > 0) {
      config.backups.forEach((backup, index) => {
        this.endpoints.push({
          url: backup,
          provider: this.extractProviderName(backup),
          priority: index + 1,
          healthy: true,
          consecutiveFailures: 0,
        });
      });
    }

    // Sort by priority
    this.endpoints.sort((a, b) => a.priority - b.priority);

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Extract provider name from URL
   */
  private extractProviderName(url: string): string {
    if (url.includes('helius')) return 'Helius';
    if (url.includes('quicknode')) return 'QuickNode';
    if (url.includes('alchemy')) return 'Alchemy';
    if (url.includes('publicnode')) return 'PublicNode';
    if (url.includes('mainnet-beta.solana.com')) return 'Solana Labs';
    return 'Unknown';
  }

  /**
   * Get current active RPC endpoint
   */
  getCurrentEndpoint(): RpcEndpoint {
    const endpoint = this.endpoints[this.currentIndex];
    if (!endpoint) {
      throw new Error('No RPC endpoints available');
    }
    return endpoint;
  }

  /**
   * Get current RPC URL
   */
  getCurrentUrl(): string {
    const endpoint = this.endpoints[this.currentIndex];
    if (!endpoint) {
      throw new Error('No RPC endpoints available');
    }
    return endpoint.url;
  }

  /**
   * Create a Connection using the current endpoint
   */
  createConnection(): Connection {
    const endpoint = this.getCurrentEndpoint();
    return new Connection(endpoint.url, this.commitment);
  }

  /**
   * Execute a function with automatic failover
   * 
   * @param fn - Function that takes a Connection and returns a result
   * @returns Result from the function
   * @throws Error if all endpoints fail
   */
  async withFailover<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    const triedEndpoints = new Set<number>();
    let lastError: Error | null = null;

    // Try all healthy endpoints, starting with current
    for (let attempt = 0; attempt < this.endpoints.length; attempt++) {
      // Find next healthy endpoint
      let endpointIndex = this.currentIndex;
      for (let i = 0; i < this.endpoints.length; i++) {
        const idx = (this.currentIndex + i) % this.endpoints.length;
        const endpoint = this.endpoints[idx];
        if (endpoint && !triedEndpoints.has(idx) && endpoint.healthy) {
          endpointIndex = idx;
          break;
        }
      }

      // If we've tried all endpoints, break
      if (triedEndpoints.has(endpointIndex)) {
        break;
      }

      triedEndpoints.add(endpointIndex);
      this.currentIndex = endpointIndex;
      const endpoint = this.endpoints[endpointIndex];

      if (!endpoint) {
        throw new Error('No RPC endpoints available');
      }

      try {
        console.log(`🔄 RPC Failover: Using ${endpoint.provider} (${endpoint.url})`);
        const connection = new Connection(endpoint.url, this.commitment);
        const result = await fn(connection);

        // Success - reset failure count
        if (endpoint.consecutiveFailures > 0) {
          endpoint.consecutiveFailures = 0;
          endpoint.healthy = true;
          console.log(`✅ RPC Failover: ${endpoint.provider} recovered`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ RPC Failover: ${endpoint.provider} failed:`, lastError.message);

        // Increment failure count
        endpoint.consecutiveFailures++;
        endpoint.lastHealthCheck = Date.now();

        // Mark unhealthy if too many failures
        if (endpoint.consecutiveFailures >= this.maxFailures) {
          endpoint.healthy = false;
          console.warn(`⚠️ RPC Failover: ${endpoint.provider} marked unhealthy (${endpoint.consecutiveFailures} failures)`);
        }
      }
    }

    // All endpoints failed
    throw new Error(
      `All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Perform health check on an endpoint
   */
  private async checkEndpointHealth(endpoint: RpcEndpoint): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const connection = new Connection(endpoint.url, this.commitment);

      // Use a simple RPC call to check health (getSlot is lightweight)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.healthCheckTimeout);

      try {
        await connection.getSlot(this.commitment);
        clearTimeout(timeoutId);

        const latency = Date.now() - startTime;

        // Mark as healthy if it was previously unhealthy
        if (!endpoint.healthy && endpoint.consecutiveFailures > 0) {
          endpoint.healthy = true;
          endpoint.consecutiveFailures = 0;
          console.log(`✅ RPC Failover: ${endpoint.provider} recovered (${latency}ms)`);
        }

        endpoint.lastHealthCheck = Date.now();

        return {
          healthy: true,
          latency,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Increment failure count
      endpoint.consecutiveFailures++;
      endpoint.lastHealthCheck = Date.now();

      // Mark unhealthy if too many failures
      if (endpoint.consecutiveFailures >= this.maxFailures) {
        endpoint.healthy = false;
        console.warn(
          `⚠️ RPC Failover: ${endpoint.provider} marked unhealthy (${endpoint.consecutiveFailures} failures)`
        );
      }

      return {
        healthy: false,
        latency,
        error: errorMessage,
      };
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      return; // Already running
    }

    // Perform initial health check
    this.performHealthChecks();

    // Set up interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Perform health checks on all endpoints
   */
  private async performHealthChecks(): Promise<void> {
    console.log(`🔍 RPC Failover: Performing health checks on ${this.endpoints.length} endpoints...`);

    const checks = this.endpoints.map((endpoint) => this.checkEndpointHealth(endpoint));
    const results = await Promise.allSettled(checks);

    results.forEach((result, index) => {
      const endpoint = this.endpoints[index];
      if (result.status === 'fulfilled') {
        const healthResult = result.value;
        if (endpoint && !healthResult.healthy && endpoint.healthy) {
          console.warn(`⚠️ RPC Failover: ${endpoint.provider} health check failed`);
        }
      }
    });

    // Update current index to first healthy endpoint
    const healthyIndex = this.endpoints.findIndex((e) => e.healthy);
    if (healthyIndex !== -1 && healthyIndex !== this.currentIndex) {
      const healthyEndpoint = this.endpoints[healthyIndex];
      if (healthyEndpoint) {
        console.log(
          `🔄 RPC Failover: Switching to ${healthyEndpoint.provider} (primary healthy)`
        );
        this.currentIndex = healthyIndex;
      }
    }
  }

  /**
   * Get status of all endpoints
   */
  getStatus(): {
    current: RpcEndpoint;
    endpoints: Array<{
      url: string;
      provider: string;
      healthy: boolean;
      consecutiveFailures: number;
      lastHealthCheck?: number;
    }>;
  } {
    const currentEndpoint = this.endpoints[this.currentIndex];
    if (!currentEndpoint) {
      throw new Error('No RPC endpoints available');
    }
    return {
      current: currentEndpoint,
      endpoints: this.endpoints.map((e) => ({
        url: e.url,
        provider: e.provider,
        healthy: e.healthy,
        consecutiveFailures: e.consecutiveFailures,
        lastHealthCheck: e.lastHealthCheck,
      })),
    };
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalRpcManager: RpcFailoverManager | null = null;

/**
 * Initialize global RPC failover manager
 * 
 * @param config - RPC failover configuration
 */
export function initializeRpcFailover(config: RpcFailoverConfig): RpcFailoverManager {
  if (globalRpcManager) {
    globalRpcManager.stop();
  }

  globalRpcManager = new RpcFailoverManager(config);
  return globalRpcManager;
}

/**
 * Get global RPC failover manager
 * 
 * @returns Global RPC manager instance
 */
export function getRpcManager(): RpcFailoverManager | null {
  return globalRpcManager;
}

/**
 * Get RPC URL with automatic failover
 * 
 * @returns Current RPC URL
 */
export function getRpcUrl(): string {
  if (globalRpcManager) {
    return globalRpcManager.getCurrentUrl();
  }

  // Fallback to environment variable
  return (
    process.env['NEXT_PUBLIC_SOLANA_RPC'] ||
    process.env['SOLANA_RPC_URL'] ||
    'https://api.mainnet-beta.solana.com'
  );
}

/**
 * Create Connection with automatic failover
 * 
 * @returns Connection instance
 */
export function createConnectionWithFailover(): Connection {
  if (globalRpcManager) {
    return globalRpcManager.createConnection();
  }

  // Fallback to standard connection
  const rpcUrl = getRpcUrl();
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Execute function with automatic RPC failover
 * 
 * @param fn - Function that takes a Connection and returns a result
 * @returns Result from the function
 */
export async function withRpcFailover<T>(
  fn: (connection: Connection) => Promise<T>
): Promise<T> {
  if (globalRpcManager) {
    return globalRpcManager.withFailover(fn);
  }

  // Fallback: use standard connection
  const connection = createConnectionWithFailover();
  return fn(connection);
}

