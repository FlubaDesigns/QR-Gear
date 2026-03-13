import type { Firestore } from 'firebase-admin/firestore';
import { firestoreToDate, firestoreToDateNullable, prepareForFirestore } from './firestore-adapter-helpers';
import type {
  User, InsertUser, UpsertUser,
  AdminSettings, InsertAdminSettings,
  BrowsingHistory, InsertBrowsingHistory,
} from '@shared/schema';

function docToUser(doc: FirebaseFirestore.DocumentSnapshot): User {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: firestoreToDateNullable(data.createdAt),
    updatedAt: firestoreToDateNullable(data.updatedAt),
  } as User;
}

function docToBrowsingHistory(doc: FirebaseFirestore.DocumentSnapshot): BrowsingHistory {
  const data = doc.data()!;
  return { ...data, id: doc.id, viewedAt: firestoreToDate(data.viewedAt) } as BrowsingHistory;
}

export async function getUser(db: Firestore, id: string): Promise<User | undefined> {
  const doc = await db.collection('users').doc(id).get();
  if (!doc.exists) return undefined;
  return docToUser(doc);
}

export async function getUserByEmail(db: Firestore, email: string): Promise<User | undefined> {
  const snapshot = await db.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();
  if (snapshot.empty) return undefined;
  return docToUser(snapshot.docs[0]);
}

export async function getUsers(db: Firestore): Promise<User[]> {
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map(doc => docToUser(doc));
}

export async function createUser(db: Firestore, user: InsertUser): Promise<User> {
  const userId = user.id || db.collection('users').doc().id;
  const docRef = db.collection('users').doc(userId);
  const data = {
    ...user,
    id: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await docRef.set(data);
  const doc = await docRef.get();
  return docToUser(doc);
}

export async function upsertUser(db: Firestore, userData: UpsertUser): Promise<User> {
  const userId = userData.id || db.collection('users').doc().id;
  const docRef = db.collection('users').doc(userId);
  const data = {
    ...userData,
    id: userId,
    updatedAt: new Date(),
  };
  await docRef.set(data, { merge: true });
  const doc = await docRef.get();
  return docToUser(doc);
}

export async function getAdminSettings(db: Firestore): Promise<AdminSettings | undefined> {
  const doc = await db.collection('settings').doc('admin').get();
  if (!doc.exists) return undefined;
  const data = doc.data()!;
  return {
    id: 'admin',
    ...data,
  } as AdminSettings;
}

export async function upsertAdminSettings(db: Firestore, settings: InsertAdminSettings): Promise<AdminSettings> {
  const docRef = db.collection('settings').doc('admin');
  await docRef.set(settings, { merge: true });
  const doc = await docRef.get();
  return {
    id: 'admin',
    ...doc.data()!,
  } as AdminSettings;
}

export async function getBrowsingHistory(db: Firestore, userId: string): Promise<BrowsingHistory[]> {
  const snapshot = await db.collection('browsingHistory')
    .where('userId', '==', userId)
    .orderBy('viewedAt', 'desc')
    .limit(50)
    .get();
  return snapshot.docs.map(doc => docToBrowsingHistory(doc));
}

export async function addBrowsingHistory(db: Firestore, entry: InsertBrowsingHistory): Promise<BrowsingHistory> {
  const docRef = db.collection('browsingHistory').doc();
  const data = prepareForFirestore({
    ...entry,
    id: docRef.id,
    viewedAt: new Date(),
  });
  await docRef.set(data);
  return docToBrowsingHistory(await docRef.get());
}

export async function clearBrowsingHistory(db: Firestore, userId: string): Promise<void> {
  const snapshot = await db.collection('browsingHistory')
    .where('userId', '==', userId)
    .get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
