import type { Express } from "express";
import { registerMemberSandboxRoutes } from "./member-sandbox.routes";
import { registerMemberPublicWizardRoutes } from "./member-public-wizard.routes";
import { registerMemberPacketsRoutes } from "./member-packets.routes";
import { registerMemberLibraryRoutes } from "./member-library.routes";
import { registerMemberCanvasRoutes } from "./member-canvas.routes";

export function registerMemberRoutes(app: Express): void {
  registerMemberSandboxRoutes(app);
  registerMemberPublicWizardRoutes(app);
  registerMemberPacketsRoutes(app);
  registerMemberLibraryRoutes(app);
  registerMemberCanvasRoutes(app);
}
