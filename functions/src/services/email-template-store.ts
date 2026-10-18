import { db } from '../core';
const fail = (message: string, status = 409): never => { throw Object.assign(new Error(message), { status }); };
const fields = ['trigger', 'name', 'subject', 'htmlContent', 'textContent', 'description', 'isEnabled', 'variables'];
export async function saveEmailTemplate(input: any, id?: string, database = db) {
 const ref = id ? database.collection('email_templates').doc(id) : database.collection('email_templates').doc();
 return database.runTransaction(async tx => {
  const prior = id ? (await tx.get(ref)).data() : null;
  if (id && !prior) fail('Email template not found.', 404);
  const patch = Object.fromEntries(fields.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
  const data = { ...prior, ...patch };
  if (typeof data.trigger !== 'string' || !/^[a-z0-9_]{1,80}$/.test(data.trigger)) fail('Choose a valid email trigger.', 400);
  if (typeof data.subject !== 'string' || !data.subject.trim()) fail('Email subject is required.', 400);
  const claim = database.collection('emailTemplateTriggers').doc(data.trigger), owner = (await tx.get(claim)).data();
  const duplicates = await tx.get(database.collection('email_templates').where('trigger', '==', data.trigger));
  const oldClaim = prior?.trigger && prior.trigger !== data.trigger ? database.collection('emailTemplateTriggers').doc(prior.trigger) : null;
  const oldOwner = oldClaim ? (await tx.get(oldClaim)).data() : null;
  if ((owner && owner.templateId !== ref.id) || duplicates.docs.some(doc => doc.id !== ref.id)) fail(`Trigger ${data.trigger} already has a template. Keep one template per trigger, including disabled templates.`);
  const timestamp = new Date().toISOString();
  const saved = { ...data, createdAt: prior?.createdAt || timestamp, updatedAt: timestamp };
  tx.set(ref, saved); tx.set(claim, { templateId: ref.id, updatedAt: timestamp });
  if (oldClaim && oldOwner?.templateId === ref.id) tx.delete(oldClaim);
  return { ...saved, id: ref.id, success: true };
 });
}
export async function deleteEmailTemplate(id: string, database = db) {
 const ref = database.collection('email_templates').doc(id);
 await database.runTransaction(async tx => {
  const prior = (await tx.get(ref)).data();
  if (!prior) fail('Email template not found.', 404);
  const claim = prior?.trigger ? database.collection('emailTemplateTriggers').doc(prior.trigger) : null;
  const owner = claim ? (await tx.get(claim)).data() : null;
  tx.delete(ref); if (claim && owner?.templateId === id) tx.delete(claim);
 });
}
