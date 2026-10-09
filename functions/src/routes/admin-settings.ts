import Stripe from 'stripe';
import {createCoupon,updateCoupon} from '../services/coupons';
import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
import { printfulClient } from '../services/printful';
  import { printifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE } from '../services/printify';
  import { generateSignedUrl, addSignedUrlsToAssets, downloadAndStoreImage } from '../services/storage-helpers';
  import { calculateAuthoritativePrice, getAuthoritativePrice } from '../services/pricing';
  import { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS } from '../services/mockup-generator';
  import type { MockupRequest, MockupResult } from '../services/mockup-generator';
  import { getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulStoreId, PRINTFUL_API_BASE } from '../services/printful';
  import type { PrintfulMockupTask, PrintfulVariant } from '../services/printful';
  import { getResendClient, QR_GEAR_FROM_EMAIL } from '../services/email';
  import { cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE, getCanvas, getQRCode } from '../services/composite-image';

  export function register(app: express.Express): void {
  // ============ ADMIN PRICING RULES ============

app.get('/admin/pricing-rules', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('pricingRules').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/pricing-rules', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('pricingRules').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/pricing-rules/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('pricingRules').doc(req.params.id).update(req.body);
    const doc = await db.collection('pricingRules').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/pricing-rules/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('pricingRules').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ HOSTING TIERS (ADMIN) ============








// ============ GALLERY (ADMIN) ============

app.post('/admin/gallery', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('galleryItems').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/gallery/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('galleryItems').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ COUPONS (ADMIN) ============

app.get('/admin/coupons', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('coupons').get();
    res.json(docsToArray(snapshot).filter((row:any)=>!row.archived));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const stripeClient=()=>process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):undefined;
app.post('/admin/coupons',requireAdmin,async(req:Request,res:Response)=>{
 try{res.json(await createCoupon(db,req.body,stripeClient()));}catch(e:any){console.error('[Coupons]',e.message);res.status(e.status||400).json({error:e.message});}
});
app.put('/admin/coupons/:id',requireAdmin,async(req:Request,res:Response)=>{
 try{res.json(await updateCoupon(db,req.params.id,req.body,stripeClient()));}catch(e:any){res.status(e.status||400).json({error:e.message});}
});
app.delete('/admin/coupons/:id',requireAdmin,async(req:Request,res:Response)=>{
 try{await updateCoupon(db,req.params.id,{isActive:false},stripeClient());await db.collection('coupons').doc(req.params.id).update({archived:true});res.json({success:true});}
 catch(e:any){res.status(e.status||400).json({error:e.message});}
});
}
