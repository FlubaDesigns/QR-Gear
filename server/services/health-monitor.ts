import { adapterRegistry } from "../adapters";
import { storage } from "../storage";
import type { ProviderHealthLog } from "@shared/schema";

interface HealthStatus {
  providerType: string;
  displayName: string;
  isHealthy: boolean;
  responseTimeMs: number;
  lastCheck: Date;
  errorMessage?: string;
  errorCode?: string;
  stats24h: {
    uptimePercent: number;
    avgResponseTime: number;
    totalChecks: number;
  };
}

class HealthMonitorService {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  async checkAllProviders(): Promise<HealthStatus[]> {
    const providers = adapterRegistry.getAllPrintProviders();
    const results: HealthStatus[] = [];

    for (const provider of providers) {
      try {
        const healthResult = await provider.healthCheck();
        
        // Log to database
        await storage.logProviderHealth({
          providerType: provider.providerType,
          isHealthy: healthResult.isHealthy,
          responseTimeMs: healthResult.responseTimeMs,
          errorMessage: healthResult.error || null,
          errorCode: healthResult.errorCode || null,
        });

        // Get 24h stats
        const stats = await storage.getProviderHealthStats(provider.providerType, 24);

        results.push({
          providerType: provider.providerType,
          displayName: provider.displayName,
          isHealthy: healthResult.isHealthy,
          responseTimeMs: healthResult.responseTimeMs,
          lastCheck: new Date(),
          errorMessage: healthResult.error,
          errorCode: healthResult.errorCode,
          stats24h: stats,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        
        await storage.logProviderHealth({
          providerType: provider.providerType,
          isHealthy: false,
          responseTimeMs: 0,
          errorMessage: errorMsg,
          errorCode: "CHECK_FAILED",
        });

        const stats = await storage.getProviderHealthStats(provider.providerType, 24);

        results.push({
          providerType: provider.providerType,
          displayName: provider.displayName,
          isHealthy: false,
          responseTimeMs: 0,
          lastCheck: new Date(),
          errorMessage: errorMsg,
          errorCode: "CHECK_FAILED",
          stats24h: stats,
        });
      }
    }

    return results;
  }

  async checkProvider(providerType: string): Promise<HealthStatus | null> {
    const provider = adapterRegistry.getPrintProvider(providerType as "printify" | "printful" | "apliiq");
    if (!provider) return null;

    try {
      const healthResult = await provider.healthCheck();
      
      await storage.logProviderHealth({
        providerType: provider.providerType,
        isHealthy: healthResult.isHealthy,
        responseTimeMs: healthResult.responseTimeMs,
        errorMessage: healthResult.error || null,
        errorCode: healthResult.errorCode || null,
      });

      const stats = await storage.getProviderHealthStats(provider.providerType, 24);

      return {
        providerType: provider.providerType,
        displayName: provider.displayName,
        isHealthy: healthResult.isHealthy,
        responseTimeMs: healthResult.responseTimeMs,
        lastCheck: new Date(),
        errorMessage: healthResult.error,
        errorCode: healthResult.errorCode,
        stats24h: stats,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      
      await storage.logProviderHealth({
        providerType: provider.providerType,
        isHealthy: false,
        responseTimeMs: 0,
        errorMessage: errorMsg,
        errorCode: "CHECK_FAILED",
      });

      const stats = await storage.getProviderHealthStats(provider.providerType, 24);

      return {
        providerType: provider.providerType,
        displayName: provider.displayName,
        isHealthy: false,
        responseTimeMs: 0,
        lastCheck: new Date(),
        errorMessage: errorMsg,
        errorCode: "CHECK_FAILED",
        stats24h: stats,
      };
    }
  }

  async getHealthDashboard(): Promise<{
    providers: HealthStatus[];
    summary: {
      totalProviders: number;
      healthyProviders: number;
      unhealthyProviders: number;
      overallHealth: "healthy" | "degraded" | "critical";
    };
  }> {
    const providers = adapterRegistry.getAllPrintProviders();
    const statuses: HealthStatus[] = [];

    for (const provider of providers) {
      const latest = await storage.getLatestProviderHealth(provider.providerType);
      const stats = await storage.getProviderHealthStats(provider.providerType, 24);

      statuses.push({
        providerType: provider.providerType,
        displayName: provider.displayName,
        isHealthy: latest?.isHealthy ?? false,
        responseTimeMs: latest?.responseTimeMs ?? 0,
        lastCheck: latest?.checkTime ?? new Date(0),
        errorMessage: latest?.errorMessage ?? undefined,
        errorCode: latest?.errorCode ?? undefined,
        stats24h: stats,
      });
    }

    const healthyCount = statuses.filter(s => s.isHealthy).length;
    const totalCount = statuses.length;

    let overallHealth: "healthy" | "degraded" | "critical";
    if (healthyCount === totalCount) {
      overallHealth = "healthy";
    } else if (healthyCount > 0) {
      overallHealth = "degraded";
    } else {
      overallHealth = "critical";
    }

    return {
      providers: statuses,
      summary: {
        totalProviders: totalCount,
        healthyProviders: healthyCount,
        unhealthyProviders: totalCount - healthyCount,
        overallHealth,
      },
    };
  }

  async getProviderHistory(providerType: string, limit: number = 100): Promise<ProviderHealthLog[]> {
    return storage.getProviderHealthLogs(providerType, limit);
  }

  startPeriodicChecks(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      console.log("[HealthMonitor] Already running");
      return;
    }

    this.isRunning = true;
    console.log(`[HealthMonitor] Starting periodic checks every ${intervalMinutes} minutes`);

    // Run immediately
    this.checkAllProviders().catch(console.error);

    // Then run on interval
    this.checkInterval = setInterval(() => {
      this.checkAllProviders().catch(console.error);
    }, intervalMinutes * 60 * 1000);
  }

  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log("[HealthMonitor] Stopped periodic checks");
  }
}

export const healthMonitor = new HealthMonitorService();
