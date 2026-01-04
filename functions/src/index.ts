import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

const app = express();

app.use((req: Request, res: Response, next: NextFunction): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// Normalize paths - handle both direct function calls and Firebase Hosting rewrites
// Direct: /products (no /api prefix)
// Hosting rewrite: /api/products (has /api prefix)
app.use((req: Request, _res: Response, next: NextFunction): void => {
  if (req.path.startsWith('/api/')) {
    req.url = req.url.replace('/api', '');
  }
  next();
});

async function verifyAuth(req: Request): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  (req as any).user = user;
  next();
}

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.data();
  const isAdmin = userData?.isAdmin || ADMIN_USER_IDS.includes(user.uid);
  
  if (!isAdmin) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  (req as any).user = user;
  next();
}

function docToObject(doc: FirebaseFirestore.DocumentSnapshot): any {
  if (!doc.exists) return null;
  const data = doc.data()!;
  Object.keys(data).forEach(key => {
    if (data[key] instanceof admin.firestore.Timestamp) {
      data[key] = data[key].toDate();
    }
  });
  return { ...data, id: doc.id };
}

function docsToArray(snapshot: FirebaseFirestore.QuerySnapshot): any[] {
  return snapshot.docs.map(doc => docToObject(doc));
}

// ============ PRINTFUL CLIENT (No Replit Dependencies) ============

const PRINTFUL_API_BASE = 'https://api.printful.com';

// Get Printful API key from environment variables
function getPrintfulApiKey(): string {
  return process.env.PRINTFUL_API_KEY || '';
}

interface PrintfulMockupTask {
  task_key: string;
  status: 'pending' | 'completed' | 'failed';
  mockups?: { placement: string; variant_ids: number[]; mockup_url: string; extra?: any[] }[];
  error?: string;
}

interface PrintfulVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  image: string;
  price: string;
  in_stock: boolean;
}

class PrintfulClient {
  private get headers() {
    return {
      'Authorization': `Bearer ${getPrintfulApiKey()}`,
      'Content-Type': 'application/json',
    };
  }

  get isConfigured(): boolean {
    const key = getPrintfulApiKey();
    return !!key && key.length > 10;
  }

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${PRINTFUL_API_BASE}${endpoint}`;
    const options: RequestInit = { method, headers: this.headers };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Printful API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return data.result as T;
  }

  async getProduct(productId: number): Promise<{ product: any; variants: PrintfulVariant[] }> {
    return this.request<{ product: any; variants: PrintfulVariant[] }>('GET', `/products/${productId}`);
  }

  async getPrintfiles(productId: number): Promise<any> {
    return this.request<any>('GET', `/mockup-generator/printfiles/${productId}`);
  }

  async getVariantsByColor(productId: number, colorName: string): Promise<PrintfulVariant[]> {
    const productData = await this.getProduct(productId);
    const lowerColor = colorName.toLowerCase().replace(/^solid\s+/i, '');
    return productData.variants.filter(v => 
      v.color.toLowerCase() === lowerColor || 
      v.color.toLowerCase().includes(lowerColor) ||
      v.name.toLowerCase().includes(lowerColor)
    );
  }

  async createMockupTask(
    productId: number,
    variantIds: number[],
    files: Array<{ placement: string; image_url: string; position?: any }>,
    format: 'jpg' | 'png' = 'jpg',
    optionGroups?: string[]
  ): Promise<PrintfulMockupTask> {
    const body: any = { variant_ids: variantIds, format, files };
    if (optionGroups?.length) body.option_groups = optionGroups;
    console.log('[Printful] Creating mockup task for product', productId);
    return this.request<PrintfulMockupTask>('POST', `/mockup-generator/create-task/${productId}`, body);
  }

  async getMockupTaskResult(taskKey: string): Promise<PrintfulMockupTask> {
    return this.request<PrintfulMockupTask>('GET', `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`);
  }

  async waitForMockupTask(taskKey: string, maxWaitMs: number = 60000): Promise<PrintfulMockupTask> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getMockupTaskResult(taskKey);
      if (result.status === 'completed') return result;
      if (result.status === 'failed') throw new Error(`Printful mockup failed: ${result.error}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Printful mockup task timed out after ${maxWaitMs}ms`);
  }
}

const printfulClient = new PrintfulClient();

// ============ COLOR LUMINANCE HELPERS ============

function isValidHexColor(hexColor: string | undefined | null): boolean {
  if (!hexColor) return false;
  const hex = hexColor.replace("#", "");
  return /^[0-9A-Fa-f]{6}$/.test(hex);
}

function isColorDark(hexColor: string | undefined | null): boolean {
  if (!isValidHexColor(hexColor)) return false;
  const hex = hexColor!.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance < 0.5;
}

// ============ FIREBASE STORAGE UPLOAD ============

async function downloadAndStoreImage(imageUrl: string, storagePath: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true,
    });
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    console.log(`[Storage] Uploaded to: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    console.error('[Storage] Upload failed:', error.message);
    return null;
  }
}

// ============ MOCKUP GENERATION (Full Implementation) ============

interface MockupRequest {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  colorHex?: string;
  artworkUrl: string;
  artworkVariant?: 'black' | 'white';
}

interface MockupResult {
  mockupUrl: string;
  lifestyleMockupUrl?: string | null;
  fromCache: boolean;
}

// Default Printify blueprint to Printful product mappings (fallback)
const DEFAULT_BLUEPRINT_MAPPINGS: Record<number, number> = {
  5: 71,      // Bella Canvas 3001 Unisex Jersey Tee
  6: 71,      // Gildan alternative
  145: 380,   // Heavyweight tee
  474: 71,    // Cotton Crew
};

// Look up Printful product ID from Firestore mapping or fallback
async function getPrintfulProductId(blueprintId: number): Promise<number | null> {
  // Check Firestore mapping first
  const mappingSnapshot = await db.collection('printifyPrintfulMapping')
    .where('printifyBlueprintId', '==', blueprintId)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  if (!mappingSnapshot.empty) {
    const mapping = mappingSnapshot.docs[0].data();
    return mapping.printfulProductId;
  }
  
  // Fallback to hardcoded defaults
  return DEFAULT_BLUEPRINT_MAPPINGS[blueprintId] || null;
}

async function generateMockupFromPrintful(request: MockupRequest): Promise<MockupResult> {
  const { blueprintId, colorName, colorHex, artworkUrl, artworkVariant = 'black' } = request;
  
  // Check Firestore cache first
  const cacheKey = `${blueprintId}_${colorName.replace(/\s+/g, '_')}_${artworkVariant}`;
  const cacheDoc = await db.collection('mockupCache').doc(cacheKey).get();
  
  if (cacheDoc.exists) {
    const cached = cacheDoc.data()!;
    if (cached.status === 'active' && cached.mockupUrl) {
      console.log(`[Mockup] Cache HIT: ${colorName}`);
      return {
        mockupUrl: cached.mockupUrl,
        lifestyleMockupUrl: cached.lifestyleMockupUrl,
        fromCache: true,
      };
    }
  }
  
  console.log(`[Mockup] Cache MISS: ${colorName} - generating via Printful`);
  
  if (!printfulClient.isConfigured) {
    throw new Error('Printful API key not configured');
  }
  
  // Map Printify blueprint to Printful product (from Firestore or fallback)
  const printfulProductId = await getPrintfulProductId(blueprintId);
  if (!printfulProductId) {
    throw new Error(`No Printful mapping for blueprint ${blueprintId}. Add mapping to printifyPrintfulMapping collection.`);
  }
  
  // Get variants for this color
  const variants = await printfulClient.getVariantsByColor(printfulProductId, colorName);
  if (variants.length === 0) {
    throw new Error(`No Printful variants found for color: ${colorName}`);
  }
  
  const variantId = variants[0].id;
  
  // Get printfile specs
  const printfileData = await printfulClient.getPrintfiles(printfulProductId);
  const frontPrintfile = printfileData?.printfiles?.find((p: any) => 
    p.placement === 'front' || p.placement === 'default'
  );
  
  // Create mockup task
  const task = await printfulClient.createMockupTask(
    printfulProductId,
    [variantId],
    [{ placement: 'front', image_url: artworkUrl }],
    'jpg',
    ['Lifestyle']
  );
  
  // Wait for completion
  const result = await printfulClient.waitForMockupTask(task.task_key, 90000);
  
  if (!result.mockups || result.mockups.length === 0) {
    throw new Error('No mockups returned from Printful');
  }
  
  // Find flat and lifestyle mockups
  let flatMockup = result.mockups.find(m => !m.placement.includes('lifestyle'));
  let lifestyleMockup = result.mockups.find(m => m.placement.includes('lifestyle'));
  
  if (!flatMockup) flatMockup = result.mockups[0];
  
  // Download and store in Firebase Storage
  const timestamp = Date.now();
  const storagePath = `mockups/${blueprintId}/${colorName.replace(/\s+/g, '_')}_${artworkVariant}_${timestamp}.jpg`;
  const permanentUrl = await downloadAndStoreImage(flatMockup.mockup_url, storagePath);
  
  let lifestyleUrl: string | null = null;
  if (lifestyleMockup) {
    const lifestylePath = `mockups/${blueprintId}/${colorName.replace(/\s+/g, '_')}_${artworkVariant}_lifestyle_${timestamp}.jpg`;
    lifestyleUrl = await downloadAndStoreImage(lifestyleMockup.mockup_url, lifestylePath);
  }
  
  // Cache in Firestore
  await db.collection('mockupCache').doc(cacheKey).set({
    blueprintId,
    colorName,
    artworkVariant,
    mockupUrl: permanentUrl || flatMockup.mockup_url,
    lifestyleMockupUrl: lifestyleUrl,
    status: 'active',
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return {
    mockupUrl: permanentUrl || flatMockup.mockup_url,
    lifestyleMockupUrl: lifestyleUrl,
    fromCache: false,
  };
}

app.get('/health', (_req: Request, res: Response): void => {
  res.json({ 
    status: 'ok', 
    mode: 'firebase-functions', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const featured = req.query.featured === 'true';
    let query: FirebaseFirestore.Query = db.collection('products').where('isEnabled', '==', true);
    if (featured) {
      query = query.where('isFeatured', '==', true);
    }
    const snapshot = await query.get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/designs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Design not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/user', async (req: Request, res: Response): Promise<void> => {
  try {
    const decodedToken = await verifyAuth(req);
    if (!decodedToken) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      const newUser = {
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email?.split('@')[0],
        isAdmin: ADMIN_USER_IDS.includes(decodedToken.uid),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(decodedToken.uid).set(newUser);
      res.json({ ...newUser, id: decodedToken.uid });
      return;
    }

    res.json(docToObject(userDoc));
  } catch (error: any) {
    res.status(401).json({ message: 'Unauthorized', error: error.message });
  }
});

app.get('/cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('cartItems').add({
      ...req.body,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/cart/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { quantity } = req.body;
    await db.collection('cartItems').doc(req.params.id).update({ quantity });
    const doc = await db.collection('cartItems').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/cart/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('cartItems').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('orders')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/orders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('orders').add({
      ...req.body,
      userId,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/qr-templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('qrTemplates').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/qr-templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('qrTemplates').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'QR Template not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/hosting-tiers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('hostingTiers').orderBy('sortOrder', 'asc').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stores/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores')
      .where('slug', '==', req.params.slug)
      .limit(1)
      .get();
    if (snapshot.empty) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    res.json(docToObject(snapshot.docs[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stripe/publishable-key', async (_req: Request, res: Response): Promise<void> => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    res.status(500).json({ error: 'Stripe not configured' });
    return;
  }
  res.json({ publishableKey: key });
});

app.post('/checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const userId = (req as any).user.uid;
    const { items, successUrl, cancelUrl } = req.body;

    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : [],
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl || `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin}/cart`,
      metadata: {
        userId,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/checkout/embedded', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const userId = (req as any).user.uid;
    const { returnUrl } = req.body;

    const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    
    if (cartSnapshot.empty) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    const cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lineItems = cartItems.map((item: any) => {
      const customization = item.customization || {};
      const productName = customization.productName || 'Custom QR Product';
      const productImage = customization.productImage;
      const price = parseFloat(item.price);
      
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for item: ${productName}`);
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            images: productImage ? [productImage] : [],
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: item.quantity || 1,
      };
    });

    const cartItemIds = cartItems.map((item: any) => item.id);

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      return_url: returnUrl || `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId,
        cartItemIds: JSON.stringify(cartItemIds),
      },
    });

    res.json({ clientSecret: session.client_secret });
  } catch (error: any) {
    console.error('Embedded checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/checkout/session-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const sessionId = req.query.session_id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'session_id is required' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/checkout/verify/:sessionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    
    res.json({
      status: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/gallery', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('qrDesigns')
      .where('isPublic', '==', true)
      .limit(50)
      .get();
    const items = docsToArray(snapshot);
    items.sort((a: any, b: any) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/files/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const bucket = storage.bucket();
    const file = bucket.file(`custom-designs/${filename}`);
    
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    file.createReadStream().pipe(res);
  } catch (error: any) {
    console.error('File serving error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/library-files/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const bucket = storage.bucket();
    const file = bucket.file(`library/${filename}`);
    
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    file.createReadStream().pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/settings', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/settings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('settings').doc('admin').set(req.body, { merge: true });
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.data());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/products', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('products').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = req.body.id || `product_${Date.now()}`;
    await db.collection('products').doc(productId).set({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('products').doc(productId).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('products').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('products').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/products/:id/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const current = doc.data()!.isEnabled || false;
    await db.collection('products').doc(req.params.id).update({
      isEnabled: !current,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const updated = await db.collection('products').doc(req.params.id).get();
    res.json(docToObject(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('products').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/orders', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/orders/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('orders').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('orders').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/users', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('users').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('productCategories').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/browsing-history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('browsingHistory')
      .where('userId', '==', userId)
      .orderBy('viewedAt', 'desc')
      .limit(20)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/browsing-history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('browsingHistory').add({
      ...req.body,
      userId,
      viewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/coupons/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('coupons')
      .where('code', '==', req.params.code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      res.status(404).json({ error: 'Coupon not found or expired' });
      return;
    }
    
    const coupon = docToObject(snapshot.docs[0]);
    
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      res.status(400).json({ error: 'Coupon has expired' });
      return;
    }
    
    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
      res.status(400).json({ error: 'Coupon has reached maximum redemptions' });
      return;
    }
    
    res.json(coupon);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WIDGET API ============

import * as jwt from 'jsonwebtoken';

// Secrets must be configured via Firebase Functions config or environment variables
// These will NOT work without proper configuration
const WIDGET_JWT_SECRET = process.env.WIDGET_JWT_SECRET;
const WIDGET_API_KEY = process.env.WIDGET_API_KEY;

function signWidgetToken(payload: any): string {
  if (!WIDGET_JWT_SECRET) {
    throw new Error('WIDGET_JWT_SECRET not configured');
  }
  return jwt.sign(payload, WIDGET_JWT_SECRET, { expiresIn: '1h' });
}

function verifyWidgetToken(token: string): any {
  try {
    if (!WIDGET_JWT_SECRET) {
      return null;
    }
    return jwt.verify(token, WIDGET_JWT_SECRET);
  } catch {
    return null;
  }
}

app.get('/widget/session', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }

    const payload = verifyWidgetToken(token);
    
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const snapshot = await db.collection('products')
      .where('isEnabled', '==', true)
      .limit(6)
      .get();
    
    const featuredProducts = snapshot.docs.map(doc => {
      const p = doc.data();
      return {
        id: doc.id,
        name: p.name,
        imageUrl: p.imageUrl || '',
        basePrice: p.basePrice,
        category: p.category,
      };
    });

    res.json({
      businessName: payload.businessName,
      businessLogoUrl: payload.businessLogoUrl,
      kcListingUrl: payload.kcListingUrl,
      products: featuredProducts,
    });
  } catch (error: any) {
    console.error('Widget session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/widget/token', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] || (req.headers['authorization'] as string)?.replace('Bearer ', '');
    
    if (!WIDGET_API_KEY || apiKey !== WIDGET_API_KEY) {
      res.status(401).json({ error: 'Invalid or missing API key' });
      return;
    }

    const { businessName, businessLogoUrl, kcListingUrl } = req.body;
    
    if (!businessName || !kcListingUrl) {
      res.status(400).json({ error: 'businessName and kcListingUrl are required' });
      return;
    }

    const token = signWidgetToken({ businessName, businessLogoUrl, kcListingUrl });
    
    res.json({ 
      token,
      expiresIn: 3600
    });
  } catch (error: any) {
    console.error('Widget token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PARTNER API ============

app.get('/partner/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!WIDGET_API_KEY || apiKey !== WIDGET_API_KEY) {
      res.status(401).json({ error: 'Invalid or missing API key' });
      return;
    }
    
    const { partnerId } = req.query;
    
    if (!partnerId || typeof partnerId !== 'string') {
      res.status(400).json({ error: 'partnerId query parameter required' });
      return;
    }
    
    const storeSnapshot = await db.collection('partnerStores')
      .where('slug', '==', partnerId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (storeSnapshot.empty) {
      res.status(404).json({ error: 'Partner not found or inactive' });
      return;
    }
    
    const store = storeSnapshot.docs[0];
    const storeData = store.data();
    
    const productsSnapshot = await db.collection('partnerStoreProducts')
      .where('storeId', '==', store.id)
      .where('isEnabled', '==', true)
      .get();
    
    const products = await Promise.all(
      productsSnapshot.docs.map(async (spDoc) => {
        const sp = spDoc.data();
        const productDoc = await db.collection('products').doc(sp.productId).get();
        if (!productDoc.exists) return null;
        const product = productDoc.data()!;
        
        return {
          id: productDoc.id,
          blueprintId: product.blueprintId,
          name: sp.customName || product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          basePrice: sp.customPrice || product.basePrice,
          category: product.category,
          kcBusinessSlug: sp.kcBusinessSlug,
          sortOrder: sp.sortOrder,
        };
      })
    );
    
    res.json({
      store: { id: store.id, name: storeData.name, slug: storeData.slug },
      products: products.filter(Boolean),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STOREFRONT MOCKUP GENERATION ============

app.post('/storefront/generate-mockup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, color, qrSize, qrSizePercent } = req.body;
    
    if (!productId || !color) {
      res.status(400).json({ error: 'productId and color are required' });
      return;
    }
    
    let resolvedQrSize: 'small' | 'medium' | 'large' = 'medium';
    if (qrSize && ['small', 'medium', 'large'].includes(qrSize)) {
      resolvedQrSize = qrSize;
    } else if (qrSizePercent) {
      if (qrSizePercent <= 30) resolvedQrSize = 'small';
      else if (qrSizePercent <= 50) resolvedQrSize = 'medium';
      else resolvedQrSize = 'large';
    }
    
    const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
    const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
    
    const productDoc = await db.collection('products').doc(canonicalProductId).get();
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    const existingMockups = (product.mockupsByColor as Record<string, any>) || {};
    const normalizeColor = (c: string) => c.toLowerCase().trim();
    const requestColorNorm = normalizeColor(color);
    
    let existingMockup: any = null;
    let matchedColorKey: string = color;
    
    for (const [storedColor, mockup] of Object.entries(existingMockups)) {
      if (normalizeColor(storedColor) === requestColorNorm && mockup && (mockup as any).front) {
        existingMockup = mockup;
        matchedColorKey = storedColor;
        break;
      }
    }
    
    if (existingMockup && existingMockup.front) {
      const defaultImage = existingMockup.lifestyle || existingMockup.front;
      await db.collection('products').doc(canonicalProductId).update({
        defaultColor: matchedColorKey,
        imageUrl: defaultImage,
      });
      
      res.json({ 
        success: true, 
        color, 
        mockupUrl: existingMockup.front,
        lifestyleMockupUrl: existingMockup.lifestyle || null,
        fromCache: true,
        mockupsByColor: existingMockups 
      });
      return;
    }
    
    const designDoc = await db.collection('customDesigns').doc(designId).get();
    if (!designDoc.exists) {
      res.status(404).json({ error: 'Design not found' });
      return;
    }
    
    const design = designDoc.data()!;
    let designPlacements: Record<string, string> = {};
    try {
      if (typeof design.placementImages === 'string') {
        designPlacements = JSON.parse(design.placementImages);
      } else if (design.placementImages && typeof design.placementImages === 'object') {
        designPlacements = design.placementImages as Record<string, string>;
      }
    } catch (e) {
      console.error('[StorefrontMockup] Failed to parse placementImages:', e);
    }
    
    let colorHex: string | null = null;
    if (product.availableColors && Array.isArray(product.availableColors)) {
      const colorInfo = (product.availableColors as any[]).find(
        (c: any) => c.name?.toLowerCase() === color.toLowerCase()
      );
      colorHex = colorInfo?.hex || null;
    }
    
    const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
    
    const blackArtwork = designPlacements['front-chest'] || 
                         designPlacements['front-chest-black'] || 
                         designPlacements['front-center'] ||
                         designPlacements['front'];
    const whiteArtwork = designPlacements['front-chest-white'] || 
                         designPlacements['front-center-white'] ||
                         designPlacements['front-white'];
    
    let artworkUrl: string;
    let artworkVariant: 'black' | 'white' = 'black';
    
    if (needsWhiteQR && whiteArtwork) {
      artworkUrl = whiteArtwork;
      artworkVariant = 'white';
    } else if (blackArtwork) {
      artworkUrl = blackArtwork;
      artworkVariant = 'black';
    } else {
      artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0] as string;
    }
    
    // Generate mockup via Printful if not cached
    if (!printfulClient.isConfigured) {
      res.status(404).json({ 
        error: `No mockup available for ${color}. Printful API key not configured.`,
        color 
      });
      return;
    }
    
    try {
      console.log(`[StorefrontMockup] Generating mockup for ${color} via Printful...`);
      const mockupResult = await generateMockupFromPrintful({
        blueprintId: product.blueprintId,
        printProviderId: product.printProviderId || 0,
        colorName: color,
        colorHex: colorHex || undefined,
        artworkUrl,
        artworkVariant,
      });
      
      // Update product with new mockup
      const updatedMockups = {
        ...existingMockups,
        [color]: {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
        },
      };
      
      const defaultImage = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
      await db.collection('products').doc(canonicalProductId).update({
        mockupsByColor: updatedMockups,
        defaultColor: color,
        imageUrl: defaultImage,
      });
      
      res.json({
        success: true,
        color,
        mockupUrl: mockupResult.mockupUrl,
        lifestyleMockupUrl: mockupResult.lifestyleMockupUrl,
        fromCache: mockupResult.fromCache,
        mockupsByColor: updatedMockups,
      });
    } catch (genError: any) {
      console.error(`[StorefrontMockup] Printful generation failed:`, genError.message);
      res.status(500).json({ 
        error: `Failed to generate mockup for ${color}: ${genError.message}`,
        color 
      });
    }
  } catch (error: any) {
    console.error('[StorefrontMockup] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MOCKUP API ============

app.get('/placements', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('canonicalPlacements').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mockups/get-or-generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      blueprintId, 
      printProviderId, 
      colorName, 
      colorHex,
      canonicalPlacementId = 'FRONT_CHEST',
      artworkUrl,
      artworkVariant = 'black'
    } = req.body;

    if (!blueprintId || !printProviderId || !colorName || !artworkUrl) {
      res.status(400).json({ 
        error: 'Missing required fields: blueprintId, printProviderId, colorName, artworkUrl' 
      });
      return;
    }

    const cacheKey = `${blueprintId}-${printProviderId}-${colorName}-${canonicalPlacementId}-${artworkVariant}`;
    const cacheSnapshot = await db.collection('mockupCache')
      .where('cacheKey', '==', cacheKey)
      .limit(1)
      .get();
    
    if (!cacheSnapshot.empty) {
      const cached = cacheSnapshot.docs[0].data();
      res.json({
        success: true,
        mockupUrl: cached.mockupUrl,
        lifestyleUrl: cached.lifestyleUrl,
        fromCache: true,
      });
      return;
    }
    
    // Generate via Printful if not in cache
    if (!printfulClient.isConfigured) {
      res.json({
        success: false,
        message: 'Mockup not in cache and Printful API key not configured.',
        fromCache: false,
      });
      return;
    }
    
    try {
      const mockupResult = await generateMockupFromPrintful({
        blueprintId,
        printProviderId,
        colorName,
        colorHex,
        artworkUrl,
        artworkVariant: artworkVariant as 'black' | 'white',
      });
      
      res.json({
        success: true,
        mockupUrl: mockupResult.mockupUrl,
        lifestyleUrl: mockupResult.lifestyleMockupUrl,
        fromCache: mockupResult.fromCache,
      });
    } catch (genError: any) {
      res.status(500).json({
        success: false,
        error: genError.message,
        fromCache: false,
      });
    }
  } catch (error: any) {
    console.error('[MockupAPI] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mockups/cached/:blueprintId/:printProviderId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId } = req.params;
    
    const snapshot = await db.collection('mockupCache')
      .where('blueprintId', '==', parseInt(blueprintId))
      .where('printProviderId', '==', parseInt(printProviderId))
      .get();
    
    const mockups: Record<string, any> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!mockups[data.colorName]) {
        mockups[data.colorName] = {};
      }
      mockups[data.colorName][data.placementId] = {
        mockupUrl: data.mockupUrl,
        lifestyleUrl: data.lifestyleUrl,
      };
    });

    res.json({ mockups, count: Object.keys(mockups).length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DESIGNS CRUD ============

app.get('/designs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('customDesigns')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/designs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('customDesigns').add({
      ...req.body,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/designs/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/designs/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCT CATEGORIES ============

app.get('/product-categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('productCategories')
      .orderBy('sortOrder')
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/product-categories/:id/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const mappingSnapshot = await db.collection('productCategoryMappings')
      .where('categoryId', '==', req.params.id)
      .get();
    
    const productIds = mappingSnapshot.docs.map(d => d.data().productId);
    
    if (productIds.length === 0) {
      res.json([]);
      return;
    }
    
    const products = await Promise.all(
      productIds.map(async (id: string) => {
        const doc = await db.collection('products').doc(id).get();
        return doc.exists ? docToObject(doc) : null;
      })
    );
    
    res.json(products.filter(Boolean));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN PRODUCT CATEGORIES ============

app.post('/admin/product-categories', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('productCategories').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/product-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('productCategories').doc(req.params.id).update(req.body);
    const doc = await db.collection('productCategories').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/product-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('productCategories').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ AUTH ENDPOINTS ============

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

// ============ ADMIN PARTNER STORES ============

app.get('/admin/partner-stores', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/partner-stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('partnerStores').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('partnerStores').doc(req.params.id).update(req.body);
    const doc = await db.collection('partnerStores').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('partnerStores').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/partner-stores/:id/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStoreProducts')
      .where('storeId', '==', req.params.id)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/partner-stores/:id/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('partnerStoreProducts').add({
      ...req.body,
      storeId: req.params.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ QR GENERATION ============

app.post('/qr/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, color, backgroundColor, size, format } = req.body;
    
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    
    res.json({
      success: true,
      message: 'QR generation endpoint - use client-side QR library for immediate generation',
      content,
      options: { color, backgroundColor, size, format },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STORES (PUBLIC) ============

app.get('/stores', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores')
      .where('isActive', '==', true)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ FILE UPLOAD (Firebase Storage) ============

app.post('/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    res.json({
      success: false,
      message: 'File uploads should be done directly to Firebase Storage from the client using Firebase SDK',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN MOCKUP REGENERATION ============

app.post('/admin/products/:id/regenerate-mockups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { color } = req.body;
    
    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    if (!product.blueprintId) {
      res.status(400).json({ error: 'Product missing blueprint info' });
      return;
    }
    
    if (!printfulClient.isConfigured) {
      res.status(500).json({ error: 'Printful API key not configured' });
      return;
    }
    
    const metadata = product.metadata as { customDesignId?: string } | null;
    const designId = metadata?.customDesignId || id.replace('custom_', '');
    
    const designDoc = await db.collection('customDesigns').doc(designId).get();
    if (!designDoc.exists) {
      res.status(404).json({ error: 'Custom design not found' });
      return;
    }
    
    const design = designDoc.data()!;
    let designPlacements: Record<string, string> = {};
    if (typeof design.placementImages === 'object') {
      designPlacements = design.placementImages as Record<string, string>;
    }
    
    const blackArtwork = designPlacements['front-chest'] || designPlacements['front'];
    const whiteArtwork = designPlacements['front-chest-white'];
    
    // Get colors to regenerate
    const allColors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
    const colorsToProcess = color ? allColors.filter(c => c.name === color) : allColors;
    
    if (colorsToProcess.length === 0) {
      res.status(400).json({ error: 'No colors to process' });
      return;
    }
    
    const results: any[] = [];
    const mockupsByColor: Record<string, any> = product.mockupsByColor || {};
    
    for (const colorInfo of colorsToProcess) {
      try {
        const needsWhiteQR = isColorDark(colorInfo.hex);
        const artworkUrl = (needsWhiteQR && whiteArtwork) ? whiteArtwork : blackArtwork;
        const artworkVariant = (needsWhiteQR && whiteArtwork) ? 'white' as const : 'black' as const;
        
        const mockupResult = await generateMockupFromPrintful({
          blueprintId: product.blueprintId,
          printProviderId: product.printProviderId || 0,
          colorName: colorInfo.name,
          colorHex: colorInfo.hex,
          artworkUrl,
          artworkVariant,
        });
        
        mockupsByColor[colorInfo.name] = {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
        };
        
        results.push({ color: colorInfo.name, success: true, mockupUrl: mockupResult.mockupUrl });
        
        // Rate limit between colors
        if (colorsToProcess.indexOf(colorInfo) < colorsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err: any) {
        results.push({ color: colorInfo.name, success: false, error: err.message });
      }
    }
    
    // Update product with new mockups
    await db.collection('products').doc(id).update({ mockupsByColor });
    
    res.json({
      success: true,
      message: `Regenerated mockups for ${results.filter(r => r.success).length}/${colorsToProcess.length} colors`,
      results,
      mockupsByColor,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/products/:id/generate-all-mockups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productDoc = await db.collection('products').doc(id).get();
    
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    const allColors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
    
    if (allColors.length === 0) {
      res.status(400).json({ error: 'No colors available for this product' });
      return;
    }
    
    if (!printfulClient.isConfigured) {
      res.status(500).json({ error: 'Printful API key not configured' });
      return;
    }
    
    // Start generation in background (respond immediately for long operations)
    res.json({
      success: true,
      message: `Mockup generation started for ${allColors.length} colors. Use regenerate-mockups endpoint for synchronous generation.`,
      productId: id,
      colors: allColors.map((c: any) => c.name),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN PRODUCT VARIANTS ============

app.get('/admin/products/:id/variants', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection('productVariants')
      .where('productId', '==', id)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/variants/:id/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const doc = await db.collection('productVariants').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }
    const current = doc.data()!;
    await db.collection('productVariants').doc(id).update({
      isEnabled: !current.isEnabled,
    });
    const updated = await db.collection('productVariants').doc(id).get();
    res.json(docToObject(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN CATALOG ============

app.get('/admin/catalog/blueprints', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('printifyBlueprints').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog/blueprints/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('printifyBlueprints').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CUSTOM DESIGNS (ADMIN) ============

app.get('/admin/designs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('customDesigns')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/designs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('customDesigns').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ QR TEMPLATES ============

app.post('/admin/qr-templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('qrTemplates').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/qr-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('qrTemplates').doc(req.params.id).update(req.body);
    const doc = await db.collection('qrTemplates').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/qr-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('qrTemplates').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HOSTING TIERS (ADMIN) ============

app.post('/admin/hosting-tiers', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('hostingTiers').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/hosting-tiers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('hostingTiers').doc(req.params.id).update(req.body);
    const doc = await db.collection('hostingTiers').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/hosting-tiers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('hostingTiers').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/coupons', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('coupons').add({
      ...req.body,
      redemptionCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/coupons/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('coupons').doc(req.params.id).update(req.body);
    const doc = await db.collection('coupons').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/coupons/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('coupons').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GIFT PACKAGES (ADMIN) ============

app.get('/admin/gift-packages', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('giftPackages').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/gift-packages', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('giftPackages').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/gift-packages/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('giftPackages').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GIFT CODES (ADMIN) ============

app.get('/admin/gift-codes', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('giftCodes').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/gift-codes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('giftCodes').add({
      ...req.body,
      isRedeemed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/gift-codes/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('giftCodes').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PUBLIC GIFT CODE VALIDATION ============

app.get('/gift-codes/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('giftCodes')
      .where('code', '==', req.params.code.toUpperCase())
      .where('isRedeemed', '==', false)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      res.status(404).json({ error: 'Gift code not found or already redeemed' });
      return;
    }
    
    const giftCode = docToObject(snapshot.docs[0]);
    
    if (giftCode.expiresAt && new Date(giftCode.expiresAt) < new Date()) {
      res.status(400).json({ error: 'Gift code has expired' });
      return;
    }
    
    res.json(giftCode);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRINTIFY STATUS ============

app.get('/printify/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ 
      connected: true, 
      mode: 'firebase-functions',
      message: 'Printify integration is configured on the primary server'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STRIPE WEBHOOKS ============

app.post('/webhooks/stripe', async (req: Request, res: Response): Promise<void> => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!sig || !webhookSecret) {
      res.status(400).json({ error: 'Missing signature or webhook secret' });
      return;
    }
    
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }
    
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export the API function
export const api = functions.https.onRequest(app);
