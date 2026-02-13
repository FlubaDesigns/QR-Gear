/**
 * Field Mapper - Field name translation layer for Firestore
 */

type FieldMap = Record<string, string>;

const PG_TO_FIRESTORE: FieldMap = {
  storage_path: 'storagePath',
  storage_url: 'storageUrl',
  public_url: 'publicUrl',
  proxy_url: 'proxyUrl',
  image_url: 'imageUrl',
  asset_type: 'assetType',
  source_asset_id: 'sourceAssetId',
  crop_data: 'cropData',
  is_active: 'isActive',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  mime_type: 'mimeType',
  thumbnail_url: 'thumbnailUrl',
  signed_url: 'signedUrl',
  thumbnail_signed_url: 'thumbnailSignedUrl',
  background_image_url: 'backgroundImageUrl',
  product_image: 'productImage',
};

const FIRESTORE_TO_PG: FieldMap = Object.fromEntries(
  Object.entries(PG_TO_FIRESTORE).map(([k, v]) => [v, k])
);

export function pgToFirestore(fieldName: string): string {
  return PG_TO_FIRESTORE[fieldName] || fieldName;
}

export function firestoreToPg(fieldName: string): string {
  return FIRESTORE_TO_PG[fieldName] || fieldName;
}

export function mapObjectPgToFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = pgToFirestore(key);
    result[newKey] = value;
  }
  return result;
}

export function mapObjectFirestoreToPg<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = firestoreToPg(key);
    result[newKey] = value;
  }
  return result;
}

export function mapArrayPgToFirestore<T extends Record<string, any>>(arr: T[]): Record<string, any>[] {
  return arr.map(mapObjectPgToFirestore);
}

export function mapArrayFirestoreToPg<T extends Record<string, any>>(arr: T[]): Record<string, any>[] {
  return arr.map(mapObjectFirestoreToPg);
}
