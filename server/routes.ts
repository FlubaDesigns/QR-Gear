import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./firebaseAuth";
import { startCronJobs } from "./lib/cron-jobs";

import { registerAuthRoutes } from "./routes/auth.routes";
import { registerWidgetRoutes } from "./routes/widget.routes";
import { registerProductRoutes } from "./routes/products.routes";
import { registerStoreRoutes } from "./routes/stores.routes";
import { registerLibraryFileRoutes } from "./routes/library-files.routes";
import { registerLibraryCropRoutes } from "./routes/library-crop.routes";
import { registerCartCheckoutRoutes } from "./routes/cart-checkout.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerAdminLibraryRoutes } from "./routes/admin-library.routes";
import { registerMockupRoutes } from "./routes/mockups.routes";
import { registerMemberRoutes } from "./routes/members.routes";
import { registerDynamicPagesRoutes } from "./routes/dynamic-pages.routes";
import { registerBuyerInstancesRoutes } from "./routes/buyer-instances.routes";
import { registerDynamicsContentRoutes } from "./routes/dynamics-content.routes";
import { registerDynamicsV2Routes } from "./routes/dynamics-v2.routes";
import { registerOrchestrationRoutes } from "./routes/orchestration.routes";
import { registerPacketRoutes } from "./routes/packets.routes";
import { registerDesignRoutes } from "./routes/designs.routes";
import { registerGiftRoutes } from "./routes/gifts.routes";
import { registerPricingRoutes } from "./routes/pricing.routes";
import { registerMiscRoutes } from "./routes/misc.routes";
import { registerBackgroundAssetsRoutes } from "./routes/background-assets.routes";
import { registerBrainRoutes } from "./routes/brain.routes";
import { registerAdminCatalogInstanceRoutes } from "./routes/admin-catalog-instances.routes";
import { registerMemberCatalogInstanceRoutes } from "./routes/member-catalog-instances.routes";
import { registerAdminBuildSessionRoutes } from "./routes/admin-build-sessions.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  registerAuthRoutes(app);
  registerLibraryFileRoutes(app);
  registerLibraryCropRoutes(app);
  registerWidgetRoutes(app);
  registerProductRoutes(app);
  registerStoreRoutes(app);
  registerCartCheckoutRoutes(app);
  registerAdminRoutes(app);
  registerAdminLibraryRoutes(app);
  registerBackgroundAssetsRoutes(app);
  registerMockupRoutes(app);
  registerMemberRoutes(app);
  registerDynamicPagesRoutes(app);
  registerBuyerInstancesRoutes(app);
  registerDynamicsContentRoutes(app);
  registerDynamicsV2Routes(app);
  await registerOrchestrationRoutes(app);
  registerPacketRoutes(app);
  registerDesignRoutes(app);
  registerGiftRoutes(app);
  registerPricingRoutes(app);
  registerMiscRoutes(app);
  registerBrainRoutes(app);
  registerAdminCatalogInstanceRoutes(app);
  registerMemberCatalogInstanceRoutes(app);
  registerAdminBuildSessionRoutes(app);

  startCronJobs();

  const httpServer = createServer(app);
  return httpServer;
}
