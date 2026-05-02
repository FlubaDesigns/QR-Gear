"use strict";
/**
 * printify-republish.ts
 *
 * Standalone service for re-publishing existing Printify products with
 * updated composite images. Called by:
 *   - Firestore trigger: onDocumentUpdated productPackets/{packetId}
 *   - Admin HTTP endpoint: POST /admin/qrg/republish/:instanceId (on-demand)
 *
 * Never import Express types here — this must be trigger-safe.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.compositeChanged = compositeChanged;
exports.republishInstanceToPrintify = republishInstanceToPrintify;
exports.republishAllInstancesForPacket = republishAllInstancesForPacket;
const firestore_1 = require("firebase-admin/firestore");
const core_1 = require("../core");
const PLACEMENT_URL_MAP = {
    front: 'compositeUrl',
    left_sleeve: 'sleeveCompositeUrl',
    right_sleeve: 'rightSleeveCompositeUrl',
    back: 'backCompositeUrl',
};
const COMPOSITE_FIELDS = Object.values(PLACEMENT_URL_MAP);
/**
 * Returns true if any composite URL field changed between before and after.
 */
function compositeChanged(before, after) {
    return COMPOSITE_FIELDS.some((field) => before[field] !== after[field]);
}
/**
 * Re-publishes a single admin_catalog_instance to Printify using its
 * current packet's composite images. Updates publishStatus on the instance.
 */
async function republishInstanceToPrintify(instanceId) {
    try {
        const instanceDoc = await core_1.db.collection('admin_catalog_instances').doc(instanceId).get();
        if (!instanceDoc.exists)
            return { success: false, error: 'Instance not found' };
        const instance = instanceDoc.data();
        if (!instance.printifyProductId) {
            return { success: false, error: 'No printifyProductId — instance has never been published' };
        }
        if (!instance.currentPacketId) {
            return { success: false, error: 'No currentPacketId on instance' };
        }
        const packetDoc = await core_1.db.collection('productPackets').doc(instance.currentPacketId).get();
        if (!packetDoc.exists) {
            return { success: false, error: `Packet ${instance.currentPacketId} not found` };
        }
        const packet = packetDoc.data();
        const { printifyClient } = await Promise.resolve().then(() => __importStar(require('./printify')));
        const existingProduct = await printifyClient.getProduct(instance.printifyProductId);
        const variantIds = (existingProduct.variants || [])
            .filter((v) => v.is_enabled)
            .map((v) => v.id);
        if (variantIds.length === 0) {
            return { success: false, error: 'No enabled variants on existing Printify product' };
        }
        const placements = packet.placements || ['front'];
        const placeholders = [];
        for (const placement of placements) {
            const urlField = PLACEMENT_URL_MAP[placement];
            if (!urlField) {
                console.warn(`[Republish] Unknown placement "${placement}" on instance ${instanceId} — skipping`);
                continue;
            }
            const imageUrl = packet[urlField];
            if (!imageUrl) {
                console.warn(`[Republish] Placement "${placement}" has no URL (field: ${urlField}) on packet ${instance.currentPacketId} — skipping`);
                continue;
            }
            const upload = await printifyClient.uploadImage(`${instance.currentPacketId}-${placement}-repub.png`, imageUrl);
            console.log(`[Republish] ${placement} uploaded: ${upload.id} for instance ${instanceId}`);
            placeholders.push({
                position: placement,
                images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
            });
        }
        if (placeholders.length === 0) {
            const msg = 'No placement images could be uploaded — check compositeUrl and placements on packet';
            await core_1.db.collection('admin_catalog_instances').doc(instanceId).update({
                publishStatus: 'error',
                publishError: msg,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return { success: false, error: msg };
        }
        await printifyClient.updateProduct(instance.printifyProductId, {
            print_areas: [{ variant_ids: variantIds, placeholders }],
        });
        await core_1.db.collection('admin_catalog_instances').doc(instanceId).update({
            publishStatus: 'synced',
            lastPublishedAt: firestore_1.FieldValue.serverTimestamp(),
            publishError: null,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        console.log(`[Republish] Instance ${instanceId} → Printify product ${instance.printifyProductId} synced`);
        return { success: true };
    }
    catch (err) {
        console.error(`[Republish] Failed for instance ${instanceId}:`, err.message);
        await core_1.db.collection('admin_catalog_instances').doc(instanceId).update({
            publishStatus: 'error',
            publishError: err.message || 'Unknown error',
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }).catch(() => { });
        return { success: false, error: err.message };
    }
}
/**
 * Finds all admin_catalog_instances linked to a packet that have a
 * printifyProductId, and re-publishes each one.
 */
async function republishAllInstancesForPacket(packetId) {
    const snap = await core_1.db.collection('admin_catalog_instances')
        .where('currentPacketId', '==', packetId)
        .get();
    const publishable = snap.docs.filter((doc) => {
        const d = doc.data();
        return d.printifyProductId && typeof d.printifyProductId === 'string' && d.printifyProductId.length > 0;
    });
    if (publishable.length === 0) {
        console.log(`[Republish] Packet ${packetId} has no published instances — nothing to re-publish`);
        return;
    }
    console.log(`[Republish] Packet ${packetId} changed — re-publishing ${publishable.length} instance(s)`);
    await Promise.all(publishable.map((doc) => core_1.db.collection('admin_catalog_instances').doc(doc.id).update({
        publishStatus: 'pending',
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }).then(() => republishInstanceToPrintify(doc.id))));
}
//# sourceMappingURL=printify-republish.js.map