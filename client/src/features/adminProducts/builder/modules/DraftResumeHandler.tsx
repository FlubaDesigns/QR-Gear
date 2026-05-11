import { useEffect, useRef } from "react";
import { useBuilderContext } from "../BuilderContext";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";
import type { CatalogProduct, ProductColor } from "../types";

/**
 * Resolve a raw catalog product's availableColors into proper {name, hex} objects.
 * Firestore stores availableColors as QRG color codes (e.g. "01","02","03"), not hex values.
 * The resolved colors come from providerMappings which carries the actual hex data.
 */
function normalizeProductColors(product: CatalogProduct): ProductColor[] {
  const raw = product as any;
  const pm = raw.providerMappings || {};
  const mapped: Array<{ name: string; hex: string }> = (
    pm.printful?.colors || pm.printify?.colors || []
  ).map((c: any) => ({ name: c.name || '', hex: c.hex || '#CCCCCC' }));
  if (mapped.length > 0) return mapped;
  // Fall back: convert whatever is stored (may be objects or raw strings)
  return (product.availableColors || []).map((c: any) => ({
    name: typeof c === 'string' ? c : (c.name || c.colorName || c.label || ''),
    hex: typeof c === 'object' && c.hex ? c.hex : '#CCCCCC',
  }));
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Fetch the full grouped catalog ([{ name, items: [{ docId, id, blueprintId, ... }] }]). */
async function fetchCatalog(): Promise<Array<{ items: any[] }>> {
  try {
    const res = await fetch("/api/master-catalog");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Resolve a CatalogProduct by Firestore doc ID (p.docId).
 * This is the authoritative key for prepacket sessions — always stored as sourceMasterId.
 */
async function resolveByDocId(
  docId: string,
  catalog: Array<{ items: any[] }>,
): Promise<CatalogProduct | null> {
  for (const cat of catalog) {
    const match = (cat.items || []).find((p: any) => p.docId && String(p.docId) === String(docId));
    if (match) return match as CatalogProduct;
  }
  return null;
}

/**
 * Resolve a CatalogProduct by numeric blueprint ID (p.blueprintId or p.id for Printify;
 * p.id for Printful). Used as a fallback when sourceMasterId fails.
 */
async function resolveByBlueprintId(
  blueprintId: number | null,
  provider: string,
  catalog: Array<{ items: any[] }>,
): Promise<CatalogProduct | null> {
  if (!blueprintId) return null;
  for (const cat of catalog) {
    const match = (cat.items || []).find((p: any) => {
      if (provider === "printful") {
        return p.fulfillmentProvider === "printful" && Number(p.id) === Number(blueprintId);
      }
      return (
        (!p.fulfillmentProvider || p.fulfillmentProvider === "printify") &&
        Number(p.blueprintId || p.id) === Number(blueprintId)
      );
    });
    if (match) return match as CatalogProduct;
  }
  return null;
}

// ─── component ──────────────────────────────────────────────────────────────

export function DraftResumeHandler() {
  const { loadFromPacketData, loadFromWorkingState, setActiveSession, setActivePacketId } =
    useBuilderContext();
  const { toast } = useToast();
  const handledRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("resume");
    if (!sessionId || handledRef.current) return;
    handledRef.current = true;

    async function resume() {
      try {
        // ── 1. Fetch session ─────────────────────────────────────────────
        const sessionResult = await adminFetch<{ session: any }>(`/build-sessions/${sessionId}`).catch(() => null);
        if (!sessionResult) {
          toast({ title: "Draft not found", variant: "destructive" });
          return;
        }
        const { session } = sessionResult;
        console.log("[DraftResumeHandler] Session loaded:", session?.id, "| sourceMasterId:", session?.sourceMasterId);

        // ── 2. Try to load packet (only if session has generated one) ────
        const packetId: string | null = session?.generated?.packetId || null;
        let packetData: Record<string, any> | null = null;

        if (packetId) {
          const pd = await adminFetch<any>(`/packets/${packetId}`).catch(() => null);
          if (pd) {
            packetData = pd.packet || pd;
            console.log("[DraftResumeHandler] Packet loaded:", packetId);
          } else {
            console.warn("[DraftResumeHandler] Packet fetch failed for:", packetId);
          }
        }

        // ── 3. Determine restore mode ────────────────────────────────────
        const isPacketBacked = !!packetData;
        const hasWorkingState =
          !!session?.working && Object.keys(session.working).length > 0;

        console.log(
          `[DraftResumeHandler] Restore mode: ${isPacketBacked ? "PACKET-BACKED" : "PREPACKET"} | hasWorkingState: ${hasWorkingState}`,
        );

        if (!isPacketBacked && !hasWorkingState) {
          toast({
            title: "Draft is empty",
            description: "No saved state found for this session.",
            variant: "destructive",
          });
          return;
        }

        // ── 4. Fetch catalog once, used by both modes ────────────────────
        const catalog = await fetchCatalog();
        console.log("[DraftResumeHandler] Catalog loaded:", catalog.reduce((n, c) => n + (c.items?.length || 0), 0), "products");

        // ── 5. Resolve product — different hierarchy per mode ────────────
        let resolvedProduct: CatalogProduct | null = null;
        let resolutionKey = "(none)";

        if (isPacketBacked) {
          // MODE 1 — Packet-backed restore
          // Identity comes from the packet: blueprintId + fulfillmentProvider.
          const packetBlueprint: number | null = packetData?.blueprintId
            ? Number(packetData.blueprintId)
            : null;
          const packetProvider: string = packetData?.fulfillmentProvider ?? "printify";

          console.log("[DraftResumeHandler] [PACKET] Resolving by blueprintId:", packetBlueprint, "| provider:", packetProvider);

          if (packetBlueprint) {
            resolvedProduct = await resolveByBlueprintId(packetBlueprint, packetProvider, catalog);
            resolutionKey = `blueprintId:${packetBlueprint}`;
          }

          // Packet fallback: try sourceMasterId in case blueprintId is missing
          if (!resolvedProduct && session?.sourceMasterId) {
            console.log("[DraftResumeHandler] [PACKET] Blueprint miss — falling back to sourceMasterId:", session.sourceMasterId);
            resolvedProduct = await resolveByDocId(session.sourceMasterId, catalog);
            resolutionKey = `sourceMasterId:${session.sourceMasterId}`;
          }
        } else {
          // MODE 2 — Prepacket working-state restore
          // PRIMARY: sourceMasterId (Firestore doc ID, always set at session creation).
          // SECONDARY: selectedProductDocId saved in the working snapshot (also a Firestore doc ID).
          // TERTIARY: selectedProductBlueprintId (numeric Printify blueprint ID).
          const sourceMasterId: string | null = session?.sourceMasterId ?? null;
          const snapshotDocId: string | null =
            session?.working?.metadata?.selectedProductDocId ?? null;
          const savedBlueprintId: number | null =
            session?.working?.metadata?.selectedProductBlueprintId
              ? Number(session.working.metadata.selectedProductBlueprintId)
              : null;
          const provider: string =
            session?.working?.metadata?.fulfillmentProvider ?? "printify";

          console.log("[DraftResumeHandler] [PREPACKET] Resolving — sourceMasterId:", sourceMasterId, "| snapshotDocId:", snapshotDocId, "| savedBlueprintId:", savedBlueprintId, "| provider:", provider);

          if (sourceMasterId) {
            resolvedProduct = await resolveByDocId(sourceMasterId, catalog);
            resolutionKey = `sourceMasterId:${sourceMasterId}`;
          }

          // If sourceMasterId is a legacy numeric blueprint ID (e.g. "12") that
          // didn't match any docId, try it as a blueprint ID before moving to
          // the working-state fallbacks.
          if (!resolvedProduct && sourceMasterId) {
            const numericMasterId = Number(sourceMasterId);
            if (!isNaN(numericMasterId) && numericMasterId > 0) {
              console.log("[DraftResumeHandler] [PREPACKET] DocId miss — trying sourceMasterId as blueprintId:", numericMasterId);
              resolvedProduct = await resolveByBlueprintId(numericMasterId, provider, catalog);
              if (resolvedProduct) resolutionKey = `sourceMasterId(numeric):${numericMasterId}`;
            }
          }

          if (!resolvedProduct && snapshotDocId) {
            console.log("[DraftResumeHandler] [PREPACKET] sourceMasterId miss — trying snapshotDocId:", snapshotDocId);
            resolvedProduct = await resolveByDocId(snapshotDocId, catalog);
            resolutionKey = `selectedProductDocId:${snapshotDocId}`;
          }

          if (!resolvedProduct && savedBlueprintId) {
            console.log("[DraftResumeHandler] [PREPACKET] DocId miss — trying savedBlueprintId:", savedBlueprintId);
            resolvedProduct = await resolveByBlueprintId(savedBlueprintId, provider, catalog);
            resolutionKey = `selectedProductBlueprintId:${savedBlueprintId}`;
          }

          // Last resort: templateProductHint from qrConfig (numeric hint for the selected product)
          if (!resolvedProduct) {
            const hint: number | null = session?.working?.qrConfig?.templateProductHint
              ? Number(session.working.qrConfig.templateProductHint)
              : null;
            if (hint) {
              console.log("[DraftResumeHandler] [PREPACKET] Blueprint miss — trying templateProductHint:", hint);
              resolvedProduct = await resolveByBlueprintId(hint, provider, catalog);
              resolutionKey = `templateProductHint:${hint}`;
            }
          }
        }

        console.log(
          resolvedProduct
            ? `[DraftResumeHandler] Product resolved via ${resolutionKey}: "${resolvedProduct.title}"`
            : `[DraftResumeHandler] Product NOT resolved (tried: ${resolutionKey})`,
        );

        // Normalize availableColors — Firestore stores QRG codes ("01","02","03"), not {name,hex}.
        // providerMappings carries the actual hex values needed by DesignColorPicker.
        if (resolvedProduct) {
          resolvedProduct = {
            ...resolvedProduct,
            availableColors: normalizeProductColors(resolvedProduct),
          };
        }

        // ── 6. Restore builder state ─────────────────────────────────────
        if (isPacketBacked) {
          console.log("[DraftResumeHandler] Calling loadFromPacketData");
          loadFromPacketData(packetData!, resolvedProduct);
        } else {
          const w = session.working || {};
          console.log(
            `[DraftResumeHandler] Calling loadFromWorkingState` +
            ` | graphics: ${w.graphics ? `content-keys:${Object.keys((w.graphics.content) || {}).length} bg:${w.graphics.loadedBackground ? "yes" : "no"} tpl:${w.graphics.loadedTemplate ? "yes" : "no"} gfx:${w.graphics.loadedGraphic ? "yes" : "no"}` : "null"}` +
            ` | qrConfig: ${w.qrConfig ? `state:${w.qrConfig.qrProductState}` : "null"}` +
            ` | placements: ${JSON.stringify(w.layoutConfig?.selectedPlacements ?? [])}` +
            ` | metadata.channel: ${w.metadata?.selectedChannel?.name ?? "null"}`,
          );
          loadFromWorkingState(session.working, resolvedProduct);
        }

        // ── 7. Register session and packet IDs ───────────────────────────
        setActiveSession(session.id, session.status as any, session.committedInstanceId || null);
        if (packetId) setActivePacketId(packetId);

        // ── 8. Clean URL and toast ───────────────────────────────────────
        const url = new URL(window.location.href);
        url.searchParams.delete("resume");
        window.history.replaceState({}, "", url.pathname + (url.search === "?" ? "" : url.search));

        const draftLabel =
          session.draftName ||
          packetData?.productName ||
          resolvedProduct?.title ||
          "your draft";

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
      } catch (err) {
        console.error("[DraftResumeHandler] resume error:", err);
        toast({ title: "Could not resume draft", variant: "destructive" });
      }
    }

    resume();
  }, []);

  return null;
}
