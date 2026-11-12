import { expect, it } from 'vitest';
import { catalogToSelectItem } from '../adapters/catalog.adapter';

it('keeps an intentional empty catalog description and restores supplier copy only when absent', () => {
  const master = { docId: 'qrg_11111', title: 'Shirt', description: 'Supplier description' };
  for (const value of ['', '   ']) {
    expect(catalogToSelectItem(master, value)).toMatchObject({ description: '', adminCatalogDescription: '', providerDescription: 'Supplier description' });
  }
  for (const value of [null, undefined]) {
    expect(catalogToSelectItem(master, value)).toMatchObject({ description: 'Supplier description', adminCatalogDescription: null });
  }
  expect(catalogToSelectItem(master, 'Other store description').description).toBe('Other store description');
  expect(master.description).toBe('Supplier description');
});
