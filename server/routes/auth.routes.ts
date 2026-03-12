import type { Express } from "express";
import { isAuthenticated, isAdmin } from "../firebaseAuth";
import { storage } from "../storage";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { z } from "zod";
import bcrypt from "bcryptjs";

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export function registerAuthRoutes(app: Express): void {
  // ============ UNIVERSAL CLAIM PAGE API ============
  // Validates a claim code and returns claim data for the UI
  app.get('/api/claim/validate/:claimCode', async (req, res) => {
    try {
      const { claimCode } = req.params;
      const { validateClaimCode } = await import('../lib/claimService');
      const result = await validateClaimCode(claimCode);
      res.json(result);
    } catch (error: any) {
      console.error('[Claim] Validation error:', error);
      res.status(500).json({ valid: false, reason: error.message });
    }
  });

  // Claims an item and creates an instance (requires auth)
  app.post('/api/claim/:claimCode', isAuthenticated, async (req: any, res) => {
    try {
      const { claimCode } = req.params;
      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email || '';
      
      const { claimItem } = await import('../lib/claimService');
      const result = await claimItem(claimCode, userId, userEmail);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true, instanceId: result.instanceId });
    } catch (error: any) {
      console.error('[Claim] Claim error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's claimed instances
  app.get('/api/claimed-instances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getClaimedInstancesByUser } = await import('../lib/claimService');
      const instances = await getClaimedInstancesByUser(userId);
      res.json({ instances });
    } catch (error: any) {
      console.error('[Claim] Get instances error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single claimed instance
  app.get('/api/claimed-instances/:instanceId', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { getClaimedInstance, isClaimedInstanceActive } = await import('../lib/claimService');
      const instance = await getClaimedInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      res.json({ instance, isActive: isClaimedInstanceActive(instance) });
    } catch (error: any) {
      console.error('[Claim] Get instance error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update claimed instance destination
  app.patch('/api/claimed-instances/:instanceId', isAuthenticated, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { destinationUrl } = req.body;
      const userId = req.user.claims.sub;
      
      const { getClaimedInstance, updateClaimedInstanceDestination } = await import('../lib/claimService');
      const instance = await getClaimedInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      if (instance.ownerUserId !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      await updateClaimedInstanceDestination(instanceId, destinationUrl);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Claim] Update instance error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Generate claim codes
  app.post('/api/admin/claim-codes', isAdmin, async (req: any, res) => {
    try {
      const { templateId, packetType, productName, productDescription, previewImageUrl, count } = req.body;
      
      if (!templateId || !packetType || !productName) {
        return res.status(400).json({ error: 'templateId, packetType, and productName are required' });
      }
      
      const { generateClaimCode, generateBulkClaimCodes } = await import('../lib/claimService');
      
      if (count && count > 1) {
        const codes = await generateBulkClaimCodes(
          { templateId, packetType, productName, productDescription, previewImageUrl },
          Math.min(count, 100)
        );
        res.json({ codes: codes.map(c => c.claimCode), count: codes.length });
      } else {
        const code = await generateClaimCode({ templateId, packetType, productName, productDescription, previewImageUrl });
        res.json({ claimCode: code.claimCode });
      }
    } catch (error: any) {
      console.error('[Claim] Generate codes error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Auth routes - returns null if not authenticated (no 401)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Helper to check admin status
      const checkIsAdmin = (userId: string) => {
        const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
        return adminIds.length === 0 || adminIds.includes(userId);
      };

      // Check for Firebase ID token in Authorization header first
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const idToken = authHeader.substring(7);
        const decodedToken = await verifyFirebaseToken(idToken);
        if (decodedToken) {
          const firebaseUserId = decodedToken.uid;
          // Try to find existing user by Firebase UID
          let user = await storage.getUser(firebaseUserId);
          if (!user) {
            // Create user from Firebase token data
            user = await storage.createUser({
              id: firebaseUserId,
              email: decodedToken.email || null,
              firstName: decodedToken.name?.split(' ')[0] || null,
              lastName: decodedToken.name?.split(' ').slice(1).join(' ') || null,
              profileImageUrl: decodedToken.picture || null,
            });
          }
          const { passwordHash, ...safeUser } = user;
          return res.json({ ...safeUser, isAdmin: checkIsAdmin(firebaseUserId) });
        }
      }

      // Check for email/password session
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          const { passwordHash, ...safeUser } = user;
          return res.json({ ...safeUser, isAdmin: checkIsAdmin(user.id) });
        }
      }

      // Fall back to Replit OAuth
      if (req.isAuthenticated?.() && req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        if (user) {
          return res.json({ ...user, isAdmin: checkIsAdmin(userId) });
        }
      }

      res.json(null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.json(null);
    }
  });

  // Email/Password Registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors[0]?.message || "Invalid input";
        return res.status(400).json({ error: errorMsg });
      }
      
      const { email, password, firstName, lastName } = parseResult.data;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Create user
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
      });
      
      // Regenerate session for security
      req.session.regenerate?.(() => {});
      (req.session as any).userId = user.id;
      
      const { passwordHash: _, ...safeUser } = user;
      res.json({ user: safeUser, message: "Account created successfully" });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // Email/Password Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors[0]?.message || "Invalid input";
        return res.status(400).json({ error: errorMsg });
      }
      
      const { email, password } = parseResult.data;
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Regenerate session for security
      req.session.regenerate?.(() => {});
      (req.session as any).userId = user.id;
      
      const { passwordHash: _, ...safeUser } = user;
      res.json({ user: safeUser, message: "Logged in successfully" });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  // Email/Password Logout
  app.post('/api/auth/email-logout', async (req: any, res) => {
    try {
      req.session.userId = null;
      res.json({ message: "Logged out successfully" });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to log out" });
    }
  });

  // Browsing history routes
  app.get('/api/browsing-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const history = await storage.getBrowsingHistory(userId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/browsing-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productId } = req.body;
      const entry = await storage.addBrowsingHistory({ userId, productId });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
