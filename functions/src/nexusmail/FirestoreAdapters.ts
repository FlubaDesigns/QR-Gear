/**
 * FIRESTORE ADAPTERS FOR NEXUSMAIL
 * 
 * Firebase-specific implementations of NexusMail storage interfaces.
 * These adapters connect the portable NexusMail core to Firestore.
 */

import * as admin from 'firebase-admin';
import {
  NexusMailOutboxRecord,
  NexusMailTemplate,
  OutboxStatus,
  TriggerName,
  OutboxRepository,
  TemplateStoreAdapter,
  IdempotencyStore,
  NexusMailSendState,
  ProviderHealthScore,
  HealthStore,
} from '../../../shared/nexusmail';

// ============================================================================
// COLLECTION NAMES
// ============================================================================

const COLLECTIONS = {
  OUTBOX: 'nexusmail_outbox',
  TEMPLATES: 'nexusmail_templates',
  IDEMPOTENCY: 'nexusmail_idempotency',
  SEND_STATE: 'nexusmail_send_state',
  HEALTH: 'nexusmail_health',
};

// ============================================================================
// FIRESTORE OUTBOX REPOSITORY
// ============================================================================

export class FirestoreOutboxRepository implements OutboxRepository {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async create(record: NexusMailOutboxRecord): Promise<void> {
    await this.db.collection(COLLECTIONS.OUTBOX).doc(record.outboxId).set(record);
  }

  async getById(outboxId: string): Promise<NexusMailOutboxRecord | null> {
    const doc = await this.db.collection(COLLECTIONS.OUTBOX).doc(outboxId).get();
    return doc.exists ? (doc.data() as NexusMailOutboxRecord) : null;
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<NexusMailOutboxRecord | null> {
    const snapshot = await this.db
      .collection(COLLECTIONS.OUTBOX)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as NexusMailOutboxRecord;
  }

  async update(outboxId: string, updates: Partial<NexusMailOutboxRecord>): Promise<void> {
    await this.db.collection(COLLECTIONS.OUTBOX).doc(outboxId).update(updates);
  }

  async getReadyToSend(limit: number = 10): Promise<NexusMailOutboxRecord[]> {
    const now = new Date().toISOString();
    const snapshot = await this.db
      .collection(COLLECTIONS.OUTBOX)
      .where('status', '==', 'QUEUED')
      .where('nextAttemptAt', '<=', now)
      .orderBy('nextAttemptAt')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as NexusMailOutboxRecord);
  }

  async getByStatus(status: OutboxStatus, limit: number = 100): Promise<NexusMailOutboxRecord[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.OUTBOX)
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as NexusMailOutboxRecord);
  }

  async countByStatus(status: OutboxStatus): Promise<number> {
    const snapshot = await this.db
      .collection(COLLECTIONS.OUTBOX)
      .where('status', '==', status)
      .count()
      .get();

    return snapshot.data().count;
  }

  /**
   * Get recent outbox records for admin view.
   */
  async getRecent(limit: number = 50): Promise<NexusMailOutboxRecord[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.OUTBOX)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as NexusMailOutboxRecord);
  }

  /**
   * Get outbox records by trigger name.
   */
  async getByTrigger(
    triggerName: TriggerName,
    limit: number = 50
  ): Promise<NexusMailOutboxRecord[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.OUTBOX)
      .where('triggerName', '==', triggerName)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as NexusMailOutboxRecord);
  }
}

// ============================================================================
// FIRESTORE TEMPLATE STORE
// ============================================================================

export class FirestoreTemplateStore implements TemplateStoreAdapter {
  private db: admin.firestore.Firestore;
  private cache: Map<string, { template: NexusMailTemplate; fetchedAt: number }> = new Map();
  private cacheTTL: number;

  constructor(db: admin.firestore.Firestore, cacheTTLMs: number = 60000) {
    this.db = db;
    this.cacheTTL = cacheTTLMs;
  }

  async getBySlug(slug: string): Promise<NexusMailTemplate | null> {
    // Check cache first
    const cached = this.cache.get(slug);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTTL) {
      return cached.template;
    }

    // Fetch from Firestore
    const doc = await this.db.collection(COLLECTIONS.TEMPLATES).doc(slug).get();
    if (!doc.exists) return null;

    const template = doc.data() as NexusMailTemplate;
    
    // Update cache
    this.cache.set(slug, { template, fetchedAt: Date.now() });
    
    return template;
  }

  async list(filters?: {
    category?: string;
    active?: boolean;
  }): Promise<NexusMailTemplate[]> {
    let query: admin.firestore.Query = this.db.collection(COLLECTIONS.TEMPLATES);

    if (filters?.category) {
      query = query.where('category', '==', filters.category);
    }
    if (filters?.active !== undefined) {
      query = query.where('active', '==', filters.active);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as NexusMailTemplate);
  }

  /**
   * Create or update a template.
   */
  async upsert(template: NexusMailTemplate): Promise<void> {
    await this.db.collection(COLLECTIONS.TEMPLATES).doc(template.slug).set(template);
    // Invalidate cache
    this.cache.delete(template.slug);
  }

  /**
   * Clear the template cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// FIRESTORE IDEMPOTENCY STORE
// ============================================================================

export class FirestoreIdempotencyStore implements IdempotencyStore {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async hasBeenSent(idempotencyKey: string): Promise<boolean> {
    const doc = await this.db.collection(COLLECTIONS.IDEMPOTENCY).doc(idempotencyKey).get();
    return doc.exists;
  }

  async markAsSent(idempotencyKey: string, messageId: string): Promise<void> {
    await this.db.collection(COLLECTIONS.IDEMPOTENCY).doc(idempotencyKey).set({
      messageId,
      sentAt: new Date().toISOString(),
    });
  }
}

// ============================================================================
// FIRESTORE HEALTH STORE
// ============================================================================

export class FirestoreHealthStore implements HealthStore {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  async getScore(providerName: string): Promise<ProviderHealthScore | null> {
    const doc = await this.db
      .collection(COLLECTIONS.HEALTH)
      .doc(`score_${providerName}`)
      .get();
    return doc.exists ? (doc.data() as ProviderHealthScore) : null;
  }

  async saveScore(score: ProviderHealthScore): Promise<void> {
    await this.db
      .collection(COLLECTIONS.HEALTH)
      .doc(`score_${score.providerName}`)
      .set(score);
  }

  async getSendState(siteId: string): Promise<NexusMailSendState | null> {
    const doc = await this.db
      .collection(COLLECTIONS.SEND_STATE)
      .doc(siteId)
      .get();
    return doc.exists ? (doc.data() as NexusMailSendState) : null;
  }

  async saveSendState(state: NexusMailSendState): Promise<void> {
    await this.db
      .collection(COLLECTIONS.SEND_STATE)
      .doc(state.siteId)
      .set(state);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createFirestoreOutboxRepository(
  db: admin.firestore.Firestore
): FirestoreOutboxRepository {
  return new FirestoreOutboxRepository(db);
}

export function createFirestoreTemplateStore(
  db: admin.firestore.Firestore,
  cacheTTLMs?: number
): FirestoreTemplateStore {
  return new FirestoreTemplateStore(db, cacheTTLMs);
}

export function createFirestoreIdempotencyStore(
  db: admin.firestore.Firestore
): FirestoreIdempotencyStore {
  return new FirestoreIdempotencyStore(db);
}

export function createFirestoreHealthStore(
  db: admin.firestore.Firestore
): FirestoreHealthStore {
  return new FirestoreHealthStore(db);
}
