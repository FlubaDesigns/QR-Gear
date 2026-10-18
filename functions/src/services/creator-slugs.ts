import { db } from '../core';
const fail = (message: string, status: number): never => { throw Object.assign(new Error(message), { status }); };
export const normalizeCreatorSlug = (value: unknown): string => typeof value === 'string' ? value.trim().toLowerCase() : '';
export async function saveCreatorProfile(userId: string, input: Record<string, any>) {
 const slug = normalizeCreatorSlug(input.creatorSlug);
 if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(slug)) fail('Choose a creator address of 3–30 letters, numbers or hyphens.', 400);
 const ref = db.collection('member_profiles').doc(userId), claim = db.collection('creatorSlugs').doc(slug);
 return db.runTransaction(async tx => {
  const prior = (await tx.get(ref)).data();
  const owner = (await tx.get(claim)).data();
  // Include historical mixed-case slugs until every profile has a reservation.
  const profiles = await tx.get(db.collection('member_profiles'));
  const oldSlug = normalizeCreatorSlug(prior?.creatorSlug);
  const oldClaim = oldSlug && oldSlug !== slug ? db.collection('creatorSlugs').doc(oldSlug) : null;
  const oldOwner = oldClaim ? (await tx.get(oldClaim)).data() : null;
  if ((owner && owner.userId !== userId) || profiles.docs.some(doc => doc.id !== userId && normalizeCreatorSlug(doc.data().creatorSlug) === slug)) fail('That creator address is already taken. Choose another.', 409);
  // UID routes remain usable and cannot be shadowed by somebody else's slug.
  if (profiles.docs.some(doc => doc.id !== userId && normalizeCreatorSlug(doc.id) === slug)) fail('That creator address is reserved.', 409);
  const saved = { ...input, userId, creatorSlug: slug, memberSince: prior?.memberSince || new Date().toISOString() };
  tx.set(ref, saved, { merge: true }); tx.set(claim, { userId });
  if (oldClaim && oldOwner?.userId === userId) tx.delete(oldClaim);
  return saved;
 });
}
export async function findCreatorProfile(slug: string) {
 const profiles = await db.collection('member_profiles').get();
 const matches = profiles.docs.filter(doc => normalizeCreatorSlug(doc.data().creatorSlug) === normalizeCreatorSlug(slug));
 if (matches.length > 1) fail('This creator address needs to be resolved by its owners.', 409);
 const byId = profiles.docs.find(doc => doc.id === slug);
 if (byId && matches.length && matches[0].id !== byId.id) fail('This creator address conflicts with an existing account.', 409);
 if (matches.length === 1) return matches[0];
 return profiles.docs.find(doc => doc.id === slug) || null;
}
