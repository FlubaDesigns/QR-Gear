import { RequestHandler, Express } from "express";
import session from "express-session";
import { getAuth } from "firebase-admin/auth";
import { initializeFirebase, isFirebaseInitialized } from "./lib/firebase-admin";
import { storage } from "./storage";
import MemoryStore from "memorystore";

function ensureFirebaseInitialized() {
  if (!isFirebaseInitialized()) {
    initializeFirebase();
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const MemStore = MemoryStore(session);
  
  return session({
    secret: process.env.SESSION_SECRET || 'qrgear-session-secret-change-in-production',
    store: new MemStore({
      checkPeriod: 86400000, // 24 hours
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims.uid,
    email: claims.email || '',
    firstName: claims.name?.split(' ')[0] || '',
    lastName: claims.name?.split(' ').slice(1).join(' ') || '',
    profileImageUrl: claims.picture || '',
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  ensureFirebaseInitialized();
  
  // Firebase Auth token verification middleware
  app.use('/api', async (req: any, res, next) => {
    // Skip auth for public endpoints
    const publicPaths = [
      '/api/health',
      '/api/products',
      '/api/storefront',
      '/api/widget',
      '/api/qr',
      '/api/files',
      '/api/library-files',
      '/api/stripe/webhook',
    ];
    
    const isPublic = publicPaths.some(path => req.path.startsWith(path.replace('/api', '')));
    if (isPublic) {
      return next();
    }
    
    // Check for session first
    if (req.session?.user) {
      req.user = req.session.user;
      req.isAuthenticated = () => true;
      return next();
    }
    
    // Check for Firebase ID token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.substring(7);
      
      try {
        const auth = getAuth();
        const decodedToken = await auth.verifyIdToken(idToken);
        
        // Upsert user in database
        await upsertUser(decodedToken);
        
        // Set user in session
        req.session.user = {
          claims: {
            sub: decodedToken.uid,
            email: decodedToken.email,
          },
          uid: decodedToken.uid,
          email: decodedToken.email,
        };
        
        req.user = req.session.user;
        req.isAuthenticated = () => true;
        return next();
      } catch (error) {
        console.error('Firebase token verification failed:', error);
      }
    }
    
    // No auth - set isAuthenticated to false
    req.isAuthenticated = () => false;
    next();
  });

  // Login endpoint - redirects to Firebase Auth UI or returns auth config
  app.get("/api/login", (req, res) => {
    res.json({
      message: "Use Firebase Authentication",
      authType: "firebase",
    });
  });

  // Logout endpoint
  app.get("/api/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.redirect('/');
    });
  });

  // Callback for Firebase Auth (client sends token after auth)
  app.post("/api/auth/firebase-callback", async (req: any, res) => {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: "ID token required" });
    }
    
    try {
      ensureFirebaseInitialized();
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(idToken);
      
      // Upsert user in database
      await upsertUser(decodedToken);
      
      // Set user in session
      req.session.user = {
        claims: {
          sub: decodedToken.uid,
          email: decodedToken.email,
        },
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
      
      res.json({ 
        success: true, 
        user: {
          id: decodedToken.uid,
          email: decodedToken.email,
        }
      });
    } catch (error: any) {
      console.error('Firebase auth callback error:', error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  return res.status(401).json({ message: "Unauthorized" });
};

// Admin middleware - checks if user is in ADMIN_USER_IDS
export const isAdmin: RequestHandler = async (req: any, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = req.user?.claims?.sub || req.user?.uid;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
  
  if (adminIds.length === 0 || adminIds.includes(userId)) {
    // If no admins configured, allow all authenticated users (for initial setup)
    // Otherwise, only allow listed admin IDs
    return next();
  }

  return res.status(403).json({ message: "Admin access required" });
};
