

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

export class QrAnalyticsService {
  constructor(private db: any) {}
  private async events(): Promise<any[]> {
    // Historical deployed scans remain readable; all new writes use schema qr_scan_events.
    const [current, legacy] = await Promise.all(['qr_scan_events', 'qr_scans'].map(name => this.db.collection(name).get()));
    return [...current.docs.map((d: any) => ({id:d.id,...d.data()})),
      ...legacy.docs.map((d: any) => ({id:`legacy:${d.id}`,...d.data(),scanCount:1,scanDate:d.data().scannedAt}))]
      .map(event => { const value=event.scanDate; const date=value?.toDate ? value.toDate() : new Date(value);
        if (!value || !Number.isFinite(date.getTime()) || !Number.isInteger(event.scanCount) || event.scanCount < 0) throw new Error('Invalid saved QR scan record.');
        return {...event,scanDate:date.toISOString()}; });
  }
  private async product(id: string): Promise<any> {
    const d=await this.db.collection('master_catalog').doc(id).get();return d.exists?{id:d.id,...d.data()}:null;
  }
  async logScan(input: QrScanLogInput): Promise<void> {
    const ref=this.db.collection('qr_scan_events').doc();
    await ref.set(Object.fromEntries(Object.entries({...input,scanCount:1,scanDate:new Date().toISOString()}).filter(([,v])=>v!==undefined)));
  }

  async getSummary(): Promise<ScanAnalyticsSummary> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const allEvents = await this.events();

    let totalScans = 0;
    let scansToday = 0;
    let scansThisWeek = 0;
    let scansThisMonth = 0;
    const uniqueProductIds = new Set<string>();
    const countryMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();

    for (const event of allEvents) {
      const count = event.scanCount || 0;
      const scanDate = event.scanDate ? new Date(event.scanDate) : null;

      totalScans += count;

      if (scanDate) {
        if (scanDate >= todayStart) scansToday += count;
        if (scanDate >= weekStart) scansThisWeek += count;
        if (scanDate >= monthStart) scansThisMonth += count;
      }

      if (event.masterProductId) {
        uniqueProductIds.add(event.masterProductId);
      }

      if (event.country) {
        countryMap.set(event.country, (countryMap.get(event.country) || 0) + count);
      }

      if (event.deviceType) {
        deviceMap.set(event.deviceType, (deviceMap.get(event.deviceType) || 0) + count);
      }
    }

    const topCountries = Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country, scans]) => ({ country, scans }));

    const topDevices = Array.from(deviceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([deviceType, scans]) => ({ deviceType, scans }));

    return {
      totalScans,
      scansToday,
      scansThisWeek,
      scansThisMonth,
      uniqueProducts: uniqueProductIds.size,
      topCountries,
      topDevices,
    };
  }

  async getProductAnalytics(limit = 20): Promise<ProductScanAnalytics[]> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const allEvents = await this.events();

    const productStats = new Map<string, { totalScans: number; scansToday: number; scansThisWeek: number; lastScanned: string | null }>();

    for (const event of allEvents) {
      if (!event.masterProductId) continue;
      const pid = event.masterProductId;
      const count = event.scanCount || 0;
      const scanDate = event.scanDate ? new Date(event.scanDate) : null;
      const scanDateStr = event.scanDate || null;

      if (!productStats.has(pid)) {
        productStats.set(pid, { totalScans: 0, scansToday: 0, scansThisWeek: 0, lastScanned: null });
      }
      const stats = productStats.get(pid)!;
      stats.totalScans += count;

      if (scanDate) {
        if (scanDate >= todayStart) stats.scansToday += count;
        if (scanDate >= weekStart) stats.scansThisWeek += count;
        if (!stats.lastScanned || scanDateStr > stats.lastScanned) {
          stats.lastScanned = scanDateStr;
        }
      }
    }

    const sorted = Array.from(productStats.entries())
      .sort((a, b) => b[1].totalScans - a[1].totalScans)
      .slice(0, limit);

    if (sorted.length === 0) {
      return [];
    }

    const productIds = sorted.map(([id]) => id);
    const products: any[] = [];
    for (const pid of productIds) {
      const p = await this.product(pid);
      if (p) products.push(p);
    }
    const productMap = new Map(products.map((p) => [p.id, p.title]));

    return sorted.map(([productId, stats]) => ({
      productId,
      productName: productMap.get(productId) || "Unknown Product",
      totalScans: stats.totalScans,
      scansToday: stats.scansToday,
      scansThisWeek: stats.scansThisWeek,
      lastScanned: stats.lastScanned,
    }));
  }

  async getTrends(days = 30): Promise<ScanTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const allEvents = await this.events();

    const dateMap = new Map<string, number>();
    for (const event of allEvents) {
      const scanDate = event.scanDate ? new Date(event.scanDate) : null;
      if (!scanDate || scanDate < startDate) continue;
      const dateStr = scanDate.toISOString().split("T")[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + (event.scanCount || 0));
    }

    const allDates: ScanTrend[] = [];
    const current = new Date(startDate);
    const now = new Date();
    
    while (current <= now) {
      const dateStr = current.toISOString().split("T")[0];
      allDates.push({
        date: dateStr,
        scans: dateMap.get(dateStr) || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return allDates;
  }

  async getRecentScans(limit = 50): Promise<any[]> {
    const events = (await this.events()).sort((a,b)=>b.scanDate.localeCompare(a.scanDate)).slice(0,limit);

    if (events.length === 0) {
      return [];
    }

    const productIds = events
      .map((e: any) => e.masterProductId)
      .filter((id: any): id is string => id !== null && id !== undefined);

    const products: any[] = [];
    const uniqueIds = Array.from(new Set(productIds));
    for (const pid of uniqueIds) {
      const p = await this.product(pid);
      if (p) products.push(p);
    }
    const productMap = new Map(products.map((p) => [p.id, p.title]));

    return events.map((event: any) => ({
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


