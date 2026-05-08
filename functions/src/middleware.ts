import { Request, Response, NextFunction } from 'express';
import { admin, db } from './core';

export const ALLOWED_ORIGINS = [
  'https://qrgear-c1ffd.web.app',
  'https://qrgear-c1ffd.firebaseapp.com',
  'https://qrgear.com',
  'https://www.qrgear.com',
  'https://kingdom-connects.web.app',
  'https://kingdom-connects.firebaseapp.com',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5000', 'http://localhost:3000'] : []),
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
}

export function apiPrefixMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.path.startsWith('/api/')) {
    req.url = req.url.replace('/api', '');
  }
  next();
}

export async function verifyAuth(req: Request): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (process.env.ADMIN_BYPASS === 'true') {
    (req as any).user = { uid: 'bypass', email: 'bypass@admin' };
    return next();
  }
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  (req as any).user = user;
  next();
}

export const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || 'xHUmudG0t5OkCQhqyhB4nXhCUfs1').split(',').filter(Boolean);

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (process.env.ADMIN_BYPASS === 'true') {
    (req as any).user = { uid: 'bypass', email: 'bypass@admin' };
    return next();
  }
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.data();
  const isAdmin = userData?.isAdmin || ADMIN_USER_IDS.includes(user.uid);
  if (!isAdmin) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  (req as any).user = user;
  next();
}

export async function verifyMemberAuthCF(req: Request, memberId: string): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const user = await verifyAuth(req);
  if (!user) {
    return { authorized: false, error: 'Unauthorized' };
  }
  if (user.uid !== memberId) {
    return { authorized: false, error: 'Forbidden' };
  }
  return { authorized: true, userId: user.uid };
}
