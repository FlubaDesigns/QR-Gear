import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/fontLoader', () => ({ loadGoogleFonts: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/features/shared/components/TextStyleEditor', () => ({ DEFAULT_FONT_SIZE_NUM: 18 }));
import { renderLandingPage } from '@/features/shared/graphics/landingPageRenderer';

describe('saved landing typography', () => {
  it('draws each block with its own weight and scaled spacing, resetting spacing for the next block', async () => {
    const drawn: any[] = [];
    const ctx: any = { font: '', letterSpacing: '0px', fillRect() {}, measureText: () => ({ width: 100 }),
      fillText(text: string) { drawn.push({ text, font: this.font, spacing: this.letterSpacing }); }, strokeText() {} };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx, toDataURL: () => 'data:image/png;base64,test' }) });
    try {
      await renderLandingPage({ textBlocks: [
        {text: 'MEANING', enabled: true, fontFamily: 'Oswald', fontSize: '19', fontWeight: '500', letterSpacing: 4, color: '#fff'},
        {text: 'ROLE', enabled: true, fontFamily: 'Oswald', fontSize: '22', fontWeight: '700', letterSpacing: 0, color: '#fff'},
      ] });
      expect(drawn).toEqual([
        {text: 'MEANING', font: '500 143px Oswald', spacing: '30px'},
        {text: 'ROLE', font: '700 165px Oswald', spacing: '0px'},
      ]);
    } finally { vi.unstubAllGlobals(); }
  });
});
