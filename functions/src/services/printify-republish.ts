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

import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../core';

const PLACEMENT_URL_MAP: Record<string, string> = {
  front:        'compositeUrl',
  left_sleeve:  'sleeveCompositeUrl',
  right_sleeve: 'rightSleeveCompositeUrl',
  back:         'backCompositeUrl',
};

const COMPOSITE_FIELDS = Object.values(PLACEMENT_URL_MAP);

/**
 * Returns true if any composite URL field changed between before and after.
 */
export function compositeChanged(
  before: Record<string, any>,
  after: Record<string, any>
): boolean {
  return COMPOSITE_FIELDS.some((field) => before[field] !== after[field]);
}

/**
 * Re-publishes a single admin_catalog_instance to Printify using its
 * current packet's composite images. Updates publishStatus on the instance.
 */
export async function republishInstanceToPrintify(instanceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const instanceDoc = await db.collection('admin_catalog_instances').doc(instanceId).get();
    if (!instanceDoc.exists) return { success: false, error: 'Instance not found' };

    const instance = instanceDoc.data()!;

    if (!instance.printifyProductId) {
      return { success: false, error: 'No printifyProductId — instance has never been published' };
    }
    if (!instance.currentPacketId) {
      return { success: false, error: 'No currentPacketId on instance' };
    }

    const packetDoc = await db.collection('productPackets').doc(instance.currentPacketId).get();
    if (!packetDoc.exists) {
      return { success: false, error: `Packet ${instance.currentPacketId} not found` };
    }
    const packet = packetDoc.data()!;

    const { printifyClient } = await import('./printify');

    const existingProduct = await printifyClient.getProduct(instance.printifyProductId);
    const variantIds: number[] = (existingProduct.variants || [])
      .filter((v: any) => v.is_enabled)
      .map((v: any) => v.id);

    if (variantIds.length === 0) {
      return { success: false, error: 'No enabled variants on existing Printify product' };
    }

    const placements: string[] = packet.placements || ['front'];
    const placeholders: Array<{
      position: string;
      images: Array<{ id: string; x: number; y: number; scale: number; angle: number }>;
    }> = [];

    for (const placement of placements) {
      const urlField = PLACEMENT_URL_MAP[placement];
      if (!urlField) {
        console.warn(`[Republish] Unknown placement "${placement}" on instance ${instanceId} — skipping`);
        continue;
      }
      const imageUrl: string | undefined = packet[urlField];
      if (!imageUrl) {
        console.warn(`[Republish] Placement "${placement}" has no URL (field: ${urlField}) on packet ${instance.currentPacketId} — skipping`);
        continue;
      }
      const upload = await printifyClient.uploadImage(
        `${instance.currentPacketId}-${placement}-repub.png`,
        imageUrl
      );
      console.log(`[Republish] ${placement} uploaded: ${upload.id} for instance ${instanceId}`);
      placeholders.push({
        position: placement,
        images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
      });
    }

    if (placeholders.length === 0) {
      const msg = 'No placement images could be uploaded — check compositeUrl and placements on packet';
      await db.collection('admin_catalog_instances').doc(instanceId).update({
        publishStatus: 'error',
        publishError: msg,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { success: false, error: msg };
    }

    await printifyClient.updateProduct(instance.printifyProductId, {
      print_areas: [{ variant_ids: variantIds, placeholders }],
    });

    await db.collection('admin_catalog_instances').doc(instanceId).update({
      publishStatus: 'synced',
      lastPublishedAt: FieldValue.serverTimestamp(),
      publishError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[Republish] Instance ${instanceId} → Printify product ${instance.printifyProductId} synced`);
    return { success: true };

  } catch (err: any) {
    console.error(`[Republish] Failed for instance ${instanceId}:`, err.message);
    await db.collection('admin_catalog_instances').doc(instanceId).update({
      publishStatus: 'error',
      publishError: err.message || 'Unknown error',
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
    return { success: false, error: err.message };
  }
}

/**
 * Finds all admin_catalog_instances linked to a packet that have a
 * printifyProductId, and re-publishes each one.
 */
export async function republishAllInstancesForPacket(packetId: string): Promise<void> {
  const snap = await db.collection('admin_catalog_instances')
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

  await Promise.all(
    publishable.map((doc) =>
      db.collection('admin_catalog_instances').doc(doc.id).update({
        publishStatus: 'pending',
        updatedAt: FieldValue.serverTimestamp(),
      }).then(() => republishInstanceToPrintify(doc.id))
    )
  );
}
