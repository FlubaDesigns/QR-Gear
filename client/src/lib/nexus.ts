/* ==========================================
   NEXUS SELF-HEALING CORE (QR GEAR)
   File: client/src/lib/nexus.ts
   ========================================== */

export type NexusEventType = "ERROR" | "WARNING" | "RECOVERY" | "INFO";

export type NexusEvent = {
  type: NexusEventType;
  source: string;
  message: string;
  timestamp: number;
  stack?: string;
  meta?: Record<string, any>;
};

class NexusCore {
  private memory: NexusEvent[] = [];
  private MAX_MEMORY = 200;

  log(event: NexusEvent) {
    this.memory.push(event);
    if (this.memory.length > this.MAX_MEMORY) this.memory.shift();

    const tag = `NEXUS ${event.type}`;
    const style =
      event.type === "ERROR"
        ? "color:#ff4d4d;font-weight:bold"
        : event.type === "WARNING"
        ? "color:#ffb020;font-weight:bold"
        : event.type === "RECOVERY"
        ? "color:#4dff88;font-weight:bold"
        : "color:#6fb7ff;font-weight:bold";

    // Console output (dev visibility)
    console.groupCollapsed(`%c${tag}`, style);
    console.log(event);
    console.groupEnd();
  }

  info(source: string, message: string, meta?: Record<string, any>) {
    this.log({
      type: "INFO",
      source,
      message,
      meta,
      timestamp: Date.now(),
    });
  }

  warn(source: string, message: string, meta?: Record<string, any>) {
    this.log({
      type: "WARNING",
      source,
      message,
      meta,
      timestamp: Date.now(),
    });
  }

  captureError(error: any, source = "unknown", meta?: Record<string, any>) {
    this.log({
      type: "ERROR",
      source,
      message: error?.message || String(error) || "Unknown error",
      stack: error?.stack,
      meta,
      timestamp: Date.now(),
    });
  }

  /**
   * Attempts a recovery action. If it fails, logs error.
   * Use this as the primitive "self-heal" wrapper.
   */
  attemptRecovery(action: () => void, source: string, meta?: Record<string, any>) {
    try {
      action();
      this.log({
        type: "RECOVERY",
        source,
        message: "Recovery attempt successful",
        meta,
        timestamp: Date.now(),
      });
    } catch (e) {
      this.captureError(e, `${source}::recovery`, meta);
    }
  }

  /**
   * Wrap async calls with retries and backoff.
   * This is the money function for unstable network calls.
   */
  async retry<T>(
    fn: () => Promise<T>,
    options: {
      source: string;
      tries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
      meta?: Record<string, any>;
      shouldRetry?: (err: any) => boolean;
    }
  ): Promise<T> {
    const tries = options.tries ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 400;
    const maxDelayMs = options.maxDelayMs ?? 4000;

    let lastErr: any;

    for (let attempt = 1; attempt <= tries; attempt++) {
      try {
        if (attempt > 1) {
          this.warn(options.source, `Retry attempt ${attempt}/${tries}`, options.meta);
        }
        const result = await fn();
        if (attempt > 1) {
          this.log({
            type: "RECOVERY",
            source: options.source,
            message: `Recovered on attempt ${attempt}/${tries}`,
            meta: options.meta,
            timestamp: Date.now(),
          });
        }
        return result;
      } catch (err: any) {
        lastErr = err;

        const retryAllowed = options.shouldRetry ? options.shouldRetry(err) : true;

        this.captureError(err, options.source, {
          ...(options.meta || {}),
          attempt,
          tries,
          retryAllowed,
        });

        if (!retryAllowed || attempt === tries) break;

        const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastErr;
  }

  getMemory() {
    return [...this.memory];
  }
}

export const Nexus = new NexusCore();

/* ==========================================
   Global safety nets
   ========================================== */

if (typeof window !== "undefined") {
  window.addEventListener("error", (e: any) => {
    Nexus.captureError(e?.error || e, "window.onerror");
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    Nexus.captureError(e.reason, "window.unhandledrejection");
  });
}
