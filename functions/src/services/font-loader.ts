import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { SYSTEM_FONT_MAP } from '../../../shared/fonts';

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { 'User-Agent': 'qrgear-fonts/1.0' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Font download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}
async function resolveUrl(font: string): Promise<string> {
  const slug = font.replace(/\s+/g, '').toLowerCase();
  for (const license of ['ofl', 'apache', 'ufl']) {
    const response = await fetch(`https://api.github.com/repos/google/fonts/contents/${license}/${encodeURIComponent(slug)}`, { headers: { 'User-Agent': 'qrgear-fonts/1.0' }, signal: AbortSignal.timeout(20000) });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Font lookup failed (${response.status})`);
    const files = await response.json() as { name: string; download_url: string }[];
    if (!Array.isArray(files)) throw new Error('Invalid font catalog response');
    const ttf = files.filter(file => file.name.endsWith('.ttf'));
    const chosen = ttf.find(file => file.name.includes('[')) || ttf.find(file => file.name.includes('Regular')) || ttf[0];
    if (chosen?.download_url) return chosen.download_url;
  }
  throw new Error(`Font file unavailable: ${font}`);
}
const dependencies = {
  fetchBytes, resolveUrl,
  exists: fs.existsSync,
  read: (filename: string): Buffer => fs.readFileSync(filename),
  write: (filename: string, bytes: Buffer) => fs.writeFileSync(filename, bytes),
  remove: (filename: string) => fs.unlinkSync(filename),
};
const validFile = (bytes: Buffer) => ['00010000', '4f54544f', '74727565', '74797031'].includes(bytes.subarray(0, 4).toString('hex'));

/** Shared by development and Cloud Functions. Failed attempts are never cached as ready. */
export function createFontLoader(register: (filename: string, options: { family: string }) => void, overrides: Partial<typeof dependencies> = {}) {
  const deps = { ...dependencies, ...overrides };
  const loads = new Map<string, Promise<string>>();
  return function ensureFont(font: string): Promise<string> {
    if (Object.prototype.hasOwnProperty.call(SYSTEM_FONT_MAP, font)) return Promise.resolve(font);
    if (loads.has(font)) return loads.get(font)!;
    const filename = path.join('/tmp', `gfont_${createHash('sha256').update(font).digest('hex')}.ttf`);
    const pending = (async () => {
      if (deps.exists(filename) && !validFile(deps.read(filename))) deps.remove(filename);
      if (!deps.exists(filename)) {
        const bytes = await deps.fetchBytes(await deps.resolveUrl(font));
        if (!validFile(bytes)) throw new Error(`Invalid font file: ${font}`);
        deps.write(filename, bytes);
      }
      register(filename, { family: font });
      return font;
    })().catch(error => {
      loads.delete(font);
      console.error(`[Fonts] Could not load ${font}:`, error.message);
      throw new Error(`Could not load font ${font}: ${error.message}`);
    });
    loads.set(font, pending);
    return pending;
  };
}
