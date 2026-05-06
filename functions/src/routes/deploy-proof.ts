import { Express, Request, Response } from 'express';

export function register(app: Express): void {
  app.get('/deploy-proof', (_req: Request, res: Response): void => {
    res.json({
      ok: true,
      target: 'firebase-functions',
      functionName: 'api',
      project: 'qrgear-c1ffd',
      deployedAtRuntime: new Date().toISOString(),
      buildId: process.env.QRGEAR_BUILD_ID || 'missing-build-id'
    });
  });
}
