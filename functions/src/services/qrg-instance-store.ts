/**
 * functions/src/services/qrg-instance-allocator.ts
 *
 * Single shared server-side QRG instance allocator.
 * ALL instance creation flows — admin (I), member (M), owner (O), external (E) —
 * must call allocateQrgInstanceRecord(). Nothing else may mint QRG identity.
 *
 * Final QRG formats:
 *   Base:    QRG-[STNNN]-[C]-[NNNNNN]
 *   Variant: QRG-[STNNN]-[C]-[NNNNNN]-[TSSLLCC]
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

import { isValidQrgBlankId, getSizeCode, getColorCode } from '../../../shared/qrgCodes';

const QRG_COUNTERS_COLLECTION = 'qrg_counters';

export type QrgContext = 'I' | 'M' | 'E' | 'O';

export interface QrgInstanceIdentity {
  /** 5-digit STNNN e.g. "11101" */
  qrgBlankId: string;
  /** I | M | E | O */
  qrgContext: QrgContext;
  /** 6-digit zero-padded e.g. "000001" */
  instanceNumber: string;
  /** QRG-[STNNN]-[C]-[NNNNNN] e.g. "QRG-11101-I-000001" */
  qrgBaseCode: string;
  /** [TSSLLCC] e.g. "1050001" — null when no size/color supplied */
  variantCode: string | null;
  /** QRG-[STNNN]-[C]-[NNNNNN]-[TSSLLCC] — null when no size/color supplied */
  qrgFullCode: string | null;
}

export interface AllocateQrgInstanceOptions {
  /** 5-digit STNNN from master_catalog document */
  qrgBlankId: string;
  /** I=Internal, M=Member, E=External, O=Owner */
  context: QrgContext;
  /** Human-readable size label e.g. "L", "XL" — optional */
  sizeLabel?: string | null;
  /** Human-readable color label e.g. "Black", "Navy" — optional */
  colorLabel?: string | null;
}

/**
 * Atomically allocate the next QRG instance for a given blank+context pair.
 *
 * @throws if qrgBlankId is not valid STNNN
 * @throws if context is not I, M, E, or O
 * @throws if Firestore transaction fails
 */
export async function allocateQrgInstanceRecord(
  db: any, now: () => unknown, opts: AllocateQrgInstanceOptions,
): Promise<QrgInstanceIdentity> {
  const { qrgBlankId, context, sizeLabel, colorLabel } = opts;

  if (!isValidQrgBlankId(qrgBlankId)) {
    throw new Error(
      `[QRGAllocator] Invalid qrgBlankId: "${qrgBlankId}". ` +
      `Must be 5-digit STNNN (S=1-6, T=1-9, NNN=000-999).`,
    );
  }
  if (!/^[IMEO]$/.test(context)) {
    throw new Error(
      `[QRGAllocator] Invalid context: "${context}". Must be I, M, E, or O.`,
    );
  }

  const counterKey = `${qrgBlankId}_${context}`;
  const counterRef = db.collection(QRG_COUNTERS_COLLECTION).doc(counterKey);
  let num = 0;

  await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      num = 1;
      tx.set(counterRef, {
        lastInstanceNumber: 1,
        qrgBlankId,
        contextCode: context,
        createdAt: now(),
      });
    } else {
      const current = snap.data()!.lastInstanceNumber;
      if (!Number.isInteger(current) || current < 0 || current >= 999999) throw new Error('Invalid or exhausted QRG instance counter.');
      num = current + 1;
      tx.update(counterRef, {
        lastInstanceNumber: num,
        updatedAt: now(),
      });
    }
  });

  const instanceNumber = String(num).padStart(6, '0');
  const qrgBaseCode = `QRG-${qrgBlankId}-${context}-${instanceNumber}`;

  let variantCode: string | null = null;
  let qrgFullCode: string | null = null;

  if (sizeLabel || colorLabel) {
    const tss = getSizeCode(sizeLabel ?? '');
    const ll  = '00'; // length not known at allocation time
    const cc  = getColorCode(colorLabel ?? '');
    variantCode = `${tss}${ll}${cc}`;
    qrgFullCode = `${qrgBaseCode}-${variantCode}`;
  }

  return { qrgBlankId, qrgContext: context, instanceNumber, qrgBaseCode, variantCode, qrgFullCode };
}
