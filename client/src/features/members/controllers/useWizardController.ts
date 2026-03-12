import { useMemo, useCallback, useState } from "react";
import { resolveDescription } from "@shared/descriptionLayers";

export type WizardMode = "member" | "owner" | "public";

export interface WizardProductItem {
  canonicalBlankKey: string;
  title: string;
  imageUrl: string | null;
  baseCost: number;
  retailPrice: number;
  providerDescription: string | null;
  adminCatalogDescription: string | null;
  memberPacketDescription: string | null;
  effectiveDescription: string;
  fulfillmentProvider: string;
  providerProductId: string;
  availableColors: Array<{ name: string; hex?: string }>;
  availableSizes: string[];
  tier?: string;
}

export interface WizardControllerState {
  wizardMode: WizardMode;
  canEditDescription: boolean;
  isReadOnly: boolean;
  detailItem: WizardProductItem | null;
  detailOpen: boolean;
}

export interface WizardControllerActions {
  onOpenDetail: (item: WizardProductItem) => void;
  onCloseDetail: () => void;
  onSaveDescription: (item: WizardProductItem, value: string) => void;
}

export function useWizardController(mode: WizardMode) {
  const [detailItem, setDetailItem] = useState<WizardProductItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const canEditDescription = mode === "member";
  const isReadOnly = mode !== "member";

  const resolveProductDescription = useCallback((product: {
    providerDescription?: string | null;
    adminCatalogDescription?: string | null;
    memberPacketDescription?: string | null;
  }): string => {
    if (mode === "member") {
      return resolveDescription({
        memberPacketDescription: product.memberPacketDescription || null,
        adminCatalogDescription: product.adminCatalogDescription || null,
        providerDescription: product.providerDescription || null,
      });
    }
    return resolveDescription({
      memberPacketDescription: null,
      adminCatalogDescription: product.adminCatalogDescription || null,
      providerDescription: product.providerDescription || null,
    });
  }, [mode]);

  const normalizeForViewer = useCallback((product: any): WizardProductItem => {
    return {
      canonicalBlankKey: product.canonicalBlankKey || "",
      title: product.title || product.name || "",
      imageUrl: product.imageUrl || product.primaryImageUrl || null,
      baseCost: product.baseCost ?? product.cost ?? 0,
      retailPrice: product.retailPrice ?? product.price ?? 0,
      providerDescription: product.providerDescription || null,
      adminCatalogDescription: product.adminCatalogDescription || null,
      memberPacketDescription: product.memberPacketDescription || null,
      effectiveDescription: resolveProductDescription(product),
      fulfillmentProvider: product.fulfillmentProvider || "printify",
      providerProductId: product.providerProductId || String(product.id || ""),
      availableColors: product.availableColors || product.colorsAvailable || [],
      availableSizes: product.availableSizes || product.sizesAvailable || [],
      tier: product.tier,
    };
  }, [resolveProductDescription]);

  const onOpenDetail = useCallback((item: WizardProductItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const onCloseDetail = useCallback(() => {
    setDetailItem(null);
    setDetailOpen(false);
  }, []);

  const onSaveDescription = useCallback((item: WizardProductItem, value: string) => {
    if (!canEditDescription) return;
    setDetailItem(prev => prev ? { ...prev, memberPacketDescription: value, effectiveDescription: value || prev.effectiveDescription } : null);
  }, [canEditDescription]);

  const state: WizardControllerState = useMemo(() => ({
    wizardMode: mode,
    canEditDescription,
    isReadOnly,
    detailItem,
    detailOpen,
  }), [mode, canEditDescription, isReadOnly, detailItem, detailOpen]);

  const actions: WizardControllerActions = useMemo(() => ({
    onOpenDetail,
    onCloseDetail,
    onSaveDescription,
  }), [onOpenDetail, onCloseDetail, onSaveDescription]);

  return {
    state,
    actions,
    normalizeForViewer,
    resolveProductDescription,
  };
}
