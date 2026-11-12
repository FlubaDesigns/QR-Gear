import { buildColorSizeFromDoc } from '../../../shared/masterCatalog';
import { isValidMasterCatalogDocId } from '../../../shared/qrgCodes';

/** One exact fabric exception, shared by every catalog that includes this blank. */
export async function saveMasterTextColor(database: any, id: string, input: any) {
  const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
  if (!isValidMasterCatalogDocId(id)) fail('Choose a canonical QRG blank.');
  if (!input || typeof input.colorName !== 'string' || !['auto', 'light', 'dark'].includes(input.mode)) fail('Choose Automatic, Light text or Dark text for a product color.');
  const ref = database.collection('master_catalog').doc(id);
  return database.runTransaction(async (tx: any) => {
    const doc = await tx.get(ref);
    if (!doc.exists) fail('Product not found.', 404);
    const master = doc.data();
    if (!buildColorSizeFromDoc(master).colorMap.some(c => c.colorName === input.colorName)) fail('This color does not belong to the selected blank.');
    const overrides = { ...master.printTextColorOverrides };
    if (input.mode === 'auto') delete overrides[input.colorName];
    else Object.defineProperty(overrides, input.colorName, { value: input.mode, enumerable: true, configurable: true, writable: true });
    tx.update(ref, { printTextColorOverrides: overrides, updatedAt: new Date().toISOString() });
    return { id, colorName: input.colorName, mode: input.mode };
  });
}
