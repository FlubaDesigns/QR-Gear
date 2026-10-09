import { DEFAULT_FONTS, FONT_SETTINGS, normalizeFontList } from '../../../shared/fonts';

/** One saved record and validation policy for both HTTP adapters. */
export function registerFontRoutes(app: any, prefix: string, auth: any, db: () => any) {
  const record = () => db().collection(FONT_SETTINGS.collection).doc(FONT_SETTINGS.document);
  app.get(`${prefix}/fonts`, async (_req: any, res: any) => {
    try {
      const doc = await record().get();
      res.json({ fonts: doc.exists ? normalizeFontList(doc.data()?.fonts) : [...DEFAULT_FONTS] });
    } catch (error: any) {
      console.error('[Fonts] Read failed:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
  app.put(`${prefix}/admin/fonts`, auth, async (req: any, res: any) => {
    let fonts: string[];
    try { fonts = normalizeFontList(req.body?.fonts); }
    catch (error: any) { res.status(400).json({ error: error.message }); return; }
    try {
      await record().set({ fonts, updatedAt: new Date().toISOString() });
      res.json({ success: true, fonts });
    } catch (error: any) {
      console.error('[Fonts] Save failed:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
