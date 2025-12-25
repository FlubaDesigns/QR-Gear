/**
 * Profit Calculator Service for QR Gear
 * 
 * Calculates profit margins and analytics across all sales channels.
 * Uses production costs from Printify catalog and master product data.
 * 
 * Data Sources:
 * - Master products: baseCost and retailPrice from orchestration system
 * - Orders: revenue from completed/processing orders
 * - Channels: aggregated by source (currently all direct, expandable)
 * 
 * Fee Calculations:
 * - Platform fees: Etsy 6.5%, eBay 13%, Amazon 15%
 * - Payment processing: Stripe 2.9% + $0.30
 * 
 * Supports:
 * - Real-time profit calculation for hypothetical scenarios
 * - Margin health scoring (excellent/good/marginal/loss)
 * - Channel comparison for pricing decisions
 * - Recommended price calculation for target margins
 * 
 * Note: Analytics improve as order/sales data accumulates. Initial setup
 * shows product margin potential based on baseCost vs retailPrice.
 */

import { storage } from "../storage";

export interface ProfitBreakdown {
  grossRevenue: number;
  productionCost: number;
  shippingCost: number;
  platformFees: number;
  paymentProcessingFees: number;
  netProfit: number;
  marginPercent: number;
}

export interface ChannelProfitSummary {
  channel: string;
  channelType: "direct" | "marketplace" | "print_provider";
  orderCount: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  averageMargin: number;
  averageOrderValue: number;
  bestSellingProduct?: string;
  worstMarginProduct?: string;
}

export interface ProductProfitAnalysis {
  masterProductId: string;
  productName: string;
  sku: string;
  totalSold: number;
  totalRevenue: number;
  averageCost: number;
  averagePrice: number;
  marginPercent: number;
  profitPerUnit: number;
  recommendedPrice?: number;
  priceHealth: "excellent" | "good" | "marginal" | "loss";
}

export interface ProfitDashboard {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  overallMargin: number;
  channelSummaries: ChannelProfitSummary[];
  topProducts: ProductProfitAnalysis[];
  marginDistribution: {
    excellent: number; // > 60%
    good: number;      // 40-60%
    marginal: number;  // 20-40%
    loss: number;      // < 20%
  };
  alerts: ProfitAlert[];
}

export interface ProfitAlert {
  type: "warning" | "critical";
  message: string;
  productId?: string;
  channel?: string;
}

// Platform fee rates (approximate)
const PLATFORM_FEES: Record<string, number> = {
  direct: 0,           // No marketplace fees for direct sales
  etsy: 0.065,         // 6.5% transaction fee
  ebay: 0.13,          // ~13% final value fee
  amazon: 0.15,        // ~15% referral fee
  printify: 0,         // Printify doesn't charge marketplace fees
  printful: 0,
  apliiq: 0,
};

// Payment processing fee (Stripe)
const PAYMENT_PROCESSING_RATE = 0.029; // 2.9%
const PAYMENT_PROCESSING_FIXED = 0.30; // $0.30

class ProfitCalculator {
  /**
   * Calculate profit breakdown for a single order
   */
  calculateOrderProfit(
    revenue: number,
    productionCost: number,
    shippingCost: number = 0,
    channel: string = "direct"
  ): ProfitBreakdown {
    const platformFeeRate = PLATFORM_FEES[channel.toLowerCase()] || 0;
    const platformFees = revenue * platformFeeRate;
    const paymentProcessingFees = revenue * PAYMENT_PROCESSING_RATE + PAYMENT_PROCESSING_FIXED;
    
    const totalCosts = productionCost + shippingCost + platformFees + paymentProcessingFees;
    const netProfit = revenue - totalCosts;
    const marginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      grossRevenue: revenue,
      productionCost,
      shippingCost,
      platformFees,
      paymentProcessingFees,
      netProfit,
      marginPercent,
    };
  }

  /**
   * Calculate recommended retail price for a given production cost and target margin
   */
  calculateRecommendedPrice(
    productionCost: number,
    targetMarginPercent: number = 50,
    channel: string = "direct"
  ): number {
    const platformFeeRate = PLATFORM_FEES[channel.toLowerCase()] || 0;
    
    // Price = Cost / (1 - margin - fees)
    const effectiveMargin = 1 - (targetMarginPercent / 100) - platformFeeRate - PAYMENT_PROCESSING_RATE;
    
    if (effectiveMargin <= 0) {
      // Target margin not achievable with these fees
      return productionCost * 3; // Default to 3x cost
    }

    const price = (productionCost + PAYMENT_PROCESSING_FIXED) / effectiveMargin;
    return Math.ceil(price * 100) / 100; // Round up to nearest cent
  }

  /**
   * Determine price health based on margin
   */
  getPriceHealth(marginPercent: number): "excellent" | "good" | "marginal" | "loss" {
    if (marginPercent >= 60) return "excellent";
    if (marginPercent >= 40) return "good";
    if (marginPercent >= 20) return "marginal";
    return "loss";
  }

  /**
   * Get profit summary by channel from orders
   * Groups orders by source and calculates profit metrics
   */
  async getChannelProfitSummaries(): Promise<ChannelProfitSummary[]> {
    // Get orders from all statuses
    const completedOrders = await storage.getOrdersByStatus("completed");
    const processingOrders = await storage.getOrdersByStatus("processing");
    const allOrders = [...completedOrders, ...processingOrders];
    
    const channelData: Record<string, {
      orderCount: number;
      totalRevenue: number;
      totalCosts: number;
    }> = {};

    // Group orders by channel - for now, all are "direct" sales
    for (const order of allOrders) {
      const channel = "direct"; // Can be extended when channel tracking is added
      if (!channelData[channel]) {
        channelData[channel] = {
          orderCount: 0,
          totalRevenue: 0,
          totalCosts: 0,
        };
      }

      const revenue = parseFloat(order.totalAmount || "0");
      // Estimate cost as 40% of revenue (can be refined when cost tracking is added)
      const estimatedCost = revenue * 0.4;

      channelData[channel].orderCount++;
      channelData[channel].totalRevenue += revenue;
      channelData[channel].totalCosts += estimatedCost;
    }

    // Convert to summaries
    const summaries: ChannelProfitSummary[] = [];
    
    for (const [channel, data] of Object.entries(channelData)) {
      const totalProfit = data.totalRevenue - data.totalCosts;
      const averageMargin = data.totalRevenue > 0 
        ? (totalProfit / data.totalRevenue) * 100 
        : 0;
      const averageOrderValue = data.orderCount > 0 
        ? data.totalRevenue / data.orderCount 
        : 0;

      let channelType: "direct" | "marketplace" | "print_provider" = "direct";
      if (["etsy", "ebay", "amazon"].includes(channel.toLowerCase())) {
        channelType = "marketplace";
      } else if (["printify", "printful", "apliiq"].includes(channel.toLowerCase())) {
        channelType = "print_provider";
      }

      summaries.push({
        channel,
        channelType,
        orderCount: data.orderCount,
        totalRevenue: data.totalRevenue,
        totalCosts: data.totalCosts,
        totalProfit,
        averageMargin,
        averageOrderValue,
      });
    }

    return summaries.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Analyze product profitability across all sales
   * Uses master products from orchestration system
   */
  async getProductProfitAnalysis(): Promise<ProductProfitAnalysis[]> {
    const masterProducts = await storage.getAllMasterProducts();
    
    // Build map of product data with cost information
    const analyses: ProductProfitAnalysis[] = [];
    
    for (const product of masterProducts) {
      const baseCost = parseFloat(product.baseCost || "0");
      const retailPrice = parseFloat(product.retailPrice || "0");
      const profitPerUnit = retailPrice - baseCost;
      const marginPercent = retailPrice > 0 
        ? (profitPerUnit / retailPrice) * 100 
        : 0;

      const analysis: ProductProfitAnalysis = {
        masterProductId: product.id,
        productName: product.title,
        sku: product.sku,
        totalSold: 0, // Will be populated when order tracking is integrated
        totalRevenue: 0,
        averageCost: baseCost,
        averagePrice: retailPrice,
        marginPercent,
        profitPerUnit,
        recommendedPrice: this.calculateRecommendedPrice(baseCost, 50),
        priceHealth: this.getPriceHealth(marginPercent),
      };

      analyses.push(analysis);
    }

    return analyses.sort((a, b) => b.marginPercent - a.marginPercent);
  }

  /**
   * Generate profit alerts for issues that need attention
   */
  async generateAlerts(): Promise<ProfitAlert[]> {
    const alerts: ProfitAlert[] = [];
    const analyses = await this.getProductProfitAnalysis();

    for (const product of analyses) {
      if (product.totalSold > 0) {
        if (product.priceHealth === "loss") {
          alerts.push({
            type: "critical",
            message: `${product.productName} is selling at a loss (${product.marginPercent.toFixed(1)}% margin)`,
            productId: product.masterProductId,
          });
        } else if (product.priceHealth === "marginal") {
          alerts.push({
            type: "warning",
            message: `${product.productName} has low margin (${product.marginPercent.toFixed(1)}%)`,
            productId: product.masterProductId,
          });
        }
      }
    }

    // Check for channels with unusually low margins
    const channelSummaries = await this.getChannelProfitSummaries();
    for (const channel of channelSummaries) {
      if (channel.orderCount > 0 && channel.averageMargin < 25) {
        alerts.push({
          type: "warning",
          message: `${channel.channel} channel has low average margin (${channel.averageMargin.toFixed(1)}%)`,
          channel: channel.channel,
        });
      }
    }

    return alerts;
  }

  /**
   * Get complete profit dashboard with all metrics
   */
  async getDashboard(): Promise<ProfitDashboard> {
    const [channelSummaries, productAnalyses, alerts] = await Promise.all([
      this.getChannelProfitSummaries(),
      this.getProductProfitAnalysis(),
      this.generateAlerts(),
    ]);

    // Calculate totals
    const totalRevenue = channelSummaries.reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalCosts = channelSummaries.reduce((sum, c) => sum + c.totalCosts, 0);
    const totalProfit = channelSummaries.reduce((sum, c) => sum + c.totalProfit, 0);
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Calculate margin distribution
    const marginDistribution = {
      excellent: 0,
      good: 0,
      marginal: 0,
      loss: 0,
    };

    for (const product of productAnalyses) {
      if (product.totalSold > 0) {
        marginDistribution[product.priceHealth]++;
      }
    }

    return {
      totalRevenue,
      totalCosts,
      totalProfit,
      overallMargin,
      channelSummaries,
      topProducts: productAnalyses.slice(0, 10),
      marginDistribution,
      alerts,
    };
  }

  /**
   * Calculate break-even quantity for a product
   */
  calculateBreakEven(
    fixedCosts: number,
    unitPrice: number,
    unitCost: number
  ): number {
    const marginPerUnit = unitPrice - unitCost;
    if (marginPerUnit <= 0) {
      return Infinity; // Never breaks even
    }
    return Math.ceil(fixedCosts / marginPerUnit);
  }

  /**
   * Compare profitability across channels for a specific product
   */
  compareChannelsForProduct(
    productionCost: number,
    basePrice: number
  ): Record<string, ProfitBreakdown> {
    const channels = ["direct", "etsy", "ebay", "amazon"];
    const comparisons: Record<string, ProfitBreakdown> = {};

    for (const channel of channels) {
      comparisons[channel] = this.calculateOrderProfit(
        basePrice,
        productionCost,
        0,
        channel
      );
    }

    return comparisons;
  }
}

export const profitCalculator = new ProfitCalculator();
