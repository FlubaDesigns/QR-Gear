/**
 * Auto-Routing Service for QR Gear POD Orchestration
 * 
 * Routes orders to the optimal print provider (production facility) for a given
 * product blueprint. Currently optimized for Printify's network of print providers.
 * 
 * Routing factors:
 * - Production costs (from Printify catalog sync)
 * - Provider location (USA preference for faster domestic shipping)
 * - Provider health (Printify API availability)
 * - Priority mode: cost, speed, or balanced
 * 
 * Note: This routes between Printify's production facilities (e.g., Monster Digital,
 * SwiftPOD, The Print Bar). Multi-POD-platform routing (Printify vs Printful vs Apliiq)
 * is handled at the adapter level when those integrations have cost data.
 */

import { storage } from "../storage";
import { healthMonitor } from "./health-monitor";

export interface RoutingCriteria {
  blueprintId: number;
  prioritize: "cost" | "speed" | "balanced";
  requireUSA?: boolean;
  maxCostCents?: number;
  excludeProviders?: number[];
}

export interface ProviderScore {
  providerId: number;
  providerName: string;
  blueprintId: number;
  costCents: number | null;
  isUSA: boolean;
  isHealthy: boolean;
  healthScore: number; // 0-100
  responseTimeMs: number | null;
  combinedScore: number;
  reason: string;
}

export interface RoutingResult {
  success: boolean;
  selectedProvider: ProviderScore | null;
  alternativeProviders: ProviderScore[];
  reason: string;
  timestamp: Date;
}

export interface RoutingStats {
  totalRoutings: number;
  byProvider: Record<string, number>;
  avgSelectedCost: number; // Average cost of selected providers (in dollars)
  routingTimestamp: Date; // Last routing time
}

class AutoRouter {
  private routingHistory: Array<{
    timestamp: Date;
    blueprintId: number;
    selectedProviderId: number;
    costCents: number | null;
    criteria: RoutingCriteria;
  }> = [];

  /**
   * Route an order to the optimal provider based on criteria
   */
  async routeOrder(criteria: RoutingCriteria): Promise<RoutingResult> {
    try {
      // Get all providers for this blueprint
      const providers = await storage.getPrintifyPrintProviders(criteria.blueprintId);
      
      if (!providers || providers.length === 0) {
        return {
          success: false,
          selectedProvider: null,
          alternativeProviders: [],
          reason: `No providers found for blueprint ${criteria.blueprintId}`,
          timestamp: new Date()
        };
      }

      // Get health status for all providers
      const healthDashboard = await healthMonitor.getHealthDashboard();
      const providerHealthMap = new Map<string, { uptime: number; avgResponseTime: number }>();
      
      for (const status of healthDashboard.providers) {
        providerHealthMap.set(status.providerType.toLowerCase(), {
          uptime: status.stats24h.uptimePercent,
          avgResponseTime: status.stats24h.avgResponseTime
        });
      }

      // Score each provider
      const scoredProviders: ProviderScore[] = [];

      for (const provider of providers) {
        // Skip excluded providers
        if (criteria.excludeProviders?.includes(provider.providerId)) {
          continue;
        }

        // Skip non-USA if required
        if (criteria.requireUSA && !provider.isUSA) {
          continue;
        }

        // Skip if over max cost
        if (criteria.maxCostCents && provider.minCost && provider.minCost > criteria.maxCostCents) {
          continue;
        }

        // Get health data (use Printify as proxy since most providers come through Printify)
        const printifyHealth = providerHealthMap.get("printify");
        const isHealthy = printifyHealth ? printifyHealth.uptime >= 90 : true;
        const healthScore = printifyHealth ? printifyHealth.uptime : 100;
        const responseTime = printifyHealth ? printifyHealth.avgResponseTime : null;

        // Calculate combined score based on priority
        const combinedScore = this.calculateCombinedScore(
          provider.minCost,
          provider.isUSA ?? false,
          healthScore,
          responseTime,
          criteria.prioritize
        );

        scoredProviders.push({
          providerId: provider.providerId,
          providerName: provider.title,
          blueprintId: criteria.blueprintId,
          costCents: provider.minCost,
          isUSA: provider.isUSA ?? false,
          isHealthy,
          healthScore,
          responseTimeMs: responseTime,
          combinedScore,
          reason: this.getScoreReason(criteria.prioritize, provider.minCost, provider.isUSA ?? false, healthScore)
        });
      }

      if (scoredProviders.length === 0) {
        return {
          success: false,
          selectedProvider: null,
          alternativeProviders: [],
          reason: "No providers meet the specified criteria",
          timestamp: new Date()
        };
      }

      // Sort by combined score (higher is better)
      scoredProviders.sort((a, b) => b.combinedScore - a.combinedScore);

      const selectedProvider = scoredProviders[0];
      const alternativeProviders = scoredProviders.slice(1, 4);

      // Record routing decision
      this.routingHistory.push({
        timestamp: new Date(),
        blueprintId: criteria.blueprintId,
        selectedProviderId: selectedProvider.providerId,
        costCents: selectedProvider.costCents,
        criteria
      });

      // Keep only last 1000 routing decisions
      if (this.routingHistory.length > 1000) {
        this.routingHistory = this.routingHistory.slice(-1000);
      }

      return {
        success: true,
        selectedProvider,
        alternativeProviders,
        reason: `Selected ${selectedProvider.providerName} based on ${criteria.prioritize} priority`,
        timestamp: new Date()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        selectedProvider: null,
        alternativeProviders: [],
        reason: `Routing error: ${message}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Calculate combined score based on priority
   */
  private calculateCombinedScore(
    costCents: number | null,
    isUSA: boolean,
    healthScore: number,
    responseTimeMs: number | null,
    priority: "cost" | "speed" | "balanced"
  ): number {
    let score = 0;

    // Health is always important - providers must be healthy
    const healthWeight = priority === "balanced" ? 0.25 : 0.2;
    score += (healthScore / 100) * 100 * healthWeight;

    // Cost scoring (inverted - lower cost = higher score)
    if (costCents !== null) {
      // Normalize cost: $5 = 100, $50 = 0
      const normalizedCost = Math.max(0, Math.min(100, 100 - ((costCents - 500) / 4500) * 100));
      const costWeight = priority === "cost" ? 0.6 : priority === "speed" ? 0.2 : 0.35;
      score += normalizedCost * costWeight;
    }

    // Speed scoring (USA providers are faster for US customers)
    const speedScore = isUSA ? 100 : 50;
    const speedWeight = priority === "speed" ? 0.5 : priority === "cost" ? 0.1 : 0.25;
    score += speedScore * speedWeight;

    // Response time bonus (faster API = better experience)
    if (responseTimeMs !== null) {
      const rtScore = Math.max(0, Math.min(100, 100 - (responseTimeMs / 50)));
      score += rtScore * 0.1;
    }

    return Math.round(score);
  }

  /**
   * Get human-readable reason for score
   */
  private getScoreReason(
    priority: "cost" | "speed" | "balanced",
    costCents: number | null,
    isUSA: boolean,
    healthScore: number
  ): string {
    const parts: string[] = [];
    
    if (costCents !== null) {
      parts.push(`$${(costCents / 100).toFixed(2)} base cost`);
    }
    
    if (isUSA) {
      parts.push("USA-based (faster shipping)");
    }
    
    parts.push(`${healthScore.toFixed(0)}% uptime`);
    
    return parts.join(", ");
  }

  /**
   * Get cheapest available provider for a blueprint
   */
  async getCheapestProvider(blueprintId: number, requireUSA: boolean = false): Promise<RoutingResult> {
    return this.routeOrder({
      blueprintId,
      prioritize: "cost",
      requireUSA
    });
  }

  /**
   * Get fastest available provider for a blueprint
   */
  async getFastestProvider(blueprintId: number): Promise<RoutingResult> {
    return this.routeOrder({
      blueprintId,
      prioritize: "speed",
      requireUSA: true // USA providers are fastest for US shipping
    });
  }

  /**
   * Get balanced recommendation (cost + speed)
   */
  async getBalancedProvider(blueprintId: number): Promise<RoutingResult> {
    return this.routeOrder({
      blueprintId,
      prioritize: "balanced"
    });
  }

  /**
   * Get routing statistics
   */
  getStats(): RoutingStats {
    if (this.routingHistory.length === 0) {
      return {
        totalRoutings: 0,
        byProvider: {},
        avgSelectedCost: 0,
        routingTimestamp: new Date()
      };
    }

    const byProvider: Record<string, number> = {};
    let totalCost = 0;
    let costCount = 0;

    for (const routing of this.routingHistory) {
      const key = routing.selectedProviderId.toString();
      byProvider[key] = (byProvider[key] || 0) + 1;
      
      if (routing.costCents !== null) {
        totalCost += routing.costCents;
        costCount++;
      }
    }

    const lastRouting = this.routingHistory[this.routingHistory.length - 1];

    return {
      totalRoutings: this.routingHistory.length,
      byProvider,
      avgSelectedCost: costCount > 0 ? totalCost / costCount / 100 : 0,
      routingTimestamp: lastRouting?.timestamp || new Date()
    };
  }

  /**
   * Get recent routing history
   */
  getRecentRoutings(limit: number = 20): Array<{
    timestamp: Date;
    blueprintId: number;
    selectedProviderId: number;
    costCents: number | null;
    criteria: RoutingCriteria;
  }> {
    return this.routingHistory.slice(-limit).reverse();
  }

  /**
   * Find best providers for multiple blueprints (batch routing)
   */
  async routeBatch(
    blueprintIds: number[],
    defaultCriteria: Omit<RoutingCriteria, "blueprintId">
  ): Promise<Map<number, RoutingResult>> {
    const results = new Map<number, RoutingResult>();

    // Process in parallel for efficiency
    await Promise.all(
      blueprintIds.map(async (blueprintId) => {
        const result = await this.routeOrder({
          ...defaultCriteria,
          blueprintId
        });
        results.set(blueprintId, result);
      })
    );

    return results;
  }

  /**
   * Get provider recommendations with explanations
   */
  async getRecommendations(blueprintId: number): Promise<{
    cheapest: RoutingResult;
    fastest: RoutingResult;
    balanced: RoutingResult;
  }> {
    const [cheapest, fastest, balanced] = await Promise.all([
      this.getCheapestProvider(blueprintId),
      this.getFastestProvider(blueprintId),
      this.getBalancedProvider(blueprintId)
    ]);

    return { cheapest, fastest, balanced };
  }
}

// Singleton instance
export const autoRouter = new AutoRouter();
