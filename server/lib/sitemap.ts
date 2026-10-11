import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Production and development use the same generated public discovery inventory. */
export async function generateSitemap(): Promise<string> {
  try { return await readFile(resolve('dist/public/sitemap.xml'), 'utf8'); }
  catch { return readFile(resolve('client/public/sitemap.xml'), 'utf8'); }
}
