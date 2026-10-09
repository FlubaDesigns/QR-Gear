import { Express, Request, Response } from 'express';
import { resolveRuntimeConfig } from '../runtime-config';

export function register(app: Express): void {
  app.get('/deploy-proof', (_req: Request, res: Response): void => {
    res.json({
      ok: true,
      target: 'firebase-functions',
      functionName: 'api',
      project: resolveRuntimeConfig().projectId,
      environment: resolveRuntimeConfig().sandbox ? 'sandbox' : 'main',
      deployedAtRuntime: new Date().toISOString(),
      buildId: process.env.QRGEAR_BUILD_ID || 'missing-build-id'
    });
  });
}
