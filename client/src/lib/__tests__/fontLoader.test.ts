import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
let links: any[], fontLoad: any;
beforeEach(() => {
  vi.resetModules(); links = []; fontLoad = vi.fn().mockResolvedValue([{}]);
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('document', { createElement: () => ({ remove: vi.fn() }), head: { appendChild: (link: any) => links.push(link) }, fonts: { load: fontLoad } });
});
afterEach(() => vi.unstubAllGlobals());
describe('Browser font readiness', () => {
  it('shares one request and waits for font bytes, not just the stylesheet', async () => {
    const { loadGoogleFont } = await import('@/lib/fontLoader'); let finish: any;
    fontLoad.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = loadGoogleFont('Oswald'); const second = loadGoogleFont('Oswald'); expect(links).toHaveLength(1);
    let done = false; first.then(() => { done = true; }); const loaded = links[0].onload(); await Promise.resolve(); expect(done).toBe(false);
    finish([{}]); await loaded; await Promise.all([first, second]); expect(done).toBe(true); expect(fontLoad).toHaveBeenCalledWith('16px "Oswald"');
  });
  it('surfaces network failure and allows the next load to retry', async () => {
    const { loadGoogleFont } = await import('@/lib/fontLoader'); const failed = loadGoogleFont('Oswald');
    links[0].onerror(); await expect(failed).rejects.toThrow('Could not load font: Oswald'); expect(links[0].remove).toHaveBeenCalled();
    const retry = loadGoogleFont('Oswald'); expect(links).toHaveLength(2); await links[1].onload(); await retry;
  });
  it('rejects a stylesheet without matching faces rather than accepting fallback text', async () => {
    const { loadGoogleFont } = await import('@/lib/fontLoader'); fontLoad.mockResolvedValue([]);
    const failed = loadGoogleFont('Oswald'); const rejection = expect(failed).rejects.toThrow('Could not load'); await links[0].onload(); await rejection;
  });
  it('keeps device fonts local', async () => { const { loadGoogleFonts } = await import('@/lib/fontLoader'); await loadGoogleFonts(['Arial', 'Tahoma', 'sans-serif']); expect(links).toHaveLength(0); });
});
