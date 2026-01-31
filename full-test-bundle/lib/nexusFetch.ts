/* ==========================================
   NEXUS FETCH (self-healing network wrapper)
   File: client/src/lib/nexusFetch.ts
   ========================================== */

import { Nexus } from "@/lib/nexus";

type NexusFetchOptions = RequestInit & {
  source?: string;
  tries?: number;
};

export async function nexusFetch(input: RequestInfo | URL, init?: NexusFetchOptions) {
  const source = init?.source || "nexusFetch";
  const tries = init?.tries ?? 3;

  return Nexus.retry(
    async () => {
      const res = await fetch(input, init);

      // Retry on obvious transient failures
      if (!res.ok) {
        // 429/5xx are commonly transient
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
      }

      return res;
    },
    {
      source,
      tries,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      meta: {
        url: typeof input === "string" ? input : String(input),
        method: init?.method || "GET",
      },
      shouldRetry: (err) => {
        const msg = err?.message || "";
        // simple rule: retry on network failures / HTTP thrown errors
        return (
          msg.includes("HTTP 429") ||
          msg.includes("HTTP 5") ||
          msg.toLowerCase().includes("network") ||
          msg.toLowerCase().includes("failed to fetch")
        );
      },
    }
  );
}
