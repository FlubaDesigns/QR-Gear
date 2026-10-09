/** Apply the saved catalog selection to current fulfillment lookup results. */
export async function catalogColorOptions(db: any, catalogId: unknown, blankId: string, availableColors: Array<{ name: string; hex: string }>) {
  if (catalogId == null || catalogId === '' || catalogId === 'all') return availableColors;
  if (typeof catalogId !== 'string' || catalogId.includes('/')) throw new Error('Invalid catalog ID.');
  const doc = await db.collection('catalogs').doc(catalogId).get();
  const catalog = doc.data();
  if (!doc.exists || !catalog.blankIds?.includes(blankId)) throw new Error('This blank is no longer in the selected catalog. Choose it again from Blanks.');
  const selected = catalog.blankColors?.[blankId];
  if (!Array.isArray(selected)) return availableColors;
  const names = new Set(selected.map((c: any) => c.name));
  return availableColors.filter(color => names.has(color.name));
}
