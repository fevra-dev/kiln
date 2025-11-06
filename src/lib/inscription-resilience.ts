/**
 * Inscription Resilience Layer
 * 
 * Provides multiple data sources, caching, and failover for inscription fetching.
 * Handles ordinals.com downtime and API failures gracefully.
 * 
 * @version 0.1.1
 */

// InscriptionVerifier not used in this file - removed to fix lint error

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Cache TTL in milliseconds (1 hour) */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Timeout for each API attempt (10 seconds) */
const API_TIMEOUT_MS = 10_000;

/** Maximum content size to fetch (100MB) */
const MAX_CONTENT_SIZE = 100 * 1024 * 1024;

// ============================================================================
// TYPES
// ============================================================================

export interface InscriptionCacheEntry {
  /** Cached content */
  content: ArrayBuffer;
  /** Content type */
  contentType: string;
  /** SHA-256 hash of content */
  sha256: string;
  /** Timestamp when cached */
  cachedAt: number;
  /** Source API that provided this data */
  source: string;
}

export interface InscriptionSource {
  /** Source name */
  name: string;
  /** Base URL */
  baseUrl: string;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Whether this source is currently healthy */
  healthy: boolean;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Last health check timestamp */
  lastHealthCheck?: number;
}

// ============================================================================
// INSCRIPTION SOURCES
// ============================================================================

/**
 * Available inscription data sources
 * Ordered by priority (lower priority = tried first)
 */
const INSCRIPTION_SOURCES: InscriptionSource[] = [
  {
    name: 'ordinals.com',
    baseUrl: process.env['ORDINALS_API_URL'] || 'https://ordinals.com',
    priority: 0,
    healthy: true,
    consecutiveFailures: 0,
  },
  {
    name: 'ordinals.com (mirror)',
    baseUrl: 'https://ordinals.com',
    priority: 1,
    healthy: true,
    consecutiveFailures: 0,
  },
  // Note: Additional sources can be added here as they become available
  // Examples:
  // - hiro.so ordinals API
  // - ordinalsbot.com API
  // - Custom indexing services
];

// ============================================================================
// CACHE
// ============================================================================

/**
 * In-memory cache for inscription content
 * Key: inscriptionId
 * Value: Cached entry with content and metadata
 */
const inscriptionCache = new Map<string, InscriptionCacheEntry>();

/**
 * Cleanup interval to remove expired cache entries
 */
let cacheCleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start cache cleanup interval
 */
function startCacheCleanup(): void {
  if (cacheCleanupInterval) return;

  cacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of inscriptionCache.entries()) {
      if (now - entry.cachedAt > CACHE_TTL_MS) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      inscriptionCache.delete(key);
    }

    if (inscriptionCache.size === 0 && cacheCleanupInterval) {
      clearInterval(cacheCleanupInterval);
      cacheCleanupInterval = null;
    }
  }, CACHE_TTL_MS); // Cleanup every hour
}

/**
 * Get cached inscription content if available and not expired
 */
function getCachedContent(inscriptionId: string): InscriptionCacheEntry | null {
  const entry = inscriptionCache.get(inscriptionId);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.cachedAt > CACHE_TTL_MS) {
    // Expired, remove from cache
    inscriptionCache.delete(inscriptionId);
    return null;
  }

  return entry;
}

/**
 * Cache inscription content
 */
function setCachedContent(
  inscriptionId: string,
  content: ArrayBuffer,
  contentType: string,
  sha256: string,
  source: string
): void {
  inscriptionCache.set(inscriptionId, {
    content,
    contentType,
    sha256,
    cachedAt: Date.now(),
    source,
  });

  startCacheCleanup();
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch inscription content from a single source
 */
async function fetchFromSource(
  source: InscriptionSource,
  inscriptionId: string
): Promise<
  | { success: true; content: ArrayBuffer; contentType: string }
  | { success: false; error: string }
> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const url = `${source.baseUrl}/content/${inscriptionId}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
          'User-Agent': 'KILN.1-Verifier/0.1.1',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
        return {
          success: false,
          error: `Content too large (${contentLength} bytes)`,
        };
      }

      const content = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      // Mark source as healthy
      source.healthy = true;
      source.consecutiveFailures = 0;
      source.lastHealthCheck = Date.now();

      return {
        success: true,
        content,
        contentType,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Mark source as potentially unhealthy
      source.consecutiveFailures++;
      source.lastHealthCheck = Date.now();

      if (source.consecutiveFailures >= 3) {
        source.healthy = false;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: `Timeout after ${API_TIMEOUT_MS / 1000}s`,
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: 'Unknown error',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch inscription content with failover across multiple sources
 */
export async function fetchInscriptionWithFailover(
  inscriptionId: string
): Promise<
  | { success: true; content: ArrayBuffer; contentType: string; source: string }
  | { success: false; error: string }
> {
  // Check cache first
  const cached = getCachedContent(inscriptionId);
  if (cached) {
    console.log(`✅ Using cached inscription content for ${inscriptionId} (source: ${cached.source})`);
    return {
      success: true,
      content: cached.content,
      contentType: cached.contentType,
      source: `cache (original: ${cached.source})`,
    };
  }

  // Sort sources by priority (healthy sources first, then by priority)
  const sortedSources = [...INSCRIPTION_SOURCES].sort((a, b) => {
    if (a.healthy !== b.healthy) {
      return a.healthy ? -1 : 1; // Healthy sources first
    }
    return a.priority - b.priority;
  });

  // Try each source in order
  for (const source of sortedSources) {
    console.log(`🔍 Fetching inscription from ${source.name}...`);
    const result = await fetchFromSource(source, inscriptionId);

    if (result.success) {
      // Compute SHA-256 for caching
      const sha256 = await computeSha256(result.content);

      // Cache the result
      setCachedContent(inscriptionId, result.content, result.contentType, sha256, source.name);

      console.log(`✅ Successfully fetched from ${source.name}`);
      return {
        success: true,
        content: result.content,
        contentType: result.contentType,
        source: source.name,
      };
    } else {
      console.warn(`⚠️ ${source.name} failed: ${result.error}`);
      // Continue to next source
    }
  }

  // All sources failed
  return {
    success: false,
    error: `All inscription data sources failed. Tried: ${sortedSources.map((s) => s.name).join(', ')}`,
  };
}

/**
 * Compute SHA-256 hash
 */
async function computeSha256(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get cached inscription SHA-256 hash
 */
export function getCachedSha256(inscriptionId: string): string | null {
  const cached = getCachedContent(inscriptionId);
  return cached ? cached.sha256 : null;
}

/**
 * Clear cache for a specific inscription
 */
export function clearInscriptionCache(inscriptionId: string): void {
  inscriptionCache.delete(inscriptionId);
}

/**
 * Clear all inscription cache
 */
export function clearAllInscriptionCache(): void {
  inscriptionCache.clear();
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    cacheCleanupInterval = null;
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  entries: number;
  sources: Array<{ name: string; healthy: boolean; failures: number }>;
} {
  return {
    entries: inscriptionCache.size,
    sources: INSCRIPTION_SOURCES.map((s) => ({
      name: s.name,
      healthy: s.healthy,
      failures: s.consecutiveFailures,
    })),
  };
}

/**
 * Health check all inscription sources
 */
export async function healthCheckSources(): Promise<Array<{
  name: string;
  healthy: boolean;
  latency?: number;
  error?: string;
}>> {
  const results = await Promise.allSettled(
    INSCRIPTION_SOURCES.map(async (source) => {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(`${source.baseUrl}/`, {
            method: 'HEAD',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const latency = Date.now() - startTime;

          const healthy = response.ok;
          source.healthy = healthy;
          source.lastHealthCheck = Date.now();

          if (healthy) {
            source.consecutiveFailures = 0;
          }

          return {
            name: source.name,
            healthy,
            latency,
          };
        } catch {
          clearTimeout(timeoutId);
          throw new Error('Request failed');
        }
      } catch (error) {
        source.consecutiveFailures++;
        source.healthy = false;
        source.lastHealthCheck = Date.now();

        return {
          name: source.name,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return results.map((result) =>
    result.status === 'fulfilled' ? result.value : { name: 'unknown', healthy: false }
  );
}

