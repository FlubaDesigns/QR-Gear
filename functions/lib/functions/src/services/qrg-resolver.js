"use strict";
/**
 * functions/src/services/qrg-resolver.ts
 *
 * Server-side QRG code → product instance resolver.
 *
 * QRG is identity. It points to the product instance record.
 * This service is the single authoritative lookup path.
 *
 * Usage:
 *   const resolved = await resolveQrgToProductInstance("QRG-11111-I-000001");
 *   // → { qrgCode, productInstanceId, productInstance, catalogId, catalogRecord, packetId, packetRecord }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveQrgToProductInstance = resolveQrgToProductInstance;
const core_1 = require("../core");
const qrgCodes_1 = require("../../../shared/qrgCodes");
const constants_1 = require("../constants");
const ADMIN_INSTANCES_COLLECTION = 'admin_catalog_instances';
const CATALOGS_COLLECTION = 'catalogs';
/**
 * Resolves a QRG code to exactly one admin_catalog_instance.
 *
 * Throws:
 *   "Invalid QRG code."                             — if format is invalid
 *   "No product instance found for QRG code."       — if no match
 *   "Multiple product instances found for QRG code." — if duplicates exist (data integrity violation)
 *
 * Also loads the linked productPacket and catalog record (best-effort, non-fatal if missing).
 */
async function resolveQrgToProductInstance(qrgCode) {
    if (!(0, qrgCodes_1.isValidQrgCode)(qrgCode)) {
        throw new Error('Invalid QRG code.');
    }
    // Primary field: qrgBaseCode (set by qrg-instance-allocator)
    let snap = await core_1.db
        .collection(ADMIN_INSTANCES_COLLECTION)
        .where('qrgBaseCode', '==', qrgCode)
        .get();
    // Backward compat: legacy field name used before schema rename
    if (snap.empty) {
        snap = await core_1.db
            .collection(ADMIN_INSTANCES_COLLECTION)
            .where('qrgPacketCode', '==', qrgCode)
            .get();
    }
    if (snap.empty) {
        throw new Error('No product instance found for QRG code.');
    }
    if (snap.docs.length > 1) {
        throw new Error('Multiple product instances found for QRG code.');
    }
    const instanceDoc = snap.docs[0];
    const productInstanceId = instanceDoc.id;
    const productInstance = instanceDoc.data();
    // Load linked product packet (best-effort)
    const packetId = productInstance.currentPacketId || null;
    let packetRecord = null;
    if (packetId) {
        try {
            const packetDoc = await core_1.db
                .collection(constants_1.PRODUCT_PACKETS_COLLECTION)
                .doc(packetId)
                .get();
            if (packetDoc.exists) {
                packetRecord = packetDoc.data();
            }
        }
        catch (err) {
            console.warn(`[QRGResolver] Could not load packet ${packetId} for instance ${productInstanceId}: ${err.message}`);
        }
    }
    // Load linked catalog (best-effort)
    const catalogId = productInstance.catalogId || null;
    let catalogRecord = null;
    if (catalogId) {
        try {
            const catalogDoc = await core_1.db
                .collection(CATALOGS_COLLECTION)
                .doc(catalogId)
                .get();
            if (catalogDoc.exists) {
                catalogRecord = catalogDoc.data();
            }
        }
        catch (err) {
            console.warn(`[QRGResolver] Could not load catalog ${catalogId} for instance ${productInstanceId}: ${err.message}`);
        }
    }
    return {
        qrgCode,
        productInstanceId,
        productInstance,
        catalogId,
        catalogRecord,
        packetId,
        packetRecord,
    };
}
//# sourceMappingURL=qrg-resolver.js.map