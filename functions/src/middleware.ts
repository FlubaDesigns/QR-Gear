import { Request, Response, NextFunction } from 'express';
import { admin, db } from './core';
import { isSandboxRuntime } from './runtime-config';
import { configuredAdminIds, hasAdminAccess } from '../../shared/adminAccess';

export const ALLOWED_ORIGINS = isSandboxRuntime() ? ['https://qr-gear-sandbox.web.app', 'https://qr-gear-sandbox.firebaseapp.com'] : [
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
    return await admin.auth().verifyIdToken(token, true);
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  (req as any).user = user;
  next();
}

export const ADMIN_USER_IDS = configuredAdminIds(process.env.ADMIN_USER_IDS);
const authorizedAdmin = Symbol('authorizedAdmin');

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  // The namespace guard and individual route guards share only this request's result.
  if ((req as any)[authorizedAdmin]) { next(); return; }
  res.set('Cache-Control', 'private, no-store');
  try {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.data();
  const isAdmin = hasAdminAccess(user.uid, userData, ADMIN_USER_IDS);
  if (!isAdmin) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  (req as any).user = user;
  (req as any)[authorizedAdmin] = true;
  next();
  } catch (error) { next(error); }
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

// Firebase Hosting forwards only __session. This cookie is accepted solely by
// private file GETs; all data mutations continue to require a Bearer token.
export const MEMBER_FILE_COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/api' };

export async function requireMemberFileOwner(req: Request, res: Response, memberId: string): Promise<boolean> {
  res.set('Cache-Control', 'private, no-store');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.set('X-Content-Type-Options', 'nosniff');
  res.vary('Cookie');
  res.vary('Authorization');
  // A supplied invalid Bearer token must never fall back to a different cookie identity.
  let user = req.headers.authorization ? await verifyAuth(req) : null;
  if (!req.headers.authorization) {
    const value = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('__session='))?.slice(10);
    if (value) {
      try { user = await admin.auth().verifyIdToken(decodeURIComponent(value), true); } catch { /* Invalid or expired session: deny below. */ }
    }
  }
  if (!user) { res.status(401).json({ error: 'Sign in to access your personal uploads.' }); return false; }
  if (user.uid !== memberId) { res.status(403).json({ error: 'This upload belongs to another member.' }); return false; }
  return true;
}

// Public filename proxies must not accept encoded paths into a private folder.
export function fileProxyPathGuard(req: Request, res: Response, next: NextFunction): void {
  if (!/^\/(?:member-files|library-files|files|media-files)(?:\/|$)/i.test(req.path)) { next(); return; }
  try {
    const parts = req.path.split('/').slice(1).map(decodeURIComponent);
    if (parts.some(part => /[\/\\\u0000-\u001f]/.test(part) || part === '..' || part === '.')) {
      res.status(400).json({ error: 'Invalid file path.' }); return;
    }
  } catch { res.status(400).json({ error: 'Invalid file path.' }); return; }
  next();
}

/** Keep product editing available while blocking live commerce entry points. */
export function sandboxCommerceMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isSandboxRuntime() && /^(?:\/checkout(?:\/|$)|\/public\/packet-checkout(?:\/|$)|\/connect(?:\/|$)|\/webhooks(?:\/|$))/.test(req.path)) {
    res.status(409).json({ error: 'Purchases and live commerce are disabled in this sandbox.' });
    return;
  }
  next();
}
