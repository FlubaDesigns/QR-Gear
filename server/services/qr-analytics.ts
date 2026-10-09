import { getDb } from '../lib/firestore-crud';
import { QrAnalyticsService } from '../../functions/src/services/qr-analytics';
export type { QrScanLogInput, ScanAnalyticsSummary, ProductScanAnalytics, ScanTrend } from '../../functions/src/services/qr-analytics';
export const qrAnalyticsService = new QrAnalyticsService({collection:(name:string)=>getDb().collection(name)});
