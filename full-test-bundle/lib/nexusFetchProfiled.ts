/* ==========================================
   PROFILED NEXUS FETCH WRAPPER
   File: client/src/lib/nexusFetchProfiled.ts
   
   Use this for Printful mockup calls where
   BULK vs SINGLE retry behavior differs.
   ========================================== */

import { Nexus, NexusProfiles } from "@/lib/nexus";

type NexusProfile = {
  tries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (err: any) => boolean;
};

type Options = RequestInit & {
  source: string;
  profile: NexusProfile;
};

// Status codes that should NOT be retried (hard failures)
const NO_RETRY_STATUS = new Set([400, 401, 403, 404]);

// Error messages that indicate hard failures (no retry)
const NO_RETRY_MESSAGES = [
  "invalid variant",
  "unknown product",
  "not found",
  "unauthorized",
  "forbidden",
  "bad request",
];

function isHardFailure(status: number, body?: string): boolean {
  if (NO_RETRY_STATUS.has(status)) return true;
  if (body) {
    const lower = body.toLowerCase();
    return NO_RETRY_MESSAGES.some(msg => lower.includes(msg));
  }
  return false;
}

export async function nexusFetchProfiled(input: RequestInfo | URL, opts: Options): Promise<Response> {
  const { source, profile, ...init } = opts;

  return Nexus.retry(
    async () => {
      const res = await fetch(input, init);

      // Hard failures: 400/401/403/404 => do NOT throw, return response for caller to handle
      if (!res.ok) {
        if (NO_RETRY_STATUS.has(res.status)) {
          // Return as-is, no retry
          return res;
        }
        
        // Transient failures: 429 + 5xx => throw so retry can happen
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
      }

      return res;
    },
    {
      source,
      tries: profile.tries,
      baseDelayMs: profile.baseDelayMs,
      maxDelayMs: profile.maxDelayMs,
      meta: {
        url: typeof input === "string" ? input : String(input),
        method: init.method || "GET",
      },
      shouldRetry: profile.shouldRetry,
    }
  );
}

/* ==========================================
   BULK JOB LOCK (Prevent double-fire)
   ========================================== */
const bulkJobLock = new Map<string, number>();
const BULK_LOCK_DURATION_MS = 120000; // 2 minutes

export function acquireBulkLock(productId: string): boolean {
  const now = Date.now();
  const last = bulkJobLock.get(productId);
  
  if (last && now - last < BULK_LOCK_DURATION_MS) {
    Nexus.warn("printful:mockups:bulk", "Bulk job blocked - lock active", { productId, lockAge: now - last });
    return false; // Lock still active, abort
  }
  
  bulkJobLock.set(productId, now);
  Nexus.info("printful:mockups:bulk", "Bulk lock acquired", { productId });
  return true;
}

export function releaseBulkLock(productId: string, delayMs = 10000): void {
  setTimeout(() => {
    bulkJobLock.delete(productId);
    Nexus.info("printful:mockups:bulk", "Bulk lock released", { productId });
  }, delayMs);
}

/* ==========================================
   FILL MISSING MOCKUPS (Single calls for partial bulk)
   ========================================== */
const FILL_THROTTLE_MS = 10000; // 10 seconds between fills
const MAX_FILLS_PER_CYCLE = 6;

interface FillResult {
  color: string;
  success: boolean;
  mockupUrl?: string;
  error?: string;
}

export async function fillMissingMockups(
  productId: string,
  missingColors: string[],
  generateSingleFn: (productId: string, color: string) => Promise<{ mockupUrl?: string; error?: string }>
): Promise<FillResult[]> {
  const results: FillResult[] = [];
  const toFill = missingColors.slice(0, MAX_FILLS_PER_CYCLE);
  
  if (missingColors.length > MAX_FILLS_PER_CYCLE) {
    Nexus.warn("printful:mockup:fill-missing", `Capped fill to ${MAX_FILLS_PER_CYCLE}; ${missingColors.length - MAX_FILLS_PER_CYCLE} remain`, { productId });
  }
  
  for (const color of toFill) {
    try {
      Nexus.info("printful:mockup:fill-missing", `Filling missing mockup`, { productId, color });
      const result = await generateSingleFn(productId, color);
      
      results.push({
        color,
        success: !!result.mockupUrl,
        mockupUrl: result.mockupUrl,
        error: result.error,
      });
      
      // Throttle between calls
      if (toFill.indexOf(color) < toFill.length - 1) {
        await new Promise(r => setTimeout(r, FILL_THROTTLE_MS));
      }
    } catch (err: any) {
      Nexus.captureError(err, "printful:mockup:fill-missing", { productId, color });
      results.push({ color, success: false, error: err.message });
    }
  }
  
  return results;
}

/* ==========================================
   CACHE PROTECTION (Never overwrite good URLs)
   ========================================== */
export function mergeMockupMaps(
  existing: Record<string, { front?: string; lifestyle?: string }> | null | undefined,
  incoming: Record<string, { front?: string; lifestyle?: string }> | null | undefined
): Record<string, { front?: string; lifestyle?: string }> {
  const result: Record<string, { front?: string; lifestyle?: string }> = { ...(existing || {}) };
  
  if (!incoming) return result;
  
  for (const [color, mockup] of Object.entries(incoming)) {
    const existingEntry = result[color] || {};
    
    // Only update if incoming has valid URLs; never overwrite with empty/null
    result[color] = {
      front: (mockup.front && mockup.front.length > 0) ? mockup.front : existingEntry.front,
      lifestyle: (mockup.lifestyle && mockup.lifestyle.length > 0) ? mockup.lifestyle : existingEntry.lifestyle,
    };
  }
  
  return result;
}

// Re-export profiles for convenience
export { NexusProfiles };
