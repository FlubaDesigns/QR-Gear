import type { Firestore } from 'firebase-admin/firestore';
import { saveEmailTemplate, deleteEmailTemplate } from './email-template-store';
/** Compatibility entry point; every writer uses the same trigger reservations. */
export async function changeEmailTemplate(db: Firestore, method: 'create' | 'update' | 'delete', id?: string, input: any = {}) {
 if (method === 'delete') { if (!id) throw new Error('Template ID is required.'); await deleteEmailTemplate(id, db); return {id}; }
 return saveEmailTemplate(input, method === 'update' ? id : undefined, db);
}
