"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderHealthMonitor = exports.DefaultHealthConfig = void 0;
exports.createProviderHealthMonitor = createProviderHealthMonitor;
const utils_1 = require("../utils");
exports.DefaultHealthConfig = {
    windowSize: 50,
    degradedThresholdPercent: 20,
    unhealthyThresholdPercent: 50,
    consecutiveFailuresDegraded: 3,
    consecutiveFailuresUnhealthy: 6,
    healthyRecoveryChecks: 3,
    checkIntervalMs: 60000, // 1 minute
};
// ============================================================================
// PROVIDER HEALTH MONITOR
// ============================================================================
class ProviderHealthMonitor {
    constructor(options = {}) {
        // In-memory tracking when no store provided
        this.recentOutcomes = new Map();
        this.consecutiveFailures = new Map();
        this.currentStates = new Map();
        this.successfulRecoveryChecks = new Map();
        this.config = options.config || exports.DefaultHealthConfig;
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
    async recordOutcome(providerName, outcome) {
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
        }
        else {
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
            }
            else if (newState === "UNHEALTHY") {
                this.logger.error("provider_unhealthy_paused", {
                    providerName,
                    previousState,
                    ...this.getMetrics(providerName),
                });
            }
            else if (newState === "HEALTHY" && previousState !== "HEALTHY") {
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
    calculateState(providerName) {
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
        if (currentState === "UNHEALTHY")
            return "UNHEALTHY";
        if (currentState === "DEGRADED")
            return "DEGRADED";
        return "HEALTHY";
    }
    /**
     * Calculate failure rate from outcomes.
     */
    calculateFailureRate(outcomes) {
        if (outcomes.length === 0)
            return 0;
        const failures = outcomes.filter((o) => !o.success).length;
        return (failures / outcomes.length) * 100;
    }
    /**
     * Get current metrics for a provider.
     */
    getMetrics(providerName) {
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
    buildScore(providerName, state) {
        const metrics = this.getMetrics(providerName);
        return {
            providerName,
            state,
            failureRate: metrics.failureRate,
            consecutiveFailures: metrics.consecutiveFailures,
            lastCheckAt: (0, utils_1.nowISO)(),
            windowSize: this.config.windowSize,
            recentAttempts: metrics.recentAttempts,
            recentFailures: metrics.recentFailures,
        };
    }
    /**
     * Get current health state for a provider.
     */
    getState(providerName) {
        return this.currentStates.get(providerName) || "HEALTHY";
    }
    /**
     * Get full health score for a provider.
     */
    getScore(providerName) {
        const state = this.getState(providerName);
        return this.buildScore(providerName, state);
    }
    /**
     * Check if sending should be paused.
     */
    isPaused(providerName) {
        return this.getState(providerName) === "UNHEALTHY";
    }
    /**
     * Get recommended concurrency for current state.
     */
    getConcurrency(providerName, healthyConcurrency = 5, degradedConcurrency = 2) {
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
    forceState(providerName, state) {
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
    reset(providerName) {
        this.recentOutcomes.delete(providerName);
        this.consecutiveFailures.delete(providerName);
        this.currentStates.delete(providerName);
        this.successfulRecoveryChecks.delete(providerName);
        this.logger.info("health_tracking_reset", { providerName });
    }
}
exports.ProviderHealthMonitor = ProviderHealthMonitor;
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
function createProviderHealthMonitor(options) {
    return new ProviderHealthMonitor(options);
}
//# sourceMappingURL=ProviderHealth.js.map