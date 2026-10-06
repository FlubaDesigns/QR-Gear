import { describe, it, expect } from 'vitest';
import { builderBldLayoutMode, extractBldInstances, formatBldId, isValidBldId, validateBldStructure } from '../../../../shared/bldCodes';

const structure = () => ({ context: 'S', layoutMode: 'Z', instances: [{ seq: '01', type: 'qrc' }] });

describe('shared BLD contract', () => {
  it('accepts only the five schema branches and bounded ID components', () => {
    for (const branch of ['SZ', 'SP', 'UI', 'UV', 'UD']) expect(isValidBldId(`BLD-${branch}9-999`)).toBe(true);
    for (const id of ['BLD-SI3-001', 'BLD-UZ3-001', 'BLD-SZ10-001', 'BLD-SZ1-000', 'BLD-SZ1-1000']) expect(isValidBldId(id)).toBe(false);
    expect(formatBldId('S', 'Z', 0, 1)).toBe('BLD-SZ0-001');
    expect(() => formatBldId('S', 'Z', 1, 1000)).toThrow();
  });

  it('rejects content and identities at both the document and slot boundaries', () => {
    for (const field of ['qrgBlankId', 'qrgBaseCode', 'packetId', 'layoutZones']) {
      expect(validateBldStructure({ ...structure(), [field]: 'not structure' })).toContain(field);
    }
    for (const field of ['text', 'value', 'color', 'imageUrl', 'grfId', 'source', 'packetId']) {
      expect(validateBldStructure({ ...structure(), instances: [{ seq: '01', type: 'txt', [field]: 'content' }] })).toContain(field);
    }
    expect(validateBldStructure({ context: 'U', layoutMode: 'I', instances: [{ seq: '01', type: 'act', required: false, url: 'https://example.com' }] })).toBeNull();
    expect(validateBldStructure({ ...structure(), instances: [{ seq: '01', type: 'qrc', url: 'https://example.com' }] })).toContain('only act');
  });

  it('rejects broken ordering, invalid types, mismatched counts and renamed identity payloads', () => {
    for (const instances of [[null], [{ seq: '02', type: 'qrc' }], [{ seq: '01', type: 'Q' }], [{ seq: '01', type: 'txt' }, { seq: '01', type: 'txt' }]]) {
      expect(validateBldStructure({ ...structure(), instances })).not.toBeNull();
    }
    expect(validateBldStructure({ ...structure(), instanceCount: 2 })).toContain('instanceCount');
    expect(validateBldStructure({ ...structure(), bldId: 'BLD-SZ2-001' })).toContain('ID');
    expect(validateBldStructure({ ...structure(), instances: [{ seq: '01', type: 'txt', fontSize: NaN }] })).toContain('finite');
    expect(validateBldStructure({ ...structure(), instances: [{ seq: '01', type: 'txt', fontFamily: { grfId: 'hidden' } }] })).toContain('string');
  });

  it('enforces context layouts, palette positions, optional actions, and the layer limit', () => {
    expect(validateBldStructure({ ...structure(), layoutMode: 'I' })).not.toBeNull();
    expect(validateBldStructure({ ...structure(), layoutMode: 'P' })).toContain('position');
    expect(validateBldStructure({ ...structure(), instances: [{ seq: '01', type: 'act', required: true }] })).toContain('optional');
    expect(validateBldStructure({ ...structure(), instances: Array.from({ length: 10 }, (_, i) => ({ seq: String(i + 1).padStart(2, '0'), type: 'txt' })) })).toContain('at most');
    expect(builderBldLayoutMode('')).toBeNull();
    expect(builderBldLayoutMode('unknown')).toBeNull();
  });

  it('extracts the same ordered structural slots without altering the content needed by Assembly', () => {
    const working = { graphics: { loadedBackground: { url: 'https://example.com/background.png' }, content: {
      graphicLayoutMode: 'freeform', qrSizePercent: 40, qrPositionX: 25, qrPositionY: 75,
      headerStyle: { enabled: true, text: 'Keep these words', color: '#fff', fontFamily: 'Oswald', fontSize: '28' },
      footerStyle: { enabled: true, text: 'Footer' },
      subBottomStyle: { enabled: true, text: 'Below QR' },
      landingTextBlocks: [{ enabled: true, text: 'Extra', imageUrl: 'https://example.com/private.png', color: '#000' }],
    } } };
    const before = JSON.stringify(working);
    const instances = extractBldInstances(working);
    expect(instances.map(s => [s.seq, s.type])).toEqual([['01', 'qrc'], ['02', 'txt'], ['03', 'txt'], ['04', 'txt']]);
    expect(instances[0]).toMatchObject({ size: 40, positionLR: 25, positionUD: 75 });
    expect(instances[1]).toMatchObject({ fontFamily: 'Oswald', fontSize: 28 });
    expect(validateBldStructure({ context: 'S', layoutMode: 'P', instances })).toBeNull();
    for (const slot of instances) for (const field of ['text', 'imageUrl', 'grfId', 'color']) expect(slot).not.toHaveProperty(field);
    expect(JSON.stringify(working)).toBe(before);
  });
});
