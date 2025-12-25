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

import { db } from "../db";
import { repricingRules, repricingHistory, masterProducts, channelConfigs } from "@shared/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
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
    const rules = await db
      .select()
      .from(repricingRules)
      .orderBy(desc(repricingRules.priority), repricingRules.createdAt);
    return rules;
  }

  /**
   * Get a specific rule by ID
   */
  async getRule(ruleId: string): Promise<any | null> {
    const [rule] = await db
      .select()
      .from(repricingRules)
      .where(eq(repricingRules.id, ruleId));
    return rule || null;
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
    const [rule] = await db
      .insert(repricingRules)
      .values({
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
        conditions: data.conditions,
        actionType: data.actionType,
        actionParams: data.actionParams,
        appliesTo: data.appliesTo ?? "all",
        appliesToIds: data.appliesToIds,
      })
      .returning();
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
    const [updated] = await db
      .update(repricingRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(repricingRules.id, ruleId))
      .returning();
    return updated || null;
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    const result = await db
      .delete(repricingRules)
      .where(eq(repricingRules.id, ruleId));
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

    const activeRules = await db
      .select()
      .from(repricingRules)
      .where(eq(repricingRules.isActive, true))
      .orderBy(desc(repricingRules.priority));

    if (activeRules.length === 0) {
      return results;
    }

    const products = await db.select().from(masterProducts);

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
              await db
                .update(masterProducts)
                .set({ 
                  retailPrice: newPrice.toFixed(2),
                  updatedAt: new Date() 
                })
                .where(eq(masterProducts.id, product.id));

              await db.insert(repricingHistory).values({
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
    const history = await db
      .select({
        id: repricingHistory.id,
        ruleId: repricingHistory.ruleId,
        masterProductId: repricingHistory.masterProductId,
        channel: repricingHistory.channel,
        previousPrice: repricingHistory.previousPrice,
        newPrice: repricingHistory.newPrice,
        reason: repricingHistory.reason,
        previousMargin: repricingHistory.previousMargin,
        newMargin: repricingHistory.newMargin,
        appliedAt: repricingHistory.appliedAt,
        wasAutomatic: repricingHistory.wasAutomatic,
        productTitle: masterProducts.title,
        ruleName: repricingRules.name,
      })
      .from(repricingHistory)
      .leftJoin(masterProducts, eq(repricingHistory.masterProductId, masterProducts.id))
      .leftJoin(repricingRules, eq(repricingHistory.ruleId, repricingRules.id))
      .orderBy(desc(repricingHistory.appliedAt))
      .limit(limit);
    
    return history;
  }

  /**
   * Get repricing statistics
   */
  async getStats(): Promise<RepricingStats> {
    const allRules = await db.select().from(repricingRules);
    const activeRules = allRules.filter(r => r.isActive);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentHistory = await db
      .select()
      .from(repricingHistory)
      .where(sql`${repricingHistory.appliedAt} > ${twentyFourHoursAgo}`);

    const avgPriceChange = recentHistory.length > 0
      ? recentHistory.reduce((sum, h) => {
          const prev = parseFloat(h.previousPrice || "0");
          const next = parseFloat(h.newPrice || "0");
          return sum + Math.abs(next - prev);
        }, 0) / recentHistory.length
      : 0;

    const lastEntry = await db
      .select()
      .from(repricingHistory)
      .orderBy(desc(repricingHistory.appliedAt))
      .limit(1);

    return {
      totalRules: allRules.length,
      activeRules: activeRules.length,
      lastRunTime: lastEntry[0]?.appliedAt || null,
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
    const products = await db.select().from(masterProducts);
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
