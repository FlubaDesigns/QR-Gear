import { expect, it, vi } from 'vitest';
vi.mock('../pricing', () => ({
  withBrandLabel: (_master: unknown, snapshot: unknown) => snapshot,
  calculatePacketPricing: () => ({ baseProductCost: 15, customerPrice: 25, subtotal: 20 }),
}));
import { memberProductOptions } from '../member-product-options';
import { selectCatalogSaleVariant } from '../catalog-sale-variants';

function fixture(sizes: string[]) {
  const master = {
    qrgVariants: Object.fromEntries(sizes.map((sizeLabel, i) => [String(i), {
      sizeLabel, colorLabel: 'Black', providerVariants: { printful: { productId: 864, variantId: 22663 + i, inStock: true } },
    }])),
    qrgPrintSpecs: { printful: { locations: [{ id: 'front', provider: 'printful', dimensions: { widthPx: 1500, heightPx: 600 }, verifiedVariantIds: sizes.map((_, i) => 22663 + i) }] } },
  };
  const item = { availableColors: [{ name: 'Black' }], availableSizes: sizes };
  return { master, item };
}

it('keeps the advertised one-size cap selectable through the canonical builder validator', () => {
  const { master, item } = fixture(['One size']);
  const product = memberProductOptions(master, item, 'printful', { memberProfitShare: 0.25 });
  expect(product.availableSizes).toEqual(['ONE SIZE']);
  const selected = selectCatalogSaleVariant({ enabledColors: product.availableColors, enabledSizes: product.availableSizes }, master, product.fulfillmentProvider, product.availableVariants[0].size, 'Black');
  expect(selected.mapping.variantId).toBe(22663);
});

it('uses the same resolved size set for apparel, restrictions and unavailable variants', () => {
  const { master, item } = fixture(['M', 'XXL', 'XL']);
  master.qrgVariants['2'].providerVariants.printful.inStock = false;
  const product = memberProductOptions(master, item, 'printful', { memberProfitShare: 0.25 });
  expect(product.availableSizes).toEqual(['M', '2XL']);
  for (const variant of product.availableVariants) {
    expect(selectCatalogSaleVariant({ enabledColors: product.availableColors, enabledSizes: product.availableSizes }, master, 'printful', variant.size, variant.color)).toMatchObject(variant);
  }
  expect(memberProductOptions(master, { ...item, availableSizes: [] }, 'printful', {}).availableSizes).toEqual([]);
});
