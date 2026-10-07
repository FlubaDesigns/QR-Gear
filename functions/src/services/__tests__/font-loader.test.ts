import { describe, it, expect, vi } from 'vitest';
import { createFontLoader } from '../font-loader';
function fixture() {
  const files = new Map<string, Buffer>(); const register = vi.fn();
  const resolveUrl = vi.fn().mockResolvedValue('https://example.com/font.ttf');
  const fetchBytes = vi.fn().mockResolvedValue(Buffer.from([0,1,0,0,1,2,3,4]));
  const loader = createFontLoader(register, { resolveUrl, fetchBytes, exists: path => files.has(String(path)), read: path => files.get(path)!, write: (path, bytes) => { files.set(path, bytes); }, remove: path => { files.delete(path); } });
  return { loader, register, resolveUrl, fetchBytes, files };
}
describe('Shared server font loading', () => {
  it('shares concurrent loads and registers a successful font once', async () => {
    const f = fixture(); expect(await Promise.all([f.loader('Oswald'), f.loader('Oswald')])).toEqual(['Oswald', 'Oswald']);
    await f.loader('Oswald'); expect(f.fetchBytes).toHaveBeenCalledOnce(); expect(f.register).toHaveBeenCalledOnce();
  });
  it('fails visibly and retries a failed download', async () => {
    const f = fixture(); f.fetchBytes.mockRejectedValueOnce(new Error('Offline'));
    await expect(f.loader('Oswald')).rejects.toThrow('Offline'); expect(f.register).not.toHaveBeenCalled();
    expect(await f.loader('Oswald')).toBe('Oswald'); expect(f.fetchBytes).toHaveBeenCalledTimes(2);
  });
  it('never marks invalid font bytes as loaded', async () => {
    const f = fixture(); f.fetchBytes.mockResolvedValueOnce(Buffer.from('not a font'));
    await expect(f.loader('Oswald')).rejects.toThrow('Invalid font file'); expect(f.files.size).toBe(0);
    expect(await f.loader('Oswald')).toBe('Oswald');
  });
  it('retries registration failures and retains device font names', async () => {
    const f = fixture(); f.register.mockImplementationOnce(() => { throw new Error('Canvas error'); });
    await expect(f.loader('Oswald')).rejects.toThrow('Canvas error'); expect(await f.loader('Oswald')).toBe('Oswald');
    expect(await f.loader('Tahoma')).toBe('Tahoma'); expect(f.fetchBytes).toHaveBeenCalledOnce();
  });
});
