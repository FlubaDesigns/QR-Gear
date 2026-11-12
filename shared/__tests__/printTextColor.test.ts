import { describe, expect, it } from 'vitest';
import { automaticPrintTextColor, relativeLuminance, normalizePrintHex, resolvePrintTextColor,
  resolvePrintTextStyle, masterPrintTextBackground, printTextContrastWarning } from '../printTextColor';
import { requireBuilderSnapshot, productGraphicOptions } from '../builderSnapshot';
import { masterCatalogProduct } from '../masterCatalog';
import { catalogToSelectItem } from '../adapters/catalog.adapter';

describe('shared physical text contrast', () => {
  it.each([['#000000','#FFFFFF'], ['#FFFFFF','#000000'], ['#FFFF00','#000000'], ['#000080','#FFFFFF'], ['#757575','#FFFFFF'], ['#767676','#000000']])('resolves %s to %s', (hex, expected) => {
    expect(automaticPrintTextColor({ hex })).toBe(expected);
  });
  it('chooses the stronger contrast throughout the RGB cube, including the crossover', () => {
    for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
      const hex = '#' + [r,g,b].map(n => n.toString(16).padStart(2,'0')).join('');
      const l = relativeLuminance(hex), chosen = automaticPrintTextColor({hex});
      const ratio = chosen === '#000000' ? (l + .05) / .05 : 1.05 / (l + .05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBe(Math.max((l + .05) / .05, 1.05 / (l + .05)));
    }
  });
  it('normalizes hex without accepting transparency or invented gray', () => {
    expect(normalizePrintHex(' #aBc ')).toBe('#AABBCC');
    for (const value of ['', '#ffffffff', 'navy', 'transparent', '#12', '#GGGGGG']) expect(normalizePrintHex(value)).toBeNull();
    expect(() => automaticPrintTextColor({ name: 'Unknown fabric', hex: '#CCCCCC', contrastHex: null })).toThrow('known product color');
    expect(() => automaticPrintTextColor()).toThrow('known product color');
    expect(automaticPrintTextColor({ name: 'Navy' })).toBe('#FFFFFF');
  });
  it('allows personal overrides, warns on poor contrast, and never rewrites image lettering or legacy colors', () => {
    const background = { hex: '#000000', textColorMode: 'light' as const };
    const style = { text: 'Example', enabled: true, color: '#f08080' };
    expect(resolvePrintTextColor(style, background)).toBe('#f08080');
    expect(resolvePrintTextColor({ ...style, colorMode: 'dark' }, background)).toBe('#000000');
    expect(printTextContrastWarning({ ...style, colorMode: 'dark' }, background)).toContain('difficult to read');
    expect(printTextContrastWarning({ ...style, colorMode: 'light' }, background)).toBeNull();
    const image = { ...style, colorMode: 'auto' as const, mode: 'image' };
    expect(resolvePrintTextStyle(image, { contrastHex: null })).toBe(image);
  });
  it('keeps exact blank/color exceptions canonical through catalog projection', () => {
    const raw = { qrgVariants: { '0401': { colorLabel: 'Black', sizeLabel: 'M' }, '0402': { colorLabel: 'Black Heather', sizeLabel: 'M' } },
      colors: [{ name: 'Black', hex: '#151515' }], printTextColorOverrides: { Black: 'dark' } };
    const master = masterCatalogProduct('qrg_11111', raw);
    const a = catalogToSelectItem(master, null, null, null, [{ name:'Black', hex:'#FFFFFF' }]);
    expect(a.availableColors[0]).toMatchObject({ hex: '#151515', contrastHex: '#151515', textColorMode:'dark' });
    expect(masterPrintTextBackground(raw, 'Black Heather').textColorMode).toBe('auto');
    expect(masterPrintTextBackground({ ...raw, printTextColorOverrides: {} }, 'Black').textColorMode).toBe('auto');
  });
  it('persists one resolved result without putting color policy in BLD or changing destination text', () => {
    const style = { text:'Printed', enabled:true, colorMode:'auto', color:'#000000' };
    const input = { graphics:{content:{graphicLayoutMode:'zone',headerStyle:style,footerStyle:style,subBottomStyle:style,titleStyle:{...style,text:'Website'}}},
      qrConfig:{selectedColor:{name:'Black',hex:'#000000'}}, layoutConfig:{selectedPlacements:['front']},metadata:{} };
    const saved = requireBuilderSnapshot(input), loaded = requireBuilderSnapshot(JSON.parse(JSON.stringify(saved)));
    expect(loaded.graphics.content.headerStyle).toMatchObject({colorMode:'auto',color:'#FFFFFF'});
    expect(loaded.graphics.content.subBottomStyle.color).toBe('#FFFFFF');
    expect(loaded.graphics.content.titleStyle).toEqual(input.graphics.content.titleStyle);
    expect(input.graphics.content.headerStyle.color).toBe('#000000');
    expect(JSON.stringify(loaded.bldDraft)).not.toMatch(/colorMode|#FFFFFF/);
    expect(productGraphicOptions(loaded,'https://example.test').qrColor).toBe('black');
    expect(productGraphicOptions(loaded,'https://example.test').headerStyle.color).toBe('#FFFFFF');
  });
});
