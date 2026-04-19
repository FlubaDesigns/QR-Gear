import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import type { CatalogProduct } from "../types";

export function DraftResumeHandler() {
  const { loadFromPacketData, setActiveSession, setActivePacketId } = useBuilderContext();
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const handledRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("resume");
    if (!sessionId || handledRef.current) return;
    handledRef.current = true;

    async function resume() {
      try {
        const headers = await getAuthHeaders();

        const sessionRes = await fetch(`${apiBase}/admin/build-sessions/${sessionId}`, { headers });
        if (!sessionRes.ok) {
          toast({ title: "Draft not found", variant: "destructive" });
          return;
        }
        const { session } = await sessionRes.json();

        const packetId: string | null = session?.generated?.packetId || null;
        let packetData: Record<string, any> | null = null;

        if (packetId) {
          const packetRes = await fetch(`${apiBase}/admin/packets/${packetId}`, { headers });
          if (packetRes.ok) {
            const pd = await packetRes.json();
            packetData = pd.packet || pd;
          }
        }

        let resolvedProduct: CatalogProduct | null = null;
        const blueprintId = packetData?.blueprintId;
        const provider = packetData?.fulfillmentProvider || "printify";

        if (blueprintId) {
          try {
            const catRes = await fetch(`${apiBase}/master-catalog`, { headers });
            if (catRes.ok) {
              const catData = await catRes.json();
              const allCategories: Array<{ items: CatalogProduct[] }> = Array.isArray(catData) ? catData : [];
              for (const cat of allCategories) {
                const match = (cat.items || []).find((p: CatalogProduct) => {
                  if (provider === "printful") return p.fulfillmentProvider === "printful" && Number(p.id) === Number(blueprintId);
                  return (!p.fulfillmentProvider || p.fulfillmentProvider === "printify") && Number(p.blueprintId || p.id) === Number(blueprintId);
                });
                if (match) { resolvedProduct = match; break; }
              }
            }
          } catch { /* product resolution is best-effort */ }
        }

        if (packetData) {
          loadFromPacketData(packetData, resolvedProduct);
        }

        setActiveSession(session.id, session.status as any, session.committedInstanceId || null);
        if (packetId) setActivePacketId(packetId);

        const draftLabel = session.draftName || packetData?.productName || "your draft";
        toast({
          title: "Draft resumed",
          description: `Loaded "${draftLabel}" — pick up where you left off.`,
        });

        const url = new URL(window.location.href);
        url.searchParams.delete("resume");
        window.history.replaceState({}, "", url.pathname + (url.search === "?" ? "" : url.search));
      } catch (err) {
        console.error("[DraftResumeHandler] resume error:", err);
        toast({ title: "Could not resume draft", variant: "destructive" });
      }
    }

    resume();
  }, []);

  return null;
}
