import { db } from "../db";
import { qrScanEvents, masterProducts } from "@shared/schema";
import { eq, sql, and, gte, desc, inArray } from "drizzle-orm";

export interface QrScanLogInput {
  masterProductId?: string;
  customDesignId?: string;
  qrUrl?: string;
  country?: string;
  region?: string;
  deviceType?: string;
  userAgent?: string;
}

export interface ScanAnalyticsSummary {
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  scansThisMonth: number;
  uniqueProducts: number;
  topCountries: Array<{ country: string; scans: number }>;
  topDevices: Array<{ deviceType: string; scans: number }>;
}

export interface ProductScanAnalytics {
  productId: string;
  productName: string;
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  lastScanned: string | null;
}

export interface ScanTrend {
  date: string;
  scans: number;
}

class QrAnalyticsService {
  async logScan(input: QrScanLogInput): Promise<void> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const conditions = [];
    if (input.masterProductId) {
      conditions.push(eq(qrScanEvents.masterProductId, input.masterProductId));
    } else {
      conditions.push(sql`${qrScanEvents.masterProductId} IS NULL`);
    }
    if (input.customDesignId) {
      conditions.push(eq(qrScanEvents.customDesignId, input.customDesignId));
    } else {
      conditions.push(sql`${qrScanEvents.customDesignId} IS NULL`);
    }
    if (input.qrUrl) {
      conditions.push(eq(qrScanEvents.qrUrl, input.qrUrl));
    } else {
      conditions.push(sql`${qrScanEvents.qrUrl} IS NULL`);
    }
    conditions.push(gte(qrScanEvents.scanDate, today));

    const existing = await db
      .select()
      .from(qrScanEvents)
      .where(and(...conditions))
      .limit(1);

    if (existing.length > 0 && existing[0].scanCount !== null) {
      await db
        .update(qrScanEvents)
        .set({
          scanCount: (existing[0].scanCount || 0) + 1,
          deviceType: input.deviceType || existing[0].deviceType,
          userAgent: input.userAgent || existing[0].userAgent,
          country: input.country || existing[0].country,
          region: input.region || existing[0].region,
        })
        .where(eq(qrScanEvents.id, existing[0].id));
    } else {
      await db.insert(qrScanEvents).values({
        masterProductId: input.masterProductId,
        customDesignId: input.customDesignId,
        qrUrl: input.qrUrl,
        country: input.country,
        region: input.region,
        deviceType: input.deviceType,
        userAgent: input.userAgent,
        scanCount: 1,
        scanDate: now,
      });
    }
  }

  async getSummary(): Promise<ScanAnalyticsSummary> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${qrScanEvents.scanCount}), 0)` })
      .from(qrScanEvents);

    const [todayResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${qrScanEvents.scanCount}), 0)` })
      .from(qrScanEvents)
      .where(gte(qrScanEvents.scanDate, todayStart));

    const [weekResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${qrScanEvents.scanCount}), 0)` })
      .from(qrScanEvents)
      .where(gte(qrScanEvents.scanDate, weekStart));

    const [monthResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${qrScanEvents.scanCount}), 0)` })
      .from(qrScanEvents)
      .where(gte(qrScanEvents.scanDate, monthStart));

    const uniqueProductsResult = await db
      .select({ productId: qrScanEvents.masterProductId })
      .from(qrScanEvents)
      .where(sql`${qrScanEvents.masterProductId} IS NOT NULL`)
      .groupBy(qrScanEvents.masterProductId);

    const topCountries = await db
      .select({
        country: qrScanEvents.country,
        scans: sql<number>`COALESCE(SUM(${qrScanEvents.scanCount}), 0)`,
      })
      .from(qrScanEvents)
      .where(sql`${qrScanEvents.country} IS NOT NULL`)
      .groupBy(qrScanEvents.country)
      .orderBy(sql`SUM(${qrScanEvents.scanCount}) DESC`)
      .limit(5);

    const topDevices = await db
      .select({
        deviceType: qrScanEvents.deviceType,
        scans: sql<number>`COALESCE(SUM(${qrScanEvents.scanCount}), 0)`,
      })
      .from(qrScanEvents)
      .where(sql`${qrScanEvents.deviceType} IS NOT NULL`)
      .groupBy(qrScanEvents.deviceType)
      .orderBy(sql`SUM(${qrScanEvents.scanCount}) DESC`)
      .limit(5);

    return {
      totalScans: Number(totalResult?.total || 0),
      scansToday: Number(todayResult?.total || 0),
      scansThisWeek: Number(weekResult?.total || 0),
      scansThisMonth: Number(monthResult?.total || 0),
      uniqueProducts: uniqueProductsResult.length,
      topCountries: topCountries.map((c) => ({
        country: c.country || "Unknown",
        scans: Number(c.scans),
      })),
      topDevices: topDevices.map((d) => ({
        deviceType: d.deviceType || "Unknown",
        scans: Number(d.scans),
      })),
    };
  }

  async getProductAnalytics(limit = 20): Promise<ProductScanAnalytics[]> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const productScans = await db
      .select({
        productId: qrScanEvents.masterProductId,
        totalScans: sql<number>`COALESCE(SUM(${qrScanEvents.scanCount}), 0)`,
        scansToday: sql<number>`COALESCE(SUM(CASE WHEN ${qrScanEvents.scanDate} >= ${todayStart} THEN ${qrScanEvents.scanCount} ELSE 0 END), 0)`,
        scansThisWeek: sql<number>`COALESCE(SUM(CASE WHEN ${qrScanEvents.scanDate} >= ${weekStart} THEN ${qrScanEvents.scanCount} ELSE 0 END), 0)`,
        lastScanned: sql<string>`MAX(${qrScanEvents.scanDate})`,
      })
      .from(qrScanEvents)
      .where(sql`${qrScanEvents.masterProductId} IS NOT NULL`)
      .groupBy(qrScanEvents.masterProductId)
      .orderBy(sql`SUM(${qrScanEvents.scanCount}) DESC`)
      .limit(limit);

    if (productScans.length === 0) {
      return [];
    }

    const productIds = productScans
      .map((s) => s.productId)
      .filter((id): id is string => id !== null);

    const products = productIds.length > 0
      ? await db
          .select({ id: masterProducts.id, title: masterProducts.title })
          .from(masterProducts)
          .where(inArray(masterProducts.id, productIds))
      : [];

    const productMap = new Map(products.map((p) => [p.id, p.title]));

    return productScans.map((scan) => ({
      productId: scan.productId || "",
      productName: productMap.get(scan.productId || "") || "Unknown Product",
      totalScans: Number(scan.totalScans),
      scansToday: Number(scan.scansToday),
      scansThisWeek: Number(scan.scansThisWeek),
      lastScanned: scan.lastScanned,
    }));
  }

  async getTrends(days = 30): Promise<ScanTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const trends = await db
      .select({
        date: sql<string>`DATE(${qrScanEvents.scanDate})`,
        scans: sql<number>`COALESCE(SUM(${qrScanEvents.scanCount}), 0)`,
      })
      .from(qrScanEvents)
      .where(gte(qrScanEvents.scanDate, startDate))
      .groupBy(sql`DATE(${qrScanEvents.scanDate})`)
      .orderBy(sql`DATE(${qrScanEvents.scanDate}) ASC`);

    const allDates: ScanTrend[] = [];
    const current = new Date(startDate);
    const now = new Date();
    
    while (current <= now) {
      const dateStr = current.toISOString().split("T")[0];
      const existing = trends.find((t) => t.date === dateStr);
      allDates.push({
        date: dateStr,
        scans: existing ? Number(existing.scans) : 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return allDates;
  }

  async getRecentScans(limit = 50): Promise<any[]> {
    const events = await db
      .select()
      .from(qrScanEvents)
      .orderBy(desc(qrScanEvents.scanDate))
      .limit(limit);

    if (events.length === 0) {
      return [];
    }

    const productIds = events
      .map((e) => e.masterProductId)
      .filter((id): id is string => id !== null);

    const products = productIds.length > 0
      ? await db
          .select({ id: masterProducts.id, title: masterProducts.title })
          .from(masterProducts)
          .where(inArray(masterProducts.id, productIds))
      : [];

    const productMap = new Map(products.map((p) => [p.id, p.title]));

    return events.map((event) => ({
      ...event,
      productName: event.masterProductId
        ? productMap.get(event.masterProductId) || null
        : null,
    }));
  }

  detectDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) {
      return "mobile";
    }
    if (/ipad|tablet|kindle|silk/.test(ua)) {
      return "tablet";
    }
    return "desktop";
  }
}

export const qrAnalyticsService = new QrAnalyticsService();
