import type { Firestore } from 'firebase-admin/firestore';

export function firestoreToDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

export function firestoreToDateNullable(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

export function dateToFirestore(date: Date | string | null | undefined): any {
  if (!date) return null;
  if (typeof date === 'string') return new Date(date);
  return date;
}

export function prepareForFirestore(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value instanceof Date) {
      result[key] = value;
    } else if (typeof value === 'string' && (key.endsWith('At') || key === 'createdAt' || key === 'updatedAt')) {
      result[key] = new Date(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
      result[key] = prepareForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
