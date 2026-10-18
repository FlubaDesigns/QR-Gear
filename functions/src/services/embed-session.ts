import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { db } from '../core';
import { BUILDER_SESSIONS_COLLECTION } from '../constants';

/** A legacy embed session uses its separate bearer capability, never its URL ID. */
export function assertEmbedSession(session: any, req: Request, states: string[]) {
  const fail = (message: string, status: number) => { throw Object.assign(new Error(message), { status }); };
  if (!session) fail('Session not found', 404);
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{32})$/i)?.[1];
  const expected = session.anonToken;
  if (!token || typeof expected !== 'string' || !/^[a-f0-9]{32}$/i.test(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) fail('Session capability required', 401);
  const expires = session.expiresAt?.toDate?.() ?? session.expiresAt;
  const deadline = new Date(expires).getTime();
  if (!Number.isFinite(deadline) || deadline <= Date.now()) fail('Session expired. Start a new session.', 410);
  if (!states.includes(session.status)) fail('Session is not available for this action', 409);
  return session;
}
export async function readEmbedSession(id: string, req: Request, states: string[]) {
  return assertEmbedSession((await db.collection(BUILDER_SESSIONS_COLLECTION).doc(id).get()).data(), req, states);
}
export async function mutateEmbedSession(id: string, req: Request, states: string[], patch: any,
  write?: (tx: FirebaseFirestore.Transaction) => void) {
  const ref = db.collection(BUILDER_SESSIONS_COLLECTION).doc(id);
  await db.runTransaction(async tx => {
    assertEmbedSession((await tx.get(ref)).data(), req, states);
    write?.(tx);
    tx.update(ref, patch);
  });
}
