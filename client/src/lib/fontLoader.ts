import { SYSTEM_FONT_MAP } from '@shared/fonts';

const loads = new Map<string, Promise<void>>();
/** A failed load is removed so the next explicit attempt can retry it. */
export function loadGoogleFont(fontName: string): Promise<void> {
  if (Object.prototype.hasOwnProperty.call(SYSTEM_FONT_MAP, fontName)) return Promise.resolve();
  if (loads.has(fontName)) return loads.get(fontName)!;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}&display=swap`;
  const promise = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => fail(), 20000);
    const fail = () => { window.clearTimeout(timeout); reject(new Error(`Could not load font: ${fontName}`)); };
    link.onerror = fail;
    link.onload = async () => {
      try {
        const faces = await document.fonts.load(`16px ${JSON.stringify(fontName)}`);
        if (!faces.length) { fail(); return; }
        window.clearTimeout(timeout); resolve();
      } catch { fail(); }
    };
    document.head.appendChild(link);
  }).catch(error => { link.remove(); loads.delete(fontName); throw error; });
  loads.set(fontName, promise);
  return promise;
}
export async function loadGoogleFonts(fonts: string[]): Promise<void> {
  await Promise.all(Array.from(new Set(fonts)).map(loadGoogleFont));
}
