import { createHash } from 'node:crypto';
export const HEALTH_PROVIDERS = ['printful','printify','stripe'] as const;
export class HealthMonitorService {
  constructor(private db:any,private env:Record<string,string|undefined> = process.env,private request:typeof fetch = fetch) {}
  private async configuration(provider:string) {
    if(!HEALTH_PROVIDERS.includes(provider as any)) throw Object.assign(new Error('Unknown provider'),{status:400});
    const saved=(await this.db.collection('system_config').doc('api_keys').get()).data()||{};
    const key=provider==='printful' ? saved.printfulApiKey||this.env.PRINTFUL_API_KEY||'' : this.env[`${provider.toUpperCase()}_${provider==='stripe'?'SECRET':'API'}_KEY`]||'';
    return {key,source:provider==='printful'&&saved.printfulApiKey?'dashboard':'env',updatedAt:saved[`${provider}UpdatedAt`]||null,
      fingerprint:createHash('sha256').update(key).digest('hex')};
  }
  async checkProvider(provider:string) {
    const config=await this.configuration(provider),start=Date.now();
    let status='not_configured',errorMessage:string|null='No credential is configured.',responseTimeMs:number|null=null,stores:number|null=null;
    if(config.key) {
      const urls:Record<string,string>={printful:'https://api.printful.com/stores',printify:'https://api.printify.com/v1/shops.json',stripe:'https://api.stripe.com/v1/balance'};
      try {
        const result=await this.request(urls[provider],{headers:{Authorization:`Bearer ${config.key}`},signal:AbortSignal.timeout(15000)});
        responseTimeMs=Date.now()-start;status=result.ok?'healthy':'down';errorMessage=result.ok?null:`Provider check returned HTTP ${result.status}.`;
        if(result.ok&&provider==='printful') {const body:any=await result.json();stores=Array.isArray(body.result)?body.result.length:null;}
      } catch {status='down';responseTimeMs=Date.now()-start;errorMessage='Provider check failed or timed out.';}
    }
    const row={providerType:provider,displayName:provider,status,isHealthy:status==='healthy',responseTimeMs,checkedAt:new Date().toISOString(),errorMessage,stores,credentialFingerprint:config.fingerprint};
    await this.db.collection('provider_health_checks').doc().set(row);
    return this.publicRow(row);
  }
  private publicRow(row:any) {const {credentialFingerprint,...safe}=row;return {...safe,lastCheck:row.checkedAt,checkTime:row.checkedAt};}
  async checkAllProviders(){return Promise.all(HEALTH_PROVIDERS.map(p=>this.checkProvider(p)));}
  async getProviderHistory(provider:string,limit=100){
    const snap=await this.db.collection('provider_health_checks').where('providerType','==',provider).get();
    return snap.docs.map((d:any)=>this.publicRow({id:d.id,...d.data()})).sort((a:any,b:any)=>String(b.checkedAt).localeCompare(String(a.checkedAt))).slice(0,limit);
  }
  async getHealthDashboard() {
    const providers=await Promise.all(HEALTH_PROVIDERS.map(async provider=>{
      const config=await this.configuration(provider);
      const snap=await this.db.collection('provider_health_checks').where('providerType','==',provider).get();
      const checks=snap.docs.map((d:any)=>({id:d.id,...d.data()})).filter((r:any)=>r.credentialFingerprint===config.fingerprint)
        .sort((a:any,b:any)=>String(b.checkedAt).localeCompare(String(a.checkedAt)));
      const latest=checks[0],day=checks.filter((r:any)=>new Date(r.checkedAt).getTime()>Date.now()-86400000&&r.responseTimeMs!=null);
      const status=!config.key?'not_configured':!latest?'not_checked':latest.status;
      return {...(latest?this.publicRow(latest):{}),providerType:provider,displayName:provider,status,isHealthy:status==='healthy',responseTimeMs:latest?.responseTimeMs??null,
        lastCheck:latest?.checkedAt??null,errorMessage:!config.key?'No credential is configured.':latest?.errorMessage??null,
        stats24h:{totalChecks:day.length,uptimePercent:day.length?Math.round(day.filter((r:any)=>r.isHealthy).length/day.length*10000)/100:null,
          avgResponseTime:day.length?Math.round(day.reduce((n:number,r:any)=>n+r.responseTimeMs,0)/day.length):null}};
    }));
    const healthy=providers.filter(p=>p.isHealthy).length;
    return {providers,summary:{totalProviders:providers.length,healthyProviders:healthy,unhealthyProviders:providers.filter(p=>p.status==='down').length,
      overallHealth:healthy===providers.length?'healthy':providers.some(p=>p.status==='down')?'degraded':'not_checked'}};
  }
  async getOverview(){
    const dashboard=await this.getHealthDashboard();
    return {providers:dashboard.providers.map(p=>({provider:p.providerType,status:p.status,lastCheck:p.lastCheck,responseMs:p.responseTimeMs,
      successRate:p.stats24h.uptimePercent,recentErrors:p.stats24h.totalChecks?Math.round(p.stats24h.totalChecks*(1-(p.stats24h.uptimePercent||0)/100)):null})),
      recentLogs:(await Promise.all(HEALTH_PROVIDERS.map(p=>this.getProviderHistory(p,20)))).flat().sort((a:any,b:any)=>String(b.checkedAt).localeCompare(String(a.checkedAt))).slice(0,20)};
  }
  async getKeyStatus(){
    const dashboard=await this.getHealthDashboard();
    return Object.fromEntries(await Promise.all(['printful','printify'].map(async p=>{
      const config=await this.configuration(p),health=dashboard.providers.find(h=>h.providerType===p)!;
      return [p,{masked:config.key?'••••'+config.key.slice(-4):'',source:config.source,updatedAt:config.updatedAt,
        status:health.status==='healthy'?'valid':health.status==='down'?'invalid':health.status,lastCheck:health.lastCheck}];
    })));
  }
}
