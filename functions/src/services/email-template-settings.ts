import type { Firestore } from 'firebase-admin/firestore';

/** All editor methods serialize on one control document; templates stay in their existing collection. */
export async function changeEmailTemplate(db: Firestore, method: 'create' | 'update' | 'delete', id?: string, input: any = {}) {
  const templates = db.collection('email_templates');
  const ref = id ? templates.doc(id) : templates.doc();
  const lock = db.collection('system').doc('email-template-writes');
  return db.runTransaction(async tx => {
    const revision = await tx.get(lock);
    const existing = await tx.get(ref);
    if (method !== 'create' && !existing.exists) throw Object.assign(new Error('Email template not found'), { status: 404 });
    const now = new Date().toISOString();
    if (method === 'delete') {
      tx.set(lock, { revision: (revision.data()?.revision || 0) + 1, updatedAt: now });
      tx.delete(ref);
      return { id: ref.id };
    }
    const patch: Record<string, any> = {};
    for (const key of ['name', 'description', 'trigger', 'subject', 'htmlContent', 'textContent', 'variables', 'isEnabled']) {
      if (Object.prototype.hasOwnProperty.call(input, key)) patch[key] = input[key];
    }
    const next = { ...existing.data(), ...patch };
    if (typeof next.trigger !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(next.trigger)) {
      throw Object.assign(new Error('Choose a valid email trigger.'), { status: 400 });
    }
    const conflicts = await tx.get(templates.where('trigger', '==', next.trigger));
    if (conflicts.docs.some(doc => doc.id !== ref.id)) {
      throw Object.assign(new Error(`A template already uses ${next.trigger}. Keep one template per trigger, including disabled templates.`), { status: 409 });
    }
    const data = { ...next, createdAt: existing.data()?.createdAt || now, updatedAt: now };
    tx.set(lock, { revision: (revision.data()?.revision || 0) + 1, updatedAt: now });
    tx.set(ref, data);
    return { ...data, id: ref.id };
  });
}
