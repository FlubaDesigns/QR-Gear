"use strict";
/**
 * FIRESTORE ADAPTERS FOR NEXUSMAIL
 *
 * Firebase-specific implementations of NexusMail storage interfaces.
 * These adapters connect the portable NexusMail core to Firestore.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreHealthStore = exports.FirestoreIdempotencyStore = exports.FirestoreTemplateStore = exports.FirestoreOutboxRepository = void 0;
exports.createFirestoreOutboxRepository = createFirestoreOutboxRepository;
exports.createFirestoreTemplateStore = createFirestoreTemplateStore;
exports.createFirestoreIdempotencyStore = createFirestoreIdempotencyStore;
exports.createFirestoreHealthStore = createFirestoreHealthStore;
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
class FirestoreOutboxRepository {
    constructor(db) {
        this.db = db;
    }
    async create(record) {
        await this.db.collection(COLLECTIONS.OUTBOX).doc(record.outboxId).set(record);
    }
    async getById(outboxId) {
        const doc = await this.db.collection(COLLECTIONS.OUTBOX).doc(outboxId).get();
        return doc.exists ? doc.data() : null;
    }
    async getByIdempotencyKey(idempotencyKey) {
        const snapshot = await this.db
            .collection(COLLECTIONS.OUTBOX)
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
            .get();
        if (snapshot.empty)
            return null;
        return snapshot.docs[0].data();
    }
    async update(outboxId, updates) {
        await this.db.collection(COLLECTIONS.OUTBOX).doc(outboxId).update(updates);
    }
    async getReadyToSend(limit = 10) {
        const now = new Date().toISOString();
        const snapshot = await this.db
            .collection(COLLECTIONS.OUTBOX)
            .where('status', '==', 'QUEUED')
            .where('nextAttemptAt', '<=', now)
            .orderBy('nextAttemptAt')
            .limit(limit)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
    async getByStatus(status, limit = 100) {
        const snapshot = await this.db
            .collection(COLLECTIONS.OUTBOX)
            .where('status', '==', status)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
    async countByStatus(status) {
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
    async getRecent(limit = 50) {
        const snapshot = await this.db
            .collection(COLLECTIONS.OUTBOX)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
    /**
     * Get outbox records by trigger name.
     */
    async getByTrigger(triggerName, limit = 50) {
        const snapshot = await this.db
            .collection(COLLECTIONS.OUTBOX)
            .where('triggerName', '==', triggerName)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
}
exports.FirestoreOutboxRepository = FirestoreOutboxRepository;
// ============================================================================
// FIRESTORE TEMPLATE STORE
// ============================================================================
class FirestoreTemplateStore {
    constructor(db, cacheTTLMs = 60000) {
        this.cache = new Map();
        this.db = db;
        this.cacheTTL = cacheTTLMs;
    }
    async getBySlug(slug) {
        // Check cache first
        const cached = this.cache.get(slug);
        if (cached && Date.now() - cached.fetchedAt < this.cacheTTL) {
            return cached.template;
        }
        // Fetch from Firestore
        const doc = await this.db.collection(COLLECTIONS.TEMPLATES).doc(slug).get();
        if (!doc.exists)
            return null;
        const template = doc.data();
        // Update cache
        this.cache.set(slug, { template, fetchedAt: Date.now() });
        return template;
    }
    async list(filters) {
        let query = this.db.collection(COLLECTIONS.TEMPLATES);
        if (filters?.category) {
            query = query.where('category', '==', filters.category);
        }
        if (filters?.active !== undefined) {
            query = query.where('active', '==', filters.active);
        }
        const snapshot = await query.get();
        return snapshot.docs.map((doc) => doc.data());
    }
    /**
     * Create or update a template.
     */
    async upsert(template) {
        await this.db.collection(COLLECTIONS.TEMPLATES).doc(template.slug).set(template);
        // Invalidate cache
        this.cache.delete(template.slug);
    }
    /**
     * Clear the template cache.
     */
    clearCache() {
        this.cache.clear();
    }
}
exports.FirestoreTemplateStore = FirestoreTemplateStore;
// ============================================================================
// FIRESTORE IDEMPOTENCY STORE
// ============================================================================
class FirestoreIdempotencyStore {
    constructor(db) {
        this.db = db;
    }
    async hasBeenSent(idempotencyKey) {
        const doc = await this.db.collection(COLLECTIONS.IDEMPOTENCY).doc(idempotencyKey).get();
        return doc.exists;
    }
    async markAsSent(idempotencyKey, messageId) {
        await this.db.collection(COLLECTIONS.IDEMPOTENCY).doc(idempotencyKey).set({
            messageId,
            sentAt: new Date().toISOString(),
        });
    }
}
exports.FirestoreIdempotencyStore = FirestoreIdempotencyStore;
// ============================================================================
// FIRESTORE HEALTH STORE
// ============================================================================
class FirestoreHealthStore {
    constructor(db) {
        this.db = db;
    }
    async getScore(providerName) {
        const doc = await this.db
            .collection(COLLECTIONS.HEALTH)
            .doc(`score_${providerName}`)
            .get();
        return doc.exists ? doc.data() : null;
    }
    async saveScore(score) {
        await this.db
            .collection(COLLECTIONS.HEALTH)
            .doc(`score_${score.providerName}`)
            .set(score);
    }
    async getSendState(siteId) {
        const doc = await this.db
            .collection(COLLECTIONS.SEND_STATE)
            .doc(siteId)
            .get();
        return doc.exists ? doc.data() : null;
    }
    async saveSendState(state) {
        await this.db
            .collection(COLLECTIONS.SEND_STATE)
            .doc(state.siteId)
            .set(state);
    }
}
exports.FirestoreHealthStore = FirestoreHealthStore;
// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================
function createFirestoreOutboxRepository(db) {
    return new FirestoreOutboxRepository(db);
}
function createFirestoreTemplateStore(db, cacheTTLMs) {
    return new FirestoreTemplateStore(db, cacheTTLMs);
}
function createFirestoreIdempotencyStore(db) {
    return new FirestoreIdempotencyStore(db);
}
function createFirestoreHealthStore(db) {
    return new FirestoreHealthStore(db);
}
//# sourceMappingURL=FirestoreAdapters.js.map