import type { Express } from "express";
import { storage } from "../storage";
import { fsQuery } from "../lib/firestore-crud";
import { isAuthenticated, isAdmin } from "../firebaseAuth";
import { insertQrDesignSchema } from "@shared/schema";
import { uploadImageFromBuffer } from "../lib/image-upload";
import { generatePrintifyComposite } from "../lib/composite-image-generator";
import { z } from "zod";
import QRCode from "qrcode";

export function registerDesignRoutes(app: Express): void {

  // ============ SAVED DESIGNS ENDPOINTS ============
  
  app.get("/api/designs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const designs = await storage.getQrDesignsByUser(userId);
      res.json(designs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(design);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/designs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertQrDesignSchema.parse({
        ...req.body,
        userId,
      });
      const design = await storage.createQrDesign(validatedData);
      res.status(201).json(design);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateQrDesign(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteQrDesign(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CUSTOM DESIGNS ENDPOINTS ============
  
  app.get("/api/customs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const design = await storage.getCustomDesign(id);
      if (!design) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      res.json(design);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/admin/custom-designs", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        projectName: z.string().min(1, "Project name is required").max(100),
        productId: z.number(),
        productName: z.string(),
        productImage: z.string().nullable().optional(),
        placements: z.array(z.string()).min(1),
        placementConfigs: z.record(z.string(), z.enum(["full", "qr-only"])).optional(),
        qrContentType: z.enum(["rich_media", "plain_text", "external_url"]).optional().default("rich_media"),
        plainTextQrContent: z.string().nullable().optional(),
        externalUrl: z.string().nullable().optional().refine(
          (val) => {
            if (!val) return true;
            const normalized = val.match(/^https?:\/\//) ? val : `https://${val}`;
            try {
              const url = new URL(normalized);
              return url.hostname.includes('.') && url.hostname.length > 3;
            } catch {
              return false;
            }
          },
          { message: "Please enter a valid URL (e.g., https://example.com or example.com)" }
        ),
        backgroundImage: z.string().nullable().optional(),
        topText: z.object({
          text: z.string(),
          fontFamily: z.string(),
          fontSize: z.string(),
          color: z.string().optional(),
          letterSpacing: z.number().optional(),
          warpPreset: z.string().optional(),
          strokeColor: z.string().optional(),
          strokeWidth: z.number().optional(),
        }).nullable().optional(),
        bottomText: z.object({
          text: z.string(),
          fontFamily: z.string(),
          fontSize: z.string(),
          color: z.string().optional(),
          letterSpacing: z.number().optional(),
          warpPreset: z.string().optional(),
          strokeColor: z.string().optional(),
          strokeWidth: z.number().optional(),
        }).nullable().optional(),
        landingOverlay: z.object({
          enabled: z.boolean(),
          title: z.string().optional(),
          description: z.string().optional(),
          position: z.enum(["top", "bottom"]),
          fontFamily: z.string(),
          color: z.string(),
        }).nullable().optional(),
        textUpcharge: z.number().optional().default(2.00),
        storeType: z.string().nullable().optional(),
        storeName: z.string().nullable().optional(),
        segment: z.string().nullable().optional(),
        isFeatured: z.boolean().optional().default(false),
        isSeasonalPromo: z.boolean().optional().default(false),
        saveTarget: z.enum(["library", "store", "both"]),
        basePrice: z.number().optional().default(0),
        markupPercent: z.number().optional().default(0),
        markupFixed: z.number().optional().default(0),
        hostingPrice: z.number().optional().default(0),
        madeInUSA: z.boolean().optional().default(false),
        printProviderId: z.number().nullable().optional(),
      });
      
      const validatedData = createSchema.parse(req.body);
      
      if (validatedData.qrContentType === "external_url") {
        if (!validatedData.externalUrl || validatedData.externalUrl.trim() === "") {
          return res.status(400).json({ 
            error: "External URL is required when using External URL QR mode" 
          });
        }
      }
      
      if (validatedData.qrContentType === "plain_text") {
        if (!validatedData.plainTextQrContent || validatedData.plainTextQrContent.trim() === "") {
          return res.status(400).json({ 
            error: "QR content is required when using Plain Text QR mode" 
          });
        }
      }
      
      const slugify = (str: string) => str?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '';
      
      let baseSlug = slugify(validatedData.projectName);
      
      if (!baseSlug) {
        const storePart = slugify(validatedData.storeName || 'custom');
        const segmentPart = slugify(validatedData.segment || 'general');
        const timestamp = Date.now().toString(36);
        baseSlug = `${storePart}-${segmentPart}-${timestamp}`;
      }
      
      let designId = baseSlug;
      let counter = 1;
      while (await storage.getCustomDesign(designId)) {
        designId = `${baseSlug}-${counter}`;
        counter++;
      }
      
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : "http://localhost:5000";
      
      let backgroundAssetId: string | null = null;
      if (validatedData.backgroundImage && validatedData.saveTarget !== "store") {
        const existingAsset = await storage.getLibraryAssetByUrl(validatedData.backgroundImage);
        if (existingAsset) {
          backgroundAssetId = existingAsset.id;
          await storage.incrementLibraryAssetUsage(existingAsset.id);
          if (!existingAsset.isActive) {
            await storage.updateLibraryAsset(existingAsset.id, { isActive: true });
          }
        } else {
          const bgFilename = validatedData.backgroundImage.split('/').pop() || 'background.png';
          const newAsset = await storage.createLibraryAsset({
            name: `Background - ${validatedData.storeName || 'Custom'} ${validatedData.segment || ''}`.trim(),
            originalName: bgFilename,
            mimeType: 'image/png',
            fileName: bgFilename,
            sizeBytes: 0,
            storageUrl: validatedData.backgroundImage,
            publicUrl: validatedData.backgroundImage,
            ownerType: 'admin',
            assetType: 'background',
            mediaType: 'image',
            isActive: true,
            isFeatured: false,
            visibleStoreSlugs: validatedData.storeName ? [validatedData.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')] : null,
            visibleSegments: validatedData.segment ? { segments: [validatedData.segment] } : null,
          });
          backgroundAssetId = newAsset.id;
        }
      }
      
      const finalPlacementConfigs = validatedData.placementConfigs || 
        Object.fromEntries(validatedData.placements.map(p => [p, "full"]));
      
      const templateVariant = validatedData.qrContentType === "plain_text" ? "plain-text" 
        : validatedData.qrContentType === "external_url" ? "external-url" 
        : "url";
      
      const designData = {
        id: designId,
        projectName: validatedData.projectName,
        productId: validatedData.productId,
        productName: validatedData.productName,
        productImage: validatedData.productImage || null,
        placements: validatedData.placements,
        placementConfigs: finalPlacementConfigs,
        backgroundImageUrl: validatedData.backgroundImage || null,
        backgroundAssetId: backgroundAssetId,
        topText: validatedData.topText || null,
        bottomText: validatedData.bottomText || null,
        landingOverlay: validatedData.landingOverlay || null,
        textUpcharge: String(validatedData.textUpcharge),
        storeType: validatedData.storeType || null,
        storeName: validatedData.storeName || null,
        segment: validatedData.segment || null,
        isFeatured: validatedData.isFeatured,
        isSeasonalPromo: validatedData.isSeasonalPromo,
        savedToLibrary: validatedData.saveTarget === "library" || validatedData.saveTarget === "both",
        savedToStore: validatedData.saveTarget === "store" || validatedData.saveTarget === "both",
        templateVariant,
        externalUrl: validatedData.externalUrl 
          ? (validatedData.externalUrl.match(/^https?:\/\//) 
             ? validatedData.externalUrl 
             : `https://${validatedData.externalUrl}`)
          : null,
      };
      
      const design = await storage.createCustomDesign(designData);
      
      let qrUrl: string;
      if (validatedData.qrContentType === "external_url" && validatedData.externalUrl) {
        const extUrl = validatedData.externalUrl;
        qrUrl = extUrl.match(/^https?:\/\//) ? extUrl : `https://${extUrl}`;
      } else if (validatedData.qrContentType === "plain_text" && validatedData.plainTextQrContent) {
        qrUrl = validatedData.plainTextQrContent;
      } else {
        qrUrl = `${baseUrl}/customs/${design.id}`;
      }
      
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      
      const placementImages: Record<string, string> = {};
      let primaryCompositeUrl: string | null = null;
      
      const { renderDesignToPng, renderQrOnlyToPng } = await import("../lib/svg-renderer");
      
      const generateFullArtworkWithFallback = async (placementId: string, qrColor: 'black' | 'white' = 'black'): Promise<string | null> => {
        const textColor = qrColor === 'white' ? "#FFFFFF" : "#000000";
        
        const headerStyle = validatedData.topText ? {
          text: validatedData.topText.text,
          fontFamily: validatedData.topText.fontFamily || "Arial",
          fontSize: parseInt(validatedData.topText.fontSize) || 120,
          color: textColor,
          letterSpacing: (validatedData.topText as any).letterSpacing || 0,
          warpPreset: (validatedData.topText as any).warpPreset || "straight",
          strokeColor: (validatedData.topText as any).strokeColor,
          strokeWidth: (validatedData.topText as any).strokeWidth,
        } : undefined;
        
        const footerStyle = validatedData.bottomText ? {
          text: validatedData.bottomText.text,
          fontFamily: validatedData.bottomText.fontFamily || "Arial",
          fontSize: parseInt(validatedData.bottomText.fontSize) || 96,
          color: textColor,
          letterSpacing: (validatedData.bottomText as any).letterSpacing || 0,
          warpPreset: (validatedData.bottomText as any).warpPreset || "straight",
          strokeColor: (validatedData.bottomText as any).strokeColor,
          strokeWidth: (validatedData.bottomText as any).strokeWidth,
        } : undefined;
        
        try {
          const renderResult = await renderDesignToPng({
            templateType: 'shirt-front',
            header: headerStyle,
            footer: footerStyle,
            qrUrl,
            qrColor,
          });
          
          const colorSuffix = qrColor === 'white' ? '-white' : '';
          const fileName = `svg-composite-${design.id}-${placementId}${colorSuffix}-${Date.now()}.png`;
          const uploadResult = await uploadImageFromBuffer(
            renderResult.pngBuffer,
            fileName,
            'image/png'
          );
          console.log(`[Custom Design] Generated ${qrColor.toUpperCase()} full artwork for ${placementId}: ${uploadResult.publicUrl}`);
          return uploadResult.publicUrl;
        } catch (svgError: any) {
          console.error(`[Custom Design] SVG render failed for ${placementId}, falling back to canvas:`, svgError.message);
          
          const fallbackTopText = validatedData.topText ? {
            text: validatedData.topText.text,
            fontFamily: validatedData.topText.fontFamily || "Arial",
            fontSize: validatedData.topText.fontSize || "120",
            color: textColor,
            letterSpacing: (validatedData.topText as any).letterSpacing || 0,
            warpPreset: (validatedData.topText as any).warpPreset || "straight",
            strokeColor: (validatedData.topText as any).strokeColor,
            strokeWidth: (validatedData.topText as any).strokeWidth,
          } : null;
          
          const fallbackBottomText = validatedData.bottomText ? {
            text: validatedData.bottomText.text,
            fontFamily: validatedData.bottomText.fontFamily || "Arial",
            fontSize: validatedData.bottomText.fontSize || "96",
            color: textColor,
            letterSpacing: (validatedData.bottomText as any).letterSpacing || 0,
            warpPreset: (validatedData.bottomText as any).warpPreset || "straight",
            strokeColor: (validatedData.bottomText as any).strokeColor,
            strokeWidth: (validatedData.bottomText as any).strokeWidth,
          } : null;
          
          const canvasUrl = await generatePrintifyComposite(
            qrUrl,
            fallbackTopText,
            fallbackBottomText,
            4500,
            5400,
            qrColor
          );
          console.log(`[Custom Design] Generated ${qrColor.toUpperCase()} canvas fallback for ${placementId}: ${canvasUrl}`);
          return canvasUrl;
        }
      }
      
      for (const [placementId, mode] of Object.entries(finalPlacementConfigs)) {
        try {
          let imageUrl: string | null = null;
          let whiteImageUrl: string | null = null;
          
          if (mode === "qr-only") {
            const qrOnlyResult = await renderQrOnlyToPng({ qrUrl });
            const fileName = `qr-only-${design.id}-${placementId}-${Date.now()}.png`;
            const uploadResult = await uploadImageFromBuffer(
              qrOnlyResult.pngBuffer,
              fileName,
              'image/png'
            );
            console.log(`[Custom Design] Generated QR-only for ${placementId}: ${uploadResult.publicUrl}`);
            imageUrl = uploadResult.publicUrl;
            
            const qrOnlyWhiteResult = await renderQrOnlyToPng({ qrUrl, qrColor: 'white' });
            const whiteFileName = `qr-only-white-${design.id}-${placementId}-${Date.now()}.png`;
            const whiteUploadResult = await uploadImageFromBuffer(
              qrOnlyWhiteResult.pngBuffer,
              whiteFileName,
              'image/png'
            );
            console.log(`[Custom Design] Generated WHITE QR-only for ${placementId}: ${whiteUploadResult.publicUrl}`);
            whiteImageUrl = whiteUploadResult.publicUrl;
          } else {
            imageUrl = await generateFullArtworkWithFallback(placementId, 'black');
            
            whiteImageUrl = await generateFullArtworkWithFallback(placementId, 'white');
          }
          
          if (imageUrl) {
            placementImages[placementId] = imageUrl;
            
            if (!primaryCompositeUrl && mode === "full") {
              primaryCompositeUrl = imageUrl;
            }
          }
          
          if (whiteImageUrl) {
            placementImages[`${placementId}-white`] = whiteImageUrl;
            console.log(`[Custom Design] Stored white version as ${placementId}-white`);
          }
        } catch (renderError: any) {
          console.error(`[Custom Design] Render failed for ${placementId}:`, renderError.message);
        }
      }
      
      if (!primaryCompositeUrl && Object.keys(placementImages).length > 0) {
        primaryCompositeUrl = Object.values(placementImages)[0];
      }
      
      const updatedDesign = await storage.updateCustomDesign(design.id, {
        qrCodeUrl: qrCodeDataUrl,
        printifyCompositeUrl: primaryCompositeUrl,
        placementImages,
      });
      
      if (designData.savedToStore && designData.storeName) {
        const categoryPath = designData.segment 
          ? `${designData.storeName}/${designData.segment}`
          : designData.storeName;
        
        const productId = `custom_${design.id}`;
        
        const textUpchargeTotal = (validatedData.topText ? validatedData.textUpcharge : 0) + 
                                  (validatedData.bottomText ? validatedData.textUpcharge : 0);
        const totalCost = validatedData.basePrice + textUpchargeTotal + validatedData.hostingPrice;
        
        const customerPrice = (totalCost * (1 + validatedData.markupPercent / 100)) + validatedData.markupFixed;
        
        const existingProduct = await storage.getProduct(productId);
        
        if (existingProduct) {
          await storage.updateProduct(productId, {
            name: validatedData.productName,
            description: `Custom QR design for ${categoryPath}`,
            category: categoryPath,
            basePrice: String(totalCost.toFixed(2)),
            customerPrice: String(customerPrice.toFixed(2)),
            markupPercent: String(validatedData.markupPercent),
            markupFixed: String(validatedData.markupFixed),
            imageUrl: validatedData.productImage || null,
            blueprintId: validatedData.productId || null,
            printProviderId: validatedData.printProviderId || null,
            madeInUSA: validatedData.madeInUSA || false,
            isFeatured: validatedData.isFeatured || false,
            isEnabled: true,
            metadata: { customDesignId: design.id, source: "custom" },
          });
        } else {
          await storage.createProduct({
            id: productId,
            name: validatedData.productName,
            description: `Custom QR design for ${categoryPath}`,
            basePrice: String(totalCost.toFixed(2)),
            customerPrice: String(customerPrice.toFixed(2)),
            markupPercent: String(validatedData.markupPercent),
            markupFixed: String(validatedData.markupFixed),
            category: categoryPath,
            imageUrl: validatedData.productImage || null,
            blueprintId: validatedData.productId || null,
            printProviderId: validatedData.printProviderId || null,
            madeInUSA: validatedData.madeInUSA || false,
            isFeatured: validatedData.isFeatured || false,
            isEnabled: true,
            metadata: { customDesignId: design.id, source: "custom" },
          });
        }
        
        console.log(`[Custom Design] Created/updated product catalog entry: ${productId} in category: ${categoryPath} with price $${customerPrice.toFixed(2)}`);
        
        if (validatedData.productId && validatedData.printProviderId) {
          try {
            const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
            
            const providers = await fsQuery('printify_print_providers', [
              ['blueprintId', '==', validatedData.productId],
              ['providerId', '==', validatedData.printProviderId]
            ]);
            const provider = providers[0];
            
            const availableColors = provider?.availableColors as Array<{name: string; hex: string}> || [];
            
            if (availableColors.length > 0) {
              const artworkUrl = (placementImages as any)?.["front"] || (placementImages as any)?.["front-chest"] || 
                                 Object.values(placementImages || {})[0] as string;
              
              if (artworkUrl) {
                const artworkVariant = "black" as const;
                
                const jobs = await mockupJobQueue.createBatchJobs({
                  productId,
                  colors: availableColors,
                  qrSizes: ["small", "medium", "large"],
                  placements: ["front"],
                  blueprintId: validatedData.productId,
                  printProviderId: validatedData.printProviderId,
                  artworkUrl,
                  artworkVariant,
                });
                
                console.log(`[Custom Design] Queued ${jobs.length} mockup jobs for ${availableColors.length} colors x 3 sizes`);
              } else {
                console.warn(`[Custom Design] No artwork URL found for auto-mockup generation`);
              }
            } else {
              console.warn(`[Custom Design] No colors found in local catalog for blueprint ${validatedData.productId} provider ${validatedData.printProviderId}`);
            }
          } catch (mockupError: any) {
            console.error(`[Custom Design] Failed to queue mockup jobs:`, mockupError.message);
          }
        }
      }
      
      res.json(updatedDesign);
    } catch (error: any) {
      console.error("[Custom Design Save] Error:", error);
      if (error instanceof z.ZodError) {
        console.error("[Custom Design Save] Zod validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/admin/custom-designs", isAdmin, async (req, res) => {
    try {
      const designs = await storage.getCustomDesigns();
      res.json(designs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  async function handleCustomDesignUpdate(req: any, res: any) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const existing = await storage.getCustomDesign(id);
      if (!existing) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      
      const updatedDesign = await storage.updateCustomDesign(id, updates);
      res.json(updatedDesign);
    } catch (error: any) {
      console.error("[Custom Design Update] Error:", error);
      res.status(500).json({ error: error.message });
    }
  }
  
  app.put("/api/admin/custom-designs/:id", isAdmin, handleCustomDesignUpdate);
  app.patch("/api/admin/custom-designs/:id", isAdmin, handleCustomDesignUpdate);
  
  app.delete("/api/admin/custom-designs/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCustomDesign(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SVG TEXT WARP RENDER ENDPOINTS ============
  
  app.get("/api/render/config", async (req, res) => {
    try {
      const { getFontAllowlist, getWarpPresets } = await import("../lib/svg-renderer");
      res.json({
        fonts: getFontAllowlist(),
        warpPresets: getWarpPresets(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.all("/api/render/preview", async (req, res) => {
    try {
      const { buildPreviewSvg } = await import("../lib/svg-renderer");
      const params = req.method === 'GET' ? req.query : req.body;
      const { header, footer, qrUrl, previewWidth, previewHeight } = params as any;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const svgString = buildPreviewSvg(
        { templateType: 'shirt-front', header, footer, qrUrl },
        previewWidth || 450,
        previewHeight || 540
      );
      
      res.type('image/svg+xml').send(svgString);
    } catch (error: any) {
      console.error("[SVG Preview] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/render/png", isAdmin, async (req, res) => {
    try {
      const { renderDesignToPng } = await import("../lib/svg-renderer");
      const { header, footer, qrUrl, templateType } = req.body;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const result = await renderDesignToPng({
        templateType: templateType || 'shirt-front',
        header,
        footer,
        qrUrl,
      });
      
      const fileName = `svg-render-${Date.now()}.png`;
      const uploadResult = await uploadImageFromBuffer(
        result.pngBuffer,
        fileName,
        'image/png'
      );
      
      res.json({
        url: uploadResult.publicUrl,
        width: result.width,
        height: result.height,
      });
    } catch (error: any) {
      console.error("[PNG Render] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/render/png/download", isAdmin, async (req, res) => {
    try {
      const { renderDesignToPng } = await import("../lib/svg-renderer");
      const { header, footer, qrUrl, templateType } = req.body;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const result = await renderDesignToPng({
        templateType: templateType || 'shirt-front',
        header,
        footer,
        qrUrl,
      });
      
      res.set({
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="printify-design.png"',
        'Content-Length': result.pngBuffer.length,
      });
      res.send(result.pngBuffer);
    } catch (error: any) {
      console.error("[PNG Download] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
