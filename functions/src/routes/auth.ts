import { resolveRuntimeConfig } from '../runtime-config';
import { registerAuthorizationEngineAuth } from './authorization-engine-auth';
import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS, MEMBER_FILE_COOKIE_OPTIONS, ALLOWED_ORIGINS } from '../middleware';
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
  registerAuthorizationEngineAuth(app, { db, auth: admin.auth(), ownerIds: ADMIN_USER_IDS, projectId: resolveRuntimeConfig().projectId, config: process.env.AUTHORIZATION_ENGINE_BROWSER });
  // ============ AUTH ENDPOINTS ============

app.post('/auth/member-file-session', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  res.set('Cache-Control', 'private, no-store');
  res.cookie('__session', req.headers.authorization!.slice(7), {
    ...MEMBER_FILE_COOKIE_OPTIONS, maxAge: Math.max(0, user.exp * 1000 - Date.now()),
  });
  res.sendStatus(204);
});

app.delete('/auth/member-file-session', (req: Request, res: Response): void => {
  res.set('Cache-Control', 'private, no-store');
  if (req.get('X-Requested-With') !== 'QR-Gear' || (req.headers.origin && !ALLOWED_ORIGINS.includes(req.headers.origin))) {
    res.status(403).json({ error: 'Invalid sign-out request.' }); return;
  }
  res.clearCookie('__session', MEMBER_FILE_COOKIE_OPTIONS);
  res.sendStatus(204);
});

app.post('/auth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
    });
    
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName: displayName || email.split('@')[0],
      isAdmin: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    res.json({ 
      success: true, 
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});


  }
