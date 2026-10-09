import { getDb } from '../lib/firestore-crud';
import { HealthMonitorService } from '../../functions/src/services/health-monitor';
export const healthMonitor = new HealthMonitorService({collection:(name:string)=>getDb().collection(name)});
