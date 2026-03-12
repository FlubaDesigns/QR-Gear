import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";

export function registerDynamicPagesRoutes(app: Express): void {

  app.get("/api/dynamic-pages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pages = await storage.getDynamicPagesByUser(userId);

      const enrichedPages = await Promise.all(pages.map(async (page) => {
        let activeImage = null;
        if (page.activeAssetId) {
          const assets = await storage.getDynamicPageAssets(page.id);
          const activeAsset = assets.find(a => a.id === page.activeAssetId);
          if (activeAsset && activeAsset.hostedImageId) {
            const image = await storage.getHostedImage(activeAsset.hostedImageId);
            if (image) {
              activeImage = {
                url: `/api/images/${image.id}`,
                title: activeAsset.title || image.title,
              };
            }
          }
        }
        return { ...page, activeImage };
      }));

      res.json(enrichedPages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const assets = await storage.getDynamicPageAssets(page.id);
      res.json({ ...page, assets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dynamic-pages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, hostingTierId } = req.body;

      const slug = crypto.randomUUID();

      let expiresAt: Date | null = null;
      if (hostingTierId) {
        const tier = await storage.getHostingTier(hostingTierId);
        if (tier && tier.code !== "permanent") {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + tier.durationDays);
        }
      }

      const page = await storage.createDynamicPage({
        userId,
        slug,
        title,
        description,
        hostingTierId,
        expiresAt,
        status: "active",
      });

      res.status(201).json(page);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dynamic-pages/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        title,
        description,
        backgroundUrl,
        backgroundType,
        overlayPosition,
        overlayColor,
        overlayFontFamily,
        productId,
        qrState
      } = req.body;

      const slug = crypto.randomUUID();

      const contentConfig = JSON.stringify({
        backgroundUrl,
        backgroundType: backgroundType || "image",
        overlayPosition: overlayPosition || "bottom",
        overlayColor: overlayColor || "#ffffff",
        overlayFontFamily: overlayFontFamily || "Arial",
        productId,
        qrState,
      });

      const page = await storage.createDynamicPage({
        userId,
        slug,
        title: title || "Untitled",
        description: contentConfig,
        status: "active",
      });

      const baseUrl = process.env.NODE_ENV === "production"
        ? "https://qrgear-c1ffd.web.app"
        : `http://localhost:${process.env.PORT || 5000}`;

      res.status(201).json({
        id: page.id,
        slug: page.slug,
        url: `${baseUrl}/p/${page.slug}`,
        createdAt: page.createdAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateDynamicPage(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteDynamicPage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dynamic-pages/:id/assets", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const assets = await storage.getDynamicPageAssets(page.id);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dynamic-pages/:id/assets", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { hostedImageId, title, setAsActive } = req.body;

      const asset = await storage.createDynamicPageAsset({
        pageId: page.id,
        hostedImageId,
        title,
        isActive: false,
      });

      if (setAsActive) {
        await storage.setActiveAsset(page.id, asset.id);
      }

      res.status(201).json(asset);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dynamic-pages/:id/set-active", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { assetId } = req.body;
      await storage.setActiveAsset(page.id, assetId);

      const updatedPage = await storage.getDynamicPage(page.id);
      res.json(updatedPage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dynamic/:slug", async (req, res) => {
    try {
      const page = await storage.getDynamicPageBySlug(req.params.slug);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      if (page.status !== "active") {
        return res.status(410).json({ error: "This page is no longer available" });
      }
      if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
        return res.status(410).json({ error: "This page has expired" });
      }

      await storage.incrementDynamicPageViews(page.id);

      let activeImage = null;
      if (page.activeAssetId) {
        const asset = await storage.getDynamicPageAsset(page.activeAssetId);
        if (asset) {
          activeImage = await storage.getHostedImage(asset.hostedImageId);
        }
      }

      res.json({
        title: page.title,
        description: page.description,
        image: activeImage ? {
          url: activeImage.publicUrl,
          title: activeImage.title,
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
