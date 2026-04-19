import { useEffect, useRef } from "react";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import type { CatalogProduct } from "../types";

export function DraftResumeHandler() {
  const { loadFromPacketData, loadFromWorkingState, setActiveSession, setActivePacketId } = useBuilderContext();
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const { toast } = useToast();
  const handledRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("resume");
    if (!sessionId || handledRef.current) return;
    handledRef.current = true;

    async function resume() {
      try {
        const headers = await getAuthHeaders();

        const sessionRes = await fetch(`${apiBase}/build-sessions/${sessionId}`, { headers });
        if (!sessionRes.ok) {
          toast({ title: "Draft not found", variant: "destructive" });
          return;
        }
        const { session } = await sessionRes.json();

        const packetId: string | null = session?.generated?.packetId || null;
        let packetData: Record<string, any> | null = null;

        if (packetId) {
          const packetRes = await fetch(`${apiBase}/packets/${packetId}`, { headers });
          if (packetRes.ok) {
            const pd = await packetRes.json();
            packetData = pd.packet || pd;
          }
        }

        // Resolve product from catalog.
        // /master-catalog returns [{ name, items: [{ id: blueprintId, docId: firestoreId, ... }] }]
        // sourceMasterId  = Firestore doc ID → match p.docId
        // selectedProductId = numeric blueprint ID stored in working snapshot → match p.id
        let resolvedProduct: CatalogProduct | null = null;
        const sourceMasterId: string | null = (session as any)?.sourceMasterId ?? null;
        const selectedProductId: string | null = session?.working?.metadata?.selectedProductId ?? null;
        const blueprintId: number | null = packetData?.blueprintId
          ?? session?.working?.metadata?.selectedProductBlueprintId
          ?? null;
        const provider = packetData?.fulfillmentProvider ?? session?.working?.metadata?.fulfillmentProvider ?? "printify";

        if (sourceMasterId || selectedProductId || blueprintId) {
          try {
            const catRes = await fetch(`${apiBase}/master-catalog`, { headers });
            if (catRes.ok) {
              const catData = await catRes.json();
              const allCategories: Array<{ items: any[] }> = Array.isArray(catData) ? catData : [];
              for (const cat of allCategories) {
                const match = (cat.items || []).find((p: any) => {
                  // 1. Firestore doc ID match (most reliable — always set at session creation)
                  if (sourceMasterId && p.docId && String(p.docId) === String(sourceMasterId)) return true;
                  // 2. Numeric blueprint ID match from working metadata
                  if (selectedProductId && String(p.id) === String(selectedProductId)) return true;
                  // 3. Blueprint ID from packet or saved selectedProductBlueprintId
                  if (blueprintId) {
                    if (provider === "printful") return p.fulfillmentProvider === "printful" && Number(p.id) === Number(blueprintId);
                    return (!p.fulfillmentProvider || p.fulfillmentProvider === "printify") && Number(p.blueprintId || p.id) === Number(blueprintId);
                  }
                  return false;
                });
                if (match) { resolvedProduct = match as CatalogProduct; break; }
              }
            }
          } catch { /* product resolution is best-effort */ }
        }

        const hasRestorable = !!(packetData || (session?.working && Object.keys(session.working).length > 0));

        if (!hasRestorable) {
          toast({ title: "Draft is empty", description: "No saved state found for this session.", variant: "destructive" });
          return;
        }

        if (packetData) {
          // Generated packet exists — restore from it (richest source)
          loadFromPacketData(packetData, resolvedProduct);
        } else if (session?.working && Object.keys(session.working).length > 0) {
          // No packet yet — restore from session working state saved during editing
          loadFromWorkingState(session.working, resolvedProduct);
        }

        setActiveSession(session.id, session.status as any, session.committedInstanceId || null);
        if (packetId) setActivePacketId(packetId);

        const draftLabel = session.draftName || packetData?.productName || resolvedProduct?.title || "your draft";

        if (!resolvedProduct) {
          toast({
            title: "Draft resumed (product not found)",
            description: `Loaded "${draftLabel}" but the source product couldn't be resolved. You may need to re-select it.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Draft resumed",
            description: `Loaded "${draftLabel}" — pick up where you left off.`,
          });
        }

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
