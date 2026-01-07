/**
 * NEXUSMAIL PROVIDER HEALTH
 * 
 * Tracks provider health using recent send outcomes.
 * Implements automatic pause/resume based on failure rates.
 * 
 * Health States:
 * - HEALTHY: Normal operation
 * - DEGRADED: Reduced concurrency, increased logging
 * - UNHEALTHY: Automatically paused
 */

import {
  ProviderHealthState,
  ProviderHealthScore,
  NexusMailSendState,
} from "../types";
import { nowISO } from "../utils";

// ============================================================================
// HEALTH CONFIGURATION
// ============================================================================

export interface HealthConfig {
  windowSize: number; // Number of attempts to track
  degradedThresholdPercent: number; // Failure rate to enter DEGRADED
  unhealthyThresholdPercent: number; // Failure rate to enter UNHEALTHY
  consecutiveFailuresDegraded: number; // Consecutive failures for DEGRADED
  consecutiveFailuresUnhealthy: number; // Consecutive failures for UNHEALTHY
  healthyRecoveryChecks: number; // Successful checks to return to HEALTHY
  checkIntervalMs: number; // How often to re-check health
}

export const DefaultHealthConfig: HealthConfig = {
  windowSize: 50,
  degradedThresholdPercent: 20,
  unhealthyThresholdPercent: 50,
  consecutiveFailuresDegraded: 3,
  consecutiveFailuresUnhealthy: 6,
  healthyRecoveryChecks: 3,
  checkIntervalMs: 60000, // 1 minute
};

// ============================================================================
// HEALTH STORE INTERFACE
// ============================================================================

/**
 * Interface for health state storage.
 */
export interface HealthStore {
  getScore(providerName: string): Promise<ProviderHealthScore | null>;
  saveScore(score: ProviderHealthScore): Promise<void>;
  getSendState(siteId: string): Promise<NexusMailSendState | null>;
  saveSendState(state: NexusMailSendState): Promise<void>;
}

// ============================================================================
// SEND OUTCOME
// ============================================================================

export interface SendOutcome {
  success: boolean;
  retryable: boolean;
  errorCode?: string;
  timestamp: string;
}

// ============================================================================
// PROVIDER HEALTH MONITOR
// ============================================================================

export class ProviderHealthMonitor {
  private config: HealthConfig;
  private store?: HealthStore;
  private logger: HealthLogger;
  
  // In-memory tracking when no store provided
  private recentOutcomes: Map<string, SendOutcome[]> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private currentStates: Map<string, ProviderHealthState> = new Map();
  private successfulRecoveryChecks: Map<string, number> = new Map();

  constructor(options: {
    config?: HealthConfig;
    store?: HealthStore;
    logger?: HealthLogger;
  } = {}) {
    this.config = options.config || DefaultHealthConfig;
    this.store = options.store;
    this.logger = options.logger || {
      info: (e, d) => console.log(`[ProviderHealth:INFO] ${e}`, d),
      warn: (e, d) => console.warn(`[ProviderHealth:WARN] ${e}`, d),
      error: (e, d) => console.error(`[ProviderHealth:ERROR] ${e}`, d),
    };
  }

  /**
   * Record a send outcome and update health state.
   */
  async recordOutcome(
    providerName: string,
    outcome: SendOutcome
  ): Promise<ProviderHealthState> {
    // Get or initialize outcomes list
    let outcomes = this.recentOutcomes.get(providerName) || [];
    outcomes.push(outcome);
    
    // Trim to window size
    if (outcomes.length > this.config.windowSize) {
      outcomes = outcomes.slice(-this.config.windowSize);
    }
    this.recentOutcomes.set(providerName, outcomes);

    // Update consecutive failures
    if (outcome.success) {
      this.consecutiveFailures.set(providerName, 0);
      
      // Track recovery
      const currentState = this.currentStates.get(providerName) || "HEALTHY";
      if (currentState !== "HEALTHY") {
        const recoveryChecks = (this.successfulRecoveryChecks.get(providerName) || 0) + 1;
        this.successfulRecoveryChecks.set(providerName, recoveryChecks);
      }
    } else {
      const failures = (this.consecutiveFailures.get(providerName) || 0) + 1;
      this.consecutiveFailures.set(providerName, failures);
      this.successfulRecoveryChecks.set(providerName, 0);
    }

    // Calculate new state
    const newState = this.calculateState(providerName);
    const previousState = this.currentStates.get(providerName) || "HEALTHY";
    this.currentStates.set(providerName, newState);

    // Log state changes
    if (newState !== previousState) {
      if (newState === "DEGRADED") {
        this.logger.warn("provider_degraded", {
          providerName,
          previousState,
          ...this.getMetrics(providerName),
        });
      } else if (newState === "UNHEALTHY") {
        this.logger.error("provider_unhealthy_paused", {
          providerName,
          previousState,
          ...this.getMetrics(providerName),
        });
      } else if (newState === "HEALTHY" && previousState !== "HEALTHY") {
        this.logger.info("provider_recovered", {
          providerName,
          previousState,
          ...this.getMetrics(providerName),
        });
      }
    }

    // Persist to store if available
    if (this.store) {
      await this.store.saveScore(this.buildScore(providerName, newState));
    }

    return newState;
  }

  /**
   * Calculate current health state based on metrics.
   */
  private calculateState(providerName: string): ProviderHealthState {
    const outcomes = this.recentOutcomes.get(providerName) || [];
    const consecutive = this.consecutiveFailures.get(providerName) || 0;
    const recoveryChecks = this.successfulRecoveryChecks.get(providerName) || 0;
    const currentState = this.currentStates.get(providerName) || "HEALTHY";

    // Check for UNHEALTHY conditions
    if (consecutive >= this.config.consecutiveFailuresUnhealthy) {
      return "UNHEALTHY";
    }

    if (outcomes.length >= 10) {
      const failureRate = this.calculateFailureRate(outcomes);
      if (failureRate >= this.config.unhealthyThresholdPercent) {
        return "UNHEALTHY";
      }
    }

    // Check for recovery from UNHEALTHY/DEGRADED
    if (currentState !== "HEALTHY") {
      if (recoveryChecks >= this.config.healthyRecoveryChecks) {
        this.successfulRecoveryChecks.set(providerName, 0);
        return "HEALTHY";
      }
    }

    // Check for DEGRADED conditions
    if (consecutive >= this.config.consecutiveFailuresDegraded) {
      return "DEGRADED";
    }

    if (outcomes.length >= 10) {
      const failureRate = this.calculateFailureRate(outcomes);
      if (failureRate >= this.config.degradedThresholdPercent) {
        return "DEGRADED";
      }
    }

    // If currently degraded/unhealthy but not recovered yet, stay in that state
    if (currentState === "UNHEALTHY") return "UNHEALTHY";
    if (currentState === "DEGRADED") return "DEGRADED";

    return "HEALTHY";
  }

  /**
   * Calculate failure rate from outcomes.
   */
  private calculateFailureRate(outcomes: SendOutcome[]): number {
    if (outcomes.length === 0) return 0;
    const failures = outcomes.filter((o) => !o.success).length;
    return (failures / outcomes.length) * 100;
  }

  /**
   * Get current metrics for a provider.
   */
  private getMetrics(providerName: string): {
    failureRate: number;
    consecutiveFailures: number;
    recentAttempts: number;
    recentFailures: number;
  } {
    const outcomes = this.recentOutcomes.get(providerName) || [];
    const failures = outcomes.filter((o) => !o.success);
    return {
      failureRate: this.calculateFailureRate(outcomes),
      consecutiveFailures: this.consecutiveFailures.get(providerName) || 0,
      recentAttempts: outcomes.length,
      recentFailures: failures.length,
    };
  }

  /**
   * Build a ProviderHealthScore object.
   */
  private buildScore(
    providerName: string,
    state: ProviderHealthState
  ): ProviderHealthScore {
    const metrics = this.getMetrics(providerName);
    return {
      providerName,
      state,
      failureRate: metrics.failureRate,
      consecutiveFailures: metrics.consecutiveFailures,
      lastCheckAt: nowISO(),
      windowSize: this.config.windowSize,
      recentAttempts: metrics.recentAttempts,
      recentFailures: metrics.recentFailures,
    };
  }

  /**
   * Get current health state for a provider.
   */
  getState(providerName: string): ProviderHealthState {
    return this.currentStates.get(providerName) || "HEALTHY";
  }

  /**
   * Get full health score for a provider.
   */
  getScore(providerName: string): ProviderHealthScore {
    const state = this.getState(providerName);
    return this.buildScore(providerName, state);
  }

  /**
   * Check if sending should be paused.
   */
  isPaused(providerName: string): boolean {
    return this.getState(providerName) === "UNHEALTHY";
  }

  /**
   * Get recommended concurrency for current state.
   */
  getConcurrency(
    providerName: string,
    healthyConcurrency: number = 5,
    degradedConcurrency: number = 2
  ): number {
    const state = this.getState(providerName);
    switch (state) {
      case "HEALTHY":
        return healthyConcurrency;
      case "DEGRADED":
        return degradedConcurrency;
      case "UNHEALTHY":
        return 0;
    }
  }

  /**
   * Force a health state (admin override).
   */
  forceState(providerName: string, state: ProviderHealthState): void {
    this.currentStates.set(providerName, state);
    if (state === "HEALTHY") {
      this.consecutiveFailures.set(providerName, 0);
      this.successfulRecoveryChecks.set(providerName, 0);
    }
    this.logger.info("health_state_forced", { providerName, state });
  }

  /**
   * Reset all tracking for a provider.
   */
  reset(providerName: string): void {
    this.recentOutcomes.delete(providerName);
    this.consecutiveFailures.delete(providerName);
    this.currentStates.delete(providerName);
    this.successfulRecoveryChecks.delete(providerName);
    this.logger.info("health_tracking_reset", { providerName });
  }
}

// ============================================================================
// LOGGER INTERFACE
// ============================================================================

export interface HealthLogger {
  info(event: string, data: Record<string, any>): void;
  warn(event: string, data: Record<string, any>): void;
  error(event: string, data: Record<string, any>): void;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createProviderHealthMonitor(options?: {
  config?: HealthConfig;
  store?: HealthStore;
  logger?: HealthLogger;
}): ProviderHealthMonitor {
  return new ProviderHealthMonitor(options);
}
