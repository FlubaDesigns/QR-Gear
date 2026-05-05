"use strict";
/**
 * functions/src/services/bld-builder.ts
 *
 * BLD (Build Definition Schema) — ID generation, instance extraction,
 * and Firestore write helpers.
 *
 * BLD ID format:
 *   BLD - [1:context] [2:layoutMode/contentType] [3:engineType] [4:instanceCount] [5-6:seq…] - [001-999:buildSeq]
 *
 * Context S  (Shirt graphic — what is on the physical product)
 *   Layout modes:  Z = Zone, P = Palette (freeform)
 *   Engines:       T = Text, I = Image, Q = QR, A = Action
 *
 * Context U  (URL — what the QR delivers when scanned)
 *   Content types: I = Image, V = Video, D = Document
 *   Engine:        T = Text overlays (optional)
 *
 * bld_counters key is the two-char prefix (e.g. "SZ", "SP", "UI").
 * Counters are incremented atomically via Firestore transaction.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveBldCounterKey = deriveBldCounterKey;
exports.extractBldInstances = extractBldInstances;
exports.writeBldDefinition = writeBldDefinition;
const core_1 = require("../core");
const BLD_DEFINITIONS_COLLECTION = 'bld_definitions';
const BLD_COUNTERS_COLLECTION = 'bld_counters';
// ─────────────────────────────────────────────────────────────────────────────
// BLD ID generation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Derive the two-char counter key from the builder state.
 * graphicLayoutMode "zone" → Z, "freeform" → P.
 * All current builder builds are S-context (shirt graphic).
 */
function deriveBldCounterKey(graphicLayoutMode) {
    const layoutCode = graphicLayoutMode === 'freeform' ? 'P' : 'Z';
    return `S${layoutCode}`;
}
/**
 * Atomically increment the counter for a given key and return the new number.
 */
async function incrementBldCounter(key) {
    const ref = core_1.db.collection(BLD_COUNTERS_COLLECTION).doc(key);
    let count = 0;
    await core_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            count = 1;
            tx.set(ref, {
                count: 1,
                key,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            count = (snap.data().count || 0) + 1;
            tx.update(ref, {
                count,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    return count;
}
/**
 * Build the BLD ID string from its components.
 *
 * For S-context (zone/palette), format is:
 *   BLD-S[Z|P][instanceCount]-[buildSeq padded to 3]
 *
 * Example: BLD-SZ9-001, BLD-SP3-001
 *
 * (We keep the ID short but readable; the sub-collection instances
 *  carry all the sequenced payload details.)
 */
function formatBldId(context, layoutCode, instanceCount, buildSequence) {
    const seq = String(buildSequence).padStart(3, '0');
    return `BLD-${context}${layoutCode}${instanceCount}-${seq}`;
}
// ─────────────────────────────────────────────────────────────────────────────
// Instance extraction from builder working state
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Walk the builder working-state snapshot and extract ordered BLD instances.
 *
 * Builder state structure (from buildWorkingSnapshot):
 *   graphics.content.{headerStyle, footerStyle, subBottomStyle, landingTextBlocks…}
 *   graphics.content.graphicLayoutMode
 *   graphics.content.qrSizePercent, qrPositionX, qrPositionY
 *   graphics.content.areaImageUrl
 *   graphics.loadedBackground
 *
 * Render order (01 = paints first / bottom of stack):
 *   01  img      — background image (loadedBackground or areaImageUrl)
 *   02  qrc      — QR code
 *   03  txt(hdr) — header text overlay
 *   04  txt(ftr) — footer text overlay
 *   05  txt(sub) — sub-bottom text strip
 *   06+ txt      — additional landingTextBlocks
 */
function extractBldInstances(working) {
    const graphics = (working.graphics || {});
    const content = (graphics.content || {});
    const instances = [];
    let seq = 1;
    const pad = (n) => String(n).padStart(2, '0');
    // ── 01 Image layer (background or palette area image) ─────────────────────
    const bgUrl = graphics.loadedBackground?.url || null;
    const areaImgUrl = content.areaImageUrl || null;
    const imageUrl = bgUrl || areaImgUrl || null;
    if (imageUrl) {
        instances.push({
            seq: pad(seq++),
            type: 'img',
            role: bgUrl ? 'background' : 'area_image',
            imageUrl,
            size: content.areaImageScale ?? 100,
            positionLR: content.areaImageOffsetX ?? 50,
            positionUD: content.areaImageOffsetY ?? 50,
        });
    }
    // ── 02 QR code ─────────────────────────────────────────────────────────────
    const qrSizePercent = typeof content.qrSizePercent === 'number' ? content.qrSizePercent : 75;
    const qrPositionX = typeof content.qrPositionX === 'number' ? content.qrPositionX : 50;
    const qrPositionY = typeof content.qrPositionY === 'number' ? content.qrPositionY : 50;
    const layoutMode = content.graphicLayoutMode || 'zone';
    const qrcInstance = {
        seq: pad(seq++),
        type: 'qrc',
        size: qrSizePercent,
    };
    if (layoutMode === 'freeform') {
        qrcInstance.positionLR = qrPositionX;
        qrcInstance.positionUD = qrPositionY;
    }
    instances.push(qrcInstance);
    // ── Header text ────────────────────────────────────────────────────────────
    const header = content.headerStyle || {};
    if (header.enabled && header.text) {
        instances.push({
            seq: pad(seq++),
            type: 'txt',
            role: 'header',
            text: header.text || '',
            fontFamily: header.fontFamily || '',
            fontSize: header.fontSize ? Number(header.fontSize) : undefined,
            fontWeight: header.fontWeight,
            color: header.color || '',
            letterSpacing: header.letterSpacing != null ? Number(header.letterSpacing) : undefined,
            strokeWidth: header.strokeWidth != null ? Number(header.strokeWidth) : undefined,
            strokeColor: header.strokeColor || '',
            warpPreset: header.warpPreset || '',
            verticalOffset: header.verticalOffset != null ? Number(header.verticalOffset) : undefined,
            horizontalOffset: header.horizontalOffset != null ? Number(header.horizontalOffset) : undefined,
        });
        seq++;
    }
    // ── Footer text ────────────────────────────────────────────────────────────
    const footer = content.footerStyle || {};
    if (footer.enabled && footer.text) {
        instances.push({
            seq: pad(seq),
            type: 'txt',
            role: 'footer',
            text: footer.text || '',
            fontFamily: footer.fontFamily || '',
            fontSize: footer.fontSize ? Number(footer.fontSize) : undefined,
            fontWeight: footer.fontWeight,
            color: footer.color || '',
            letterSpacing: footer.letterSpacing != null ? Number(footer.letterSpacing) : undefined,
            strokeWidth: footer.strokeWidth != null ? Number(footer.strokeWidth) : undefined,
            strokeColor: footer.strokeColor || '',
            warpPreset: footer.warpPreset || '',
            verticalOffset: footer.verticalOffset != null ? Number(footer.verticalOffset) : undefined,
            horizontalOffset: footer.horizontalOffset != null ? Number(footer.horizontalOffset) : undefined,
        });
        seq++;
    }
    // ── Sub-bottom text ────────────────────────────────────────────────────────
    const subBottom = content.subBottomStyle || {};
    if (subBottom.enabled && subBottom.text) {
        instances.push({
            seq: pad(seq),
            type: 'txt',
            role: 'sub_bottom',
            text: subBottom.text || '',
            fontFamily: subBottom.fontFamily || '',
            fontSize: subBottom.fontSize ? Number(subBottom.fontSize) : undefined,
            fontWeight: subBottom.fontWeight,
            color: subBottom.color || '',
            letterSpacing: subBottom.letterSpacing != null ? Number(subBottom.letterSpacing) : undefined,
            strokeWidth: subBottom.strokeWidth != null ? Number(subBottom.strokeWidth) : undefined,
            strokeColor: subBottom.strokeColor || '',
        });
        seq++;
    }
    // ── Landing text blocks (additional dynamic text layers) ───────────────────
    const landingBlocks = Array.isArray(content.landingTextBlocks)
        ? content.landingTextBlocks
        : [];
    for (const block of landingBlocks) {
        if (!block.enabled || !block.text)
            continue;
        instances.push({
            seq: pad(seq),
            type: 'txt',
            role: block.role || 'landing_text',
            text: block.text || '',
            fontFamily: block.fontFamily || '',
            fontSize: block.fontSize ? Number(block.fontSize) : undefined,
            fontWeight: block.fontWeight,
            color: block.color || '',
            letterSpacing: block.letterSpacing != null ? Number(block.letterSpacing) : undefined,
            strokeWidth: block.strokeWidth != null ? Number(block.strokeWidth) : undefined,
            strokeColor: block.strokeColor || '',
            warpPreset: block.warpPreset || '',
            verticalOffset: block.verticalOffset != null ? Number(block.verticalOffset) : undefined,
            horizontalOffset: block.horizontalOffset != null ? Number(block.horizontalOffset) : undefined,
            imageUrl: block.imageUrl || undefined,
            imageScale: block.imageScale != null ? Number(block.imageScale) : undefined,
        });
        seq++;
    }
    return instances;
}
/**
 * Generate a BLD definition record + sub-collection instances for a
 * builder working-state snapshot.
 *
 * Steps:
 *   1. Extract instances from working state.
 *   2. Derive counter key (e.g. "SZ" or "SP").
 *   3. Atomically allocate buildSequence.
 *   4. Format BLD ID.
 *   5. Write bld_definitions/{bldId} header.
 *   6. Write bld_definitions/{bldId}/instances/{seq} for each instance.
 */
async function writeBldDefinition(opts) {
    const { working, sourceSessionId, sourceInstanceId, qrgBlankId, qrgBaseCode, packetId } = opts;
    const graphics = (working.graphics || {});
    const content = (graphics.content || {});
    const layoutMode = content.graphicLayoutMode || 'zone';
    const layoutCode = layoutMode === 'freeform' ? 'P' : 'Z';
    const counterKey = `S${layoutCode}`;
    const instances = extractBldInstances(working);
    const instanceCount = instances.length;
    const buildSequence = await incrementBldCounter(counterKey);
    const bldId = formatBldId('S', layoutCode, instanceCount, buildSequence);
    const now = core_1.admin.firestore.FieldValue.serverTimestamp();
    const header = {
        bldId,
        context: 'S',
        layoutMode: layoutCode,
        instanceCount,
        buildSequence,
        sourceSessionId: sourceSessionId || null,
        sourceInstanceId: sourceInstanceId || null,
        qrgBlankId: qrgBlankId || null,
        qrgBaseCode: qrgBaseCode || null,
        packetId: packetId || null,
        graphicLayoutMode: layoutMode,
        qrProductState: (working.qrConfig?.qrProductState) || null,
        qrSizePercent: typeof content.qrSizePercent === 'number' ? content.qrSizePercent : 75,
        qrPositionX: typeof content.qrPositionX === 'number' ? content.qrPositionX : 50,
        qrPositionY: typeof content.qrPositionY === 'number' ? content.qrPositionY : 50,
        createdAt: now,
        updatedAt: now,
    };
    // Use a Firestore batch for atomic header + all instances
    const batch = core_1.db.batch();
    const defRef = core_1.db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId);
    batch.set(defRef, header);
    for (const inst of instances) {
        // Strip undefined values so Firestore doesn't choke
        const clean = {};
        for (const [k, v] of Object.entries(inst)) {
            if (v !== undefined && v !== null && v !== '') {
                clean[k] = v;
            }
        }
        const instRef = defRef.collection('instances').doc(inst.seq);
        batch.set(instRef, clean);
    }
    await batch.commit();
    console.log(`[BLD] Wrote ${bldId} with ${instanceCount} instances (session=${sourceSessionId}, instance=${sourceInstanceId})`);
    return { bldId, instanceCount, buildSequence };
}
//# sourceMappingURL=bld-builder.js.map