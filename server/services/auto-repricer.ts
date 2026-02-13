/**
 * Auto-Repricer Service for QR Gear
 * 
 * Evaluates repricing rules and applies dynamic price adjustments based on:
 * - Margin thresholds (protect margins when costs increase)
 * - Channel-specific pricing (different prices for Amazon vs Etsy)
 * - Competitive positioning
 * - Time-based rules (sales, promotions)
 * 
 * Features:
 * - Rule priority ordering
 * - Min/max price bounds
 * - Price rounding (e.g., to .99)
 * - Full audit history
 */

import { fsGet, fsGetAll, fsQuery, fsInsert, fsUpdate, fsDelete } from "../lib/firestore-crud";
import { profitCalculator } from "./profit-calculator";

export interface RepricingConditions {
  marginBelow?: number;
  marginAbove?: number;
  channel?: string;
  productCategory?: string;
  costIncreasePercent?: number;
  competitorPriceBelow?: number;
}

export interface RepricingActionParams {
  targetMarginPercent?: number;
  adjustPercent?: number;
  minPrice?: number;
  maxPrice?: number;
  roundTo?: number;
}

export interface RepricingResult {
  productId: string;
  productName: string;
  channel: string | null;
  previousPrice: number;
  newPrice: number;
  ruleApplied: string;
  reason: string;
  marginChange: {
    from: number;
    to: number;
  };
}

export interface RepricingStats {
  totalRules: number;
  activeRules: number;
  lastRunTime: Date | null;
  productsAdjusted24h: number;
  avgPriceChange: number;
}

class AutoRepricerService {
  /**
   * Get all repricing rules, sorted by priority
   */
  async getRules(): Promise<any[]> {
    const rules = await fsGetAll('repricing_rules');
    rules.sort((a: any, b: any) => {
      const priDiff = (b.priority || 0) - (a.priority || 0);
      if (priDiff !== 0) return priDiff;
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aDate - bDate;
    });
    return rules;
  }

  /**
   * Get a specific rule by ID
   */
  async getRule(ruleId: string): Promise<any | null> {
    return fsGet('repricing_rules', ruleId);
  }

  /**
   * Create a new repricing rule
   */
  async createRule(data: {
    name: string;
    description?: string;
    isActive?: boolean;
    priority?: number;
    conditions: RepricingConditions;
    actionType: string;
    actionParams: RepricingActionParams;
    appliesTo?: string;
    appliesToIds?: string[];
  }): Promise<any> {
    const rule = await fsInsert('repricing_rules', {
      name: data.name,
      description: data.description,
      isActive: data.isActive ?? true,
      priority: data.priority ?? 0,
      conditions: data.conditions,
      actionType: data.actionType,
      actionParams: data.actionParams,
      appliesTo: data.appliesTo ?? "all",
      appliesToIds: data.appliesToIds,
    });
    return rule;
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId: string, updates: Partial<{
    name: string;
    description: string;
    isActive: boolean;
    priority: number;
    conditions: RepricingConditions;
    actionType: string;
    actionParams: RepricingActionParams;
    appliesTo: string;
    appliesToIds: string[];
  }>): Promise<any | null> {
    const updated = await fsUpdate('repricing_rules', ruleId, { ...updates, updatedAt: new Date().toISOString() });
    return updated || null;
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    await fsDelete('repricing_rules', ruleId);
    return true;
  }

  /**
   * Toggle rule active status
   */
  async toggleRule(ruleId: string): Promise<any | null> {
    const rule = await this.getRule(ruleId);
    if (!rule) return null;
    
    return this.updateRule(ruleId, { isActive: !rule.isActive });
  }

  /**
   * Evaluate if a product matches rule conditions
   */
  private evaluateConditions(
    product: any,
    channel: string | null,
    conditions: RepricingConditions,
    currentMargin: number
  ): boolean {
    if (conditions.marginBelow !== undefined && currentMargin >= conditions.marginBelow) {
      return false;
    }
    if (conditions.marginAbove !== undefined && currentMargin <= conditions.marginAbove) {
      return false;
    }
    if (conditions.channel && channel !== conditions.channel) {
      return false;
    }
    if (conditions.productCategory && product.category !== conditions.productCategory) {
      return false;
    }
    return true;
  }

  /**
   * Calculate new price based on action type and params
   */
  private calculateNewPrice(
    currentPrice: number,
    baseCost: number,
    actionType: string,
    params: RepricingActionParams,
    channel: string
  ): number {
    let newPrice = currentPrice;

    switch (actionType) {
      case "adjust_margin":
        if (params.targetMarginPercent !== undefined) {
          newPrice = profitCalculator.calculateRecommendedPrice(
            baseCost,
            params.targetMarginPercent,
            channel
          );
        }
        break;

      case "increase_percent":
        if (params.adjustPercent !== undefined) {
          newPrice = currentPrice * (1 + params.adjustPercent / 100);
        }
        break;

      case "decrease_percent":
        if (params.adjustPercent !== undefined) {
          newPrice = currentPrice * (1 - params.adjustPercent / 100);
        }
        break;

      case "match_target":
        if (params.targetMarginPercent !== undefined) {
          newPrice = profitCalculator.calculateRecommendedPrice(
            baseCost,
            params.targetMarginPercent,
            channel
          );
        }
        break;
    }

    if (params.minPrice !== undefined && newPrice < params.minPrice) {
      newPrice = params.minPrice;
    }
    if (params.maxPrice !== undefined && newPrice > params.maxPrice) {
      newPrice = params.maxPrice;
    }

    if (params.roundTo !== undefined && params.roundTo > 0) {
      const roundTo = params.roundTo;
      if (roundTo === 0.99) {
        newPrice = Math.floor(newPrice) + 0.99;
      } else if (roundTo === 0.95) {
        newPrice = Math.floor(newPrice) + 0.95;
      } else {
        newPrice = Math.round(newPrice / roundTo) * roundTo;
      }
    }

    return Math.round(newPrice * 100) / 100;
  }

  /**
   * Run repricing evaluation for all products
   */
  async evaluateAllProducts(dryRun: boolean = true): Promise<RepricingResult[]> {
    const results: RepricingResult[] = [];

    const allActiveRules = await fsQuery('repricing_rules', [['isActive', '==', true]]);
    const activeRules = allActiveRules.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));

    if (activeRules.length === 0) {
      return results;
    }

    const products = await fsGetAll('master_products');

    for (const product of products) {
      const baseCost = parseFloat(product.baseCost || "0");
      const retailPrice = parseFloat(product.retailPrice || "0");
      
      if (baseCost <= 0 || retailPrice <= 0) continue;

      const profit = profitCalculator.calculateOrderProfit(
        retailPrice,
        baseCost,
        0,
        "direct"
      );
      const currentMargin = profit.marginPercent;

      for (const rule of activeRules) {
        const conditions = rule.conditions as RepricingConditions || {};
        const actionParams = rule.actionParams as RepricingActionParams || {};
        const appliesTo = rule.appliesTo || "all";
        const appliesToIds = rule.appliesToIds || [];

        if (appliesTo === "product" && !appliesToIds.includes(product.id)) {
          continue;
        }

        if (this.evaluateConditions(product, null, conditions, currentMargin)) {
          const newPrice = this.calculateNewPrice(
            retailPrice,
            baseCost,
            rule.actionType,
            actionParams,
            "direct"
          );

          if (Math.abs(newPrice - retailPrice) > 0.01) {
            const newProfit = profitCalculator.calculateOrderProfit(
              newPrice,
              baseCost,
              0,
              "direct"
            );

            const result: RepricingResult = {
              productId: product.id,
              productName: product.title,
              channel: null,
              previousPrice: retailPrice,
              newPrice,
              ruleApplied: rule.name,
              reason: `Applied rule "${rule.name}" (${rule.actionType})`,
              marginChange: {
                from: currentMargin,
                to: newProfit.marginPercent,
              },
            };

            results.push(result);

            if (!dryRun) {
              await fsUpdate('master_products', product.id, { 
                retailPrice: newPrice.toFixed(2),
                updatedAt: new Date().toISOString() 
              });

              await fsInsert('repricing_history', {
                ruleId: rule.id,
                masterProductId: product.id,
                channel: null,
                previousPrice: retailPrice.toFixed(2),
                newPrice: newPrice.toFixed(2),
                reason: result.reason,
                previousMargin: currentMargin.toFixed(2),
                newMargin: newProfit.marginPercent.toFixed(2),
                wasAutomatic: true,
              });
            }

            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get repricing history
   */
  async getHistory(limit: number = 50): Promise<any[]> {
    const historyItems = await fsQuery('repricing_history', [], 'appliedAt', 'desc', limit);

    const productIds = Array.from(new Set(historyItems.map((h: any) => h.masterProductId).filter(Boolean)));
    const ruleIds = Array.from(new Set(historyItems.map((h: any) => h.ruleId).filter(Boolean)));

    const products: any[] = [];
    for (const pid of productIds) {
      const p = await fsGet('master_products', pid as string);
      if (p) products.push(p);
    }
    const productMap = new Map(products.map(p => [p.id, p.title]));

    const rules: any[] = [];
    for (const rid of ruleIds) {
      const r = await fsGet('repricing_rules', rid as string);
      if (r) rules.push(r);
    }
    const ruleMap = new Map(rules.map(r => [r.id, r.name]));

    return historyItems.map((h: any) => ({
      id: h.id,
      ruleId: h.ruleId,
      masterProductId: h.masterProductId,
      channel: h.channel,
      previousPrice: h.previousPrice,
      newPrice: h.newPrice,
      reason: h.reason,
      previousMargin: h.previousMargin,
      newMargin: h.newMargin,
      appliedAt: h.appliedAt,
      wasAutomatic: h.wasAutomatic,
      productTitle: productMap.get(h.masterProductId) || null,
      ruleName: ruleMap.get(h.ruleId) || null,
    }));
  }

  /**
   * Get repricing statistics
   */
  async getStats(): Promise<RepricingStats> {
    const allRules = await fsGetAll('repricing_rules');
    const activeRules = allRules.filter((r: any) => r.isActive);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const allHistory = await fsGetAll('repricing_history');
    const recentHistory = allHistory.filter((h: any) => {
      const appliedAt = h.appliedAt ? new Date(h.appliedAt) : null;
      return appliedAt && appliedAt > twentyFourHoursAgo;
    });

    const avgPriceChange = recentHistory.length > 0
      ? recentHistory.reduce((sum: number, h: any) => {
          const prev = parseFloat(h.previousPrice || "0");
          const next = parseFloat(h.newPrice || "0");
          return sum + Math.abs(next - prev);
        }, 0) / recentHistory.length
      : 0;

    const sortedHistory = allHistory.sort((a: any, b: any) => {
      const aDate = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
      const bDate = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
      return bDate - aDate;
    });
    const lastEntry = sortedHistory[0];

    return {
      totalRules: allRules.length,
      activeRules: activeRules.length,
      lastRunTime: lastEntry?.appliedAt ? new Date(lastEntry.appliedAt) : null,
      productsAdjusted24h: recentHistory.length,
      avgPriceChange: Math.round(avgPriceChange * 100) / 100,
    };
  }

  /**
   * Preview what a rule would do without applying changes
   */
  async previewRule(ruleId: string): Promise<RepricingResult[]> {
    const rule = await this.getRule(ruleId);
    if (!rule) return [];

    const results: RepricingResult[] = [];
    const products = await fsGetAll('master_products');
    const conditions = rule.conditions as RepricingConditions || {};
    const actionParams = rule.actionParams as RepricingActionParams || {};
    const appliesTo = rule.appliesTo || "all";
    const appliesToIds = rule.appliesToIds || [];

    for (const product of products) {
      const baseCost = parseFloat(product.baseCost || "0");
      const retailPrice = parseFloat(product.retailPrice || "0");
      
      if (baseCost <= 0 || retailPrice <= 0) continue;

      if (appliesTo === "product" && !appliesToIds.includes(product.id)) {
        continue;
      }

      const profit = profitCalculator.calculateOrderProfit(
        retailPrice,
        baseCost,
        0,
        "direct"
      );
      const currentMargin = profit.marginPercent;

      if (this.evaluateConditions(product, null, conditions, currentMargin)) {
        const newPrice = this.calculateNewPrice(
          retailPrice,
          baseCost,
          rule.actionType,
          actionParams,
          "direct"
        );

        if (Math.abs(newPrice - retailPrice) > 0.01) {
          const newProfit = profitCalculator.calculateOrderProfit(
            newPrice,
            baseCost,
            0,
            "direct"
          );

          results.push({
            productId: product.id,
            productName: product.title,
            channel: null,
            previousPrice: retailPrice,
            newPrice,
            ruleApplied: rule.name,
            reason: `Would apply rule "${rule.name}" (${rule.actionType})`,
            marginChange: {
              from: currentMargin,
              to: newProfit.marginPercent,
            },
          });
        }
      }
    }

    return results;
  }
}

export const autoRepricer = new AutoRepricerService();
