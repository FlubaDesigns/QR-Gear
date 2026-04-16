/**
 * print-placements.ts — Single source of truth for print placement definitions
 *
 * Collection: print_placements
 * Document ID: internalName (e.g. "front", "back", "left_sleeve")
 *
 * Architecture:
 * - Internal names are canonical. Providers map their own names TO internal names.
 * - Each document carries per-provider mapping details so new providers can be
 *   added without changing the collection structure.
 * - Admin can PATCH any field. Seed is safe to re-run (upsert, never deletes).
 *
 * Document shape:
 * {
 *   internalName: string          — canonical key, matches document ID
 *   displayName: string           — human-readable label for UI
 *   description?: string          — optional longer description
 *   dimensions: {
 *     widthPx: number             — printable area width in pixels at native DPI
 *     heightPx: number            — printable area height in pixels at native DPI
 *     widthIn: number             — printable area width in inches
 *     heightIn: number            — printable area height in inches
 *     dpi: number                 — native DPI (typically 300)
 *   }
 *   providers: {
 *     [providerKey: string]: {
 *       dtgNames?: string[]       — provider-specific placement names for DTG
 *       dtfNames?: string[]       — provider-specific placement names for DTF
 *       defaultDtgName?: string   — which dtgName to use when submitting an order
 *       defaultDtfName?: string   — which dtfName to use when submitting an order
 *     }
 *   }
 *   sortOrder: number             — display order in UI
 *   isActive: boolean
 *   createdAt: Timestamp
 *   updatedAt: Timestamp
 * }
 */

import express from 'express';
import { db, admin } from '../core';
import { requireAdmin } from '../middleware';

const COLLECTION = 'print_placements';

// ── Canonical seed data ────────────────────────────────────────────────────────
// Source of truth for all placement definitions.
// Dimensions derived from CF_PLACEMENT_DIMENSIONS in composite-image.ts at 300 dpi.
// Provider mappings derived from core.ts PRINTIFY_TO_INTERNAL / PRINTFUL_TO_INTERNAL
// and INTERNAL_TO_PRINTFUL / INTERNAL_TO_PRINTFUL_DTF constants.

const SEED_PLACEMENTS: Array<{
  internalName: string;
  displayName: string;
  description: string;
  dimensions: { widthPx: number; heightPx: number; widthIn: number; heightIn: number; dpi: number };
  providers: Record<string, { dtgNames?: string[]; dtfNames?: string[]; defaultDtgName?: string; defaultDtfName?: string }>;
  sortOrder: number;
  isActive: boolean;
}> = [
  {
    internalName: 'front',
    displayName: 'Front',
    description: 'Full front print area',
    dimensions: { widthPx: 3600, heightPx: 4800, widthIn: 12, heightIn: 16, dpi: 300 },
    providers: {
      printful: {
        dtgNames: ['front', 'front_large'],
        dtfNames: ['front_dtf'],
        defaultDtgName: 'front_large',
        defaultDtfName: 'front_dtf',
      },
      printify: {
        dtgNames: ['front'],
        defaultDtgName: 'front',
      },
    },
    sortOrder: 1,
    isActive: true,
  },
  {
    internalName: 'back',
    displayName: 'Back',
    description: 'Full back print area',
    dimensions: { widthPx: 3600, heightPx: 4200, widthIn: 12, heightIn: 14, dpi: 300 },
    providers: {
      printful: {
        dtgNames: ['back'],
        dtfNames: ['back_dtf'],
        defaultDtgName: 'back',
        defaultDtfName: 'back_dtf',
      },
      printify: {
        dtgNames: ['back'],
        defaultDtgName: 'back',
      },
    },
    sortOrder: 2,
    isActive: true,
  },
  {
    internalName: 'pocket',
    displayName: 'Left Chest',
    description: 'Left chest pocket print area',
    dimensions: { widthPx: 1200, heightPx: 1200, widthIn: 4, heightIn: 4, dpi: 300 },
    providers: {
      // Printful does not currently have a pocket placement in the canonical mapping
      printify: {
        dtgNames: ['pocket'],
        defaultDtgName: 'pocket',
      },
    },
    sortOrder: 3,
    isActive: true,
  },
  {
    internalName: 'left_sleeve',
    displayName: 'Left Sleeve',
    description: 'Left sleeve print area',
    dimensions: { widthPx: 1200, heightPx: 1500, widthIn: 4, heightIn: 5, dpi: 300 },
    providers: {
      printful: {
        dtgNames: ['sleeve_left'],
        dtfNames: ['short_sleeve_left_dtf'],
        defaultDtgName: 'sleeve_left',
        defaultDtfName: 'short_sleeve_left_dtf',
      },
      printify: {
        dtgNames: ['sleeve_left'],
        defaultDtgName: 'sleeve_left',
      },
    },
    sortOrder: 4,
    isActive: true,
  },
  {
    internalName: 'right_sleeve',
    displayName: 'Right Sleeve',
    description: 'Right sleeve print area',
    dimensions: { widthPx: 1200, heightPx: 1500, widthIn: 4, heightIn: 5, dpi: 300 },
    providers: {
      printful: {
        dtgNames: ['sleeve_right'],
        dtfNames: ['short_sleeve_right_dtf'],
        defaultDtgName: 'sleeve_right',
        defaultDtfName: 'short_sleeve_right_dtf',
      },
      printify: {
        dtgNames: ['sleeve_right'],
        defaultDtgName: 'sleeve_right',
      },
    },
    sortOrder: 5,
    isActive: true,
  },
  {
    internalName: 'left',
    displayName: 'Left Side',
    description: 'Left side print area',
    dimensions: { widthPx: 1200, heightPx: 1500, widthIn: 4, heightIn: 5, dpi: 300 },
    providers: {
      printify: {
        dtgNames: ['left'],
        defaultDtgName: 'left',
      },
    },
    sortOrder: 6,
    isActive: true,
  },
  {
    internalName: 'right',
    displayName: 'Right Side',
    description: 'Right side print area',
    dimensions: { widthPx: 1200, heightPx: 1500, widthIn: 4, heightIn: 5, dpi: 300 },
    providers: {
      printify: {
        dtgNames: ['right'],
        defaultDtgName: 'right',
      },
    },
    sortOrder: 7,
    isActive: true,
  },
  {
    internalName: 'label_outside',
    displayName: 'Outside Label',
    description: 'Outside neck label / hang tag print area',
    dimensions: { widthPx: 750, heightPx: 360, widthIn: 2.5, heightIn: 1.2, dpi: 300 },
    providers: {
      printful: {
        dtgNames: ['label_outside'],
        defaultDtgName: 'label_outside',
      },
      printify: {
        dtgNames: ['neck_label'],
        defaultDtgName: 'neck_label',
      },
    },
    sortOrder: 8,
    isActive: true,
  },
  {
    internalName: 'label_inside',
    displayName: 'Inside Label',
    description: 'Inside neck label print area',
    dimensions: { widthPx: 750, heightPx: 360, widthIn: 2.5, heightIn: 1.2, dpi: 300 },
    providers: {
      printful: {
        dtgNames: ['label_inside'],
        defaultDtgName: 'label_inside',
      },
      printify: {
        dtgNames: ['label'],
        defaultDtgName: 'label',
      },
    },
    sortOrder: 9,
    isActive: true,
  },
];

function toSerializable(doc: FirebaseFirestore.DocumentSnapshot): Record<string, any> {
  const data = doc.data() as any;
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

export function register(app: express.Express): void {

  // ── GET /public/print-placements ─────────────────────────────────────────────
  // Read-only public endpoint — UI can use this without auth.
  // Filters isActive and optional ?provider= in-memory (collection is small; avoids composite index).
  app.get('/public/print-placements', async (req: any, res: any): Promise<void> => {
    try {
      const snap = await db.collection(COLLECTION).orderBy('sortOrder', 'asc').get();
      let placements = snap.docs.map(toSerializable).filter(p => p.isActive === true);
      if (req.query.provider) {
        const provider = req.query.provider as string;
        placements = placements.filter(p => p.providers?.[provider] != null);
      }
      res.json({ success: true, placements, count: placements.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /admin/print-placements ──────────────────────────────────────────────
  app.get('/admin/print-placements', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const snap = await db.collection(COLLECTION).orderBy('sortOrder', 'asc').get();
      const placements = snap.docs.map(toSerializable);
      res.json({ success: true, placements, count: placements.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /admin/print-placements/:id ─────────────────────────────────────────
  app.get('/admin/print-placements/:id', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const doc = await db.collection(COLLECTION).doc(req.params.id).get();
      if (!doc.exists) { res.status(404).json({ error: 'Placement not found' }); return; }
      res.json({ success: true, placement: toSerializable(doc) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /admin/print-placements/lookup ──────────────────────────────────────
  // Lookup the internal placement for a given provider + provider name.
  // e.g. ?provider=printful&providerName=front_large → returns the 'front' record
  app.get('/admin/print-placements/lookup', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { provider, providerName } = req.query as { provider?: string; providerName?: string };
      if (!provider || !providerName) {
        res.status(400).json({ error: 'provider and providerName query params are required' }); return;
      }
      const snap = await db.collection(COLLECTION).get();
      const match = snap.docs.find(doc => {
        const data = doc.data() as any;
        const prov = data.providers?.[provider];
        if (!prov) return false;
        return (prov.dtgNames ?? []).includes(providerName) || (prov.dtfNames ?? []).includes(providerName);
      });
      if (!match) { res.status(404).json({ error: `No placement found for ${provider}:${providerName}` }); return; }
      res.json({ success: true, placement: toSerializable(match) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── PATCH /admin/print-placements/:id ───────────────────────────────────────
  // Update any field. Admin-only.
  app.patch('/admin/print-placements/:id', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const allowed = ['displayName', 'description', 'dimensions', 'providers', 'sortOrder', 'isActive'];
      const update: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      for (const key of allowed) {
        if (req.body[key] !== undefined) update[key] = req.body[key];
      }
      const ref = db.collection(COLLECTION).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) { res.status(404).json({ error: 'Placement not found' }); return; }
      await ref.update(update);
      res.json({ success: true, id: req.params.id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /admin/print-placements/seed ───────────────────────────────────────
  // Upserts all canonical placements from the seed data. Safe to re-run.
  // Does NOT delete any existing placements that aren't in the seed.
  app.post('/admin/print-placements/seed', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();
      let created = 0;
      let updated = 0;

      for (const placement of SEED_PLACEMENTS) {
        const ref = db.collection(COLLECTION).doc(placement.internalName);
        const existing = await ref.get();
        if (existing.exists) {
          // Update all fields except createdAt
          batch.update(ref, { ...placement, updatedAt: now });
          updated++;
        } else {
          batch.set(ref, { ...placement, createdAt: now, updatedAt: now });
          created++;
        }
      }

      await batch.commit();
      console.log(`[PrintPlacements] Seed complete: ${created} created, ${updated} updated`);
      res.json({
        success: true,
        created,
        updated,
        total: SEED_PLACEMENTS.length,
        placements: SEED_PLACEMENTS.map(p => p.internalName),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
