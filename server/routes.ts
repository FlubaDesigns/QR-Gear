import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./firebaseAuth";
import { startCronJobs } from "./lib/cron-jobs";

import { registerAuthRoutes } from "./routes/auth.routes";
import { registerWidgetRoutes } from "./routes/widget.routes";
import { registerProductRoutes } from "./routes/products.routes";
import { registerStoreRoutes } from "./routes/stores.routes";
import { registerCartCheckoutRoutes } from "./routes/cart-checkout.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerAdminLibraryRoutes } from "./routes/admin-library.routes";
import { registerMockupRoutes } from "./routes/mockups.routes";
import { registerMemberRoutes } from "./routes/members.routes";
import { registerQRDynamicsRoutes } from "./routes/qr-dynamics.routes";
import { registerOrchestrationRoutes } from "./routes/orchestration.routes";
import { registerMiscRoutes } from "./routes/misc.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  registerAuthRoutes(app);
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
  registerMiscRoutes(app);

  startCronJobs();

  const httpServer = createServer(app);
  return httpServer;
}
