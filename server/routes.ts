import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./firebaseAuth";
import { startCronJobs } from "./lib/cron-jobs";

import { registerAuthRoutes } from "./routes/auth.routes";
import { registerWidgetRoutes } from "./routes/widget.routes";
import { registerProductRoutes } from "./routes/products.routes";
import { registerStoreRoutes } from "./routes/stores.routes";
import { registerLibraryFileRoutes } from "./routes/library-files.routes";
import { registerCartCheckoutRoutes } from "./routes/cart-checkout.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerAdminLibraryRoutes } from "./routes/admin-library.routes";
import { registerMockupRoutes } from "./routes/mockups.routes";
import { registerMemberRoutes } from "./routes/members.routes";
import { registerQRDynamicsRoutes } from "./routes/qr-dynamics.routes";
import { registerOrchestrationRoutes } from "./routes/orchestration.routes";
import { registerPacketRoutes } from "./routes/packets.routes";
import { registerDesignRoutes } from "./routes/designs.routes";
import { registerGiftRoutes } from "./routes/gifts.routes";
import { registerPricingRoutes } from "./routes/pricing.routes";
import { registerMiscRoutes } from "./routes/misc.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  registerAuthRoutes(app);
  registerLibraryFileRoutes(app);
  registerWidgetRoutes(app);
  registerProductRoutes(app);
  registerStoreRoutes(app);
  registerCartCheckoutRoutes(app);
  registerAdminRoutes(app);
  registerAdminLibraryRoutes(app);
  registerMockupRoutes(app);
  registerMemberRoutes(app);
  registerQRDynamicsRoutes(app);
  await registerOrchestrationRoutes(app);
  registerPacketRoutes(app);
  registerDesignRoutes(app);
  registerGiftRoutes(app);
  registerPricingRoutes(app);
  registerMiscRoutes(app);

  startCronJobs();

  const httpServer = createServer(app);
  return httpServer;
}
