import crypto from 'crypto';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateSegment(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

export function generateClaimCode(): string {
  return `QR-${generateSegment(4)}-${generateSegment(4)}`;
}

export async function generateUniqueClaimCode(db: FirebaseFirestore.Firestore): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateClaimCode();
    const existing = await db.collection('orders_public')
      .where('claimCode', '==', code)
      .limit(1)
      .get();
    if (existing.empty) {
      return code;
    }
    attempts++;
  }
  return `QR-${generateSegment(4)}-${generateSegment(4)}-${generateSegment(2)}`;
}
