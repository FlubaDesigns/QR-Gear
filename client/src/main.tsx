import { createRoot } from "react-dom/client";
import { Nexus } from "@/lib/nexus";
import { NexusErrorBoundary } from "@/components/NexusErrorBoundary";
import App from "./App";
import "./index.css";

Nexus.info("BOOT", "QR Gear Nexus initialized");

createRoot(document.getElementById("root")!).render(
  <NexusErrorBoundary>
    <App />
  </NexusErrorBoundary>
);
