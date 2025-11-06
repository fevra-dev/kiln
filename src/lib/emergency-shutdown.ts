/**
 * Emergency Shutdown Utility
 * 
 * Allows instant shutdown of API endpoints without redeploying.
 * Set EMERGENCY_SHUTDOWN=true environment variable to enable.
 * 
 * @version 0.1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from './cors';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Check if emergency shutdown is enabled
 * Reads from environment variable
 */
export function isEmergencyShutdownEnabled(): boolean {
  return process.env.EMERGENCY_SHUTDOWN === 'true';
}

/**
 * Get emergency shutdown message
 * Can be customized via environment variable
 */
export function getEmergencyShutdownMessage(): string {
  return (
    process.env.EMERGENCY_SHUTDOWN_MESSAGE ||
    '🚨 Teleburn is temporarily offline for maintenance. Please try again later. No assets are at risk.'
  );
}

// ============================================================================
// MIDDLEWARE FUNCTION
// ============================================================================

/**
 * Check if emergency shutdown is active and return error response if so
 * 
 * @param request - Next.js request object
 * @returns Error response if shutdown is active, null otherwise
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   // Check emergency shutdown first
 *   const shutdownResponse = checkEmergencyShutdown(request);
 *   if (shutdownResponse) return shutdownResponse;
 *   
 *   // Normal request handling
 *   // ...
 * }
 * ```
 */
export function checkEmergencyShutdown(
  request: NextRequest
): NextResponse | null {
  if (!isEmergencyShutdownEnabled()) {
    return null; // Shutdown not active, proceed normally
  }

  // Get CORS headers for the response
  const corsHeaders = getCorsHeaders(request);
  const retryAfter = process.env.EMERGENCY_SHUTDOWN_RETRY_AFTER || '300'; // Default 5 minutes

  // Return 503 Service Unavailable
  return NextResponse.json(
    {
      success: false,
      error: getEmergencyShutdownMessage(),
      code: 'EMERGENCY_SHUTDOWN',
      timestamp: new Date().toISOString(),
    },
    {
      status: 503, // Service Unavailable
      headers: {
        'Retry-After': retryAfter,
        'X-Emergency-Shutdown': 'true',
        ...corsHeaders,
      },
    }
  );
}

/**
 * Check emergency shutdown and throw error if active
 * Alternative API that throws instead of returning response
 * 
 * @throws Error if emergency shutdown is active
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   // Check emergency shutdown (throws if active)
 *   assertNotEmergencyShutdown();
 *   
 *   // Normal request handling
 *   // ...
 * }
 * ```
 */
export function assertNotEmergencyShutdown(): void {
  if (isEmergencyShutdownEnabled()) {
    throw new Error(getEmergencyShutdownMessage());
  }
}

/**
 * Get emergency shutdown status for health checks
 * 
 * @returns Status information about emergency shutdown
 */
export function getEmergencyShutdownStatus(): {
  enabled: boolean;
  message: string;
  timestamp: string;
} {
  return {
    enabled: isEmergencyShutdownEnabled(),
    message: getEmergencyShutdownMessage(),
    timestamp: new Date().toISOString(),
  };
}

