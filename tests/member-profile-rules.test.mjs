import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with the local Firestore emulator; this test never targets a live project.');
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-qrgear-rules', firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'member_profiles/owner'), { fullName: 'Owner', stripeConnectAccountId: 'acct_owner', stripePayoutsEnabled: true, isMember: true });
    await setDoc(doc(context.firestore(), 'brain_responses/private'), { response: 'Administrative response' });
    for (const [id, data] of Object.entries({ enabled: { isEnabled: true }, disabled: { isEnabled: false }, hidden: { isEnabled: true, isVisible: false }, draft: { isEnabled: true, status: 'draft' } })) {
      await setDoc(doc(context.firestore(), 'products', id), data);
    }
  });
});
after(async () => { await env?.cleanup(); });
const own = (id = 'owner') => doc(env.authenticatedContext(id).firestore(), 'member_profiles', id);

test('owner can read their profile and save tutorial progress without changing financial fields', async () => {
  await assertSucceeds(getDoc(own()));
  await assertSucceeds(setDoc(own(), { tutorial_complete: true, tutorial_completed_at: '2026-10-18T00:00:00.000Z' }, { merge: true }));
});
test('tutorial can create a profile before onboarding, but cannot pre-seed financial or membership fields', async () => {
  await assertSucceeds(setDoc(own('new-member'), { tutorial_complete: true }));
  for (const [field, value] of [['stripeConnectAccountId', 'acct_victim'], ['stripePayoutsEnabled', true], ['stripeOnboardingComplete', true], ['isMember', true], ['unknownFuturePrivilege', true]]) {
    await assertFails(setDoc(own('new-' + field), { tutorial_complete: true, [field]: value }));
  }
});
test('owner cannot change, remove or replace server-owned fields or delete the profile', async () => {
  await assertFails(updateDoc(own(), { stripeConnectAccountId: 'acct_victim' }));
  await assertFails(updateDoc(own(), { stripePayoutsEnabled: false }));
  await assertFails(updateDoc(own(), { stripeConnectAccountId: deleteField() }));
  await assertFails(setDoc(own(), { tutorial_complete: true }));
  await assertFails(deleteDoc(own()));
});
test('other members and anonymous clients cannot read or modify the profile', async () => {
  for (const context of [env.authenticatedContext('other'), env.unauthenticatedContext()]) {
    const ref = doc(context.firestore(), 'member_profiles/owner');
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { tutorial_complete: false }, { merge: true }));
  }
});
test('tutorial values remain typed and an administrator retains controlled access', async () => {
  await assertFails(updateDoc(own(), { tutorial_complete: 'yes' }));
  const ref = doc(env.authenticatedContext('admin', { role: 'admin' }).firestore(), 'member_profiles/admin-created');
  await assertSucceeds(setDoc(ref, { stripeConnectAccountId: 'acct_admin_created' }));
  await assertSucceeds(deleteDoc(ref));
});
test('public product reads preserve enabled legacy products and exclude disabled, hidden and draft records', async () => {
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('other')]) {
    await assertSucceeds(getDoc(doc(context.firestore(), 'products/enabled')));
    for (const id of ['disabled', 'hidden', 'draft']) await assertFails(getDoc(doc(context.firestore(), 'products', id)));
  }
  await assertSucceeds(getDoc(doc(env.authenticatedContext('admin', { role: 'admin' }).firestore(), 'products/draft')));
});
test('administrative Brain responses are not readable by ordinary signed-in accounts', async () => {
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('other')]) {
    await assertFails(getDoc(doc(context.firestore(), 'brain_responses/private')));
  }
  await assertSucceeds(getDoc(doc(env.authenticatedContext('admin', { role: 'admin' }).firestore(), 'brain_responses/private')));
});
