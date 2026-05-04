"use strict";
/**
 * functions/src/services/qrg-instance-allocator.ts
 *
 * Single shared server-side QRG instance allocator.
 * ALL instance creation flows — admin (I), member (M), owner (O), external (E) —
 * must call allocateQrgInstance(). Nothing else may mint QRG identity.
 *
 * Final QRG formats:
 *   Base:    QRG-[STNNN]-[C]-[IIIIII]
 *   Variant: QRG-[STNNN]-[C]-[IIIIII]-[SSCC]
 *
 * Context codes:
 *   I = Internal (admin-created catalog instance)
 *   M = Member   (member library copy)
 *   E = External (API / partner)
 *   O = Owner    (post-purchase owner instance)
 *
 * Rules:
 *   - qrgBlankId must pass STNNN validation (S=1-6, T=1-9, NNN=000-999)
 *   - instanceNumber is atomically allocated — never hand-coded
 *   - variantCode/qrgFullCode are only set when size or color is supplied
 *   - No provider IDs, no build numbers, no fake fallback codes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateQrgInstance = allocateQrgInstance;
const core_1 = require("../core");
const qrgCodes_1 = require("../../../shared/qrgCodes");
const QRG_COUNTERS_COLLECTION = 'qrg_counters';
/**
 * Atomically allocate the next QRG instance for a given blank+context pair.
 *
 * @throws if qrgBlankId is not valid STNNN
 * @throws if context is not I, M, E, or O
 * @throws if Firestore transaction fails
 */
async function allocateQrgInstance(opts) {
    const { qrgBlankId, context, sizeLabel, colorLabel } = opts;
    if (!(0, qrgCodes_1.isValidQrgBlankId)(qrgBlankId)) {
        throw new Error(`[QRGAllocator] Invalid qrgBlankId: "${qrgBlankId}". ` +
            `Must be 5-digit STNNN (S=1-6, T=1-9, NNN=000-999).`);
    }
    if (!/^[IMEO]$/.test(context)) {
        throw new Error(`[QRGAllocator] Invalid context: "${context}". Must be I, M, E, or O.`);
    }
    const counterKey = `${qrgBlankId}_${context}`;
    const counterRef = core_1.db.collection(QRG_COUNTERS_COLLECTION).doc(counterKey);
    let num = 0;
    await core_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        if (!snap.exists) {
            num = 1;
            tx.set(counterRef, {
                lastInstanceNumber: 1,
                qrgBlankId,
                contextCode: context,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            num = (snap.data().lastInstanceNumber || 0) + 1;
            tx.update(counterRef, {
                lastInstanceNumber: num,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    const instanceNumber = String(num).padStart(6, '0');
    const qrgBaseCode = `QRG-${qrgBlankId}-${context}-${instanceNumber}`;
    let variantCode = null;
    let qrgFullCode = null;
    if (sizeLabel || colorLabel) {
        const ss = (0, qrgCodes_1.getSizeCode)(sizeLabel ?? '');
        const cc = (0, qrgCodes_1.getColorCode)(colorLabel ?? '');
        variantCode = `${ss}${cc}`;
        qrgFullCode = `${qrgBaseCode}-${variantCode}`;
    }
    return { qrgBlankId, qrgContext: context, instanceNumber, qrgBaseCode, variantCode, qrgFullCode };
}
//# sourceMappingURL=qrg-instance-allocator.js.map