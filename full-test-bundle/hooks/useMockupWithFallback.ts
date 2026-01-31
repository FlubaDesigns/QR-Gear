import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CachedMockups {
  mockups: Record<string, { front?: string; back?: string }>;
  count: number;
}

interface PlacementData {
  id: string;
  label: string;
  description: string;
  category: string;
  previewX: string;
  previewY: string;
  previewScale: string;
  sortOrder: number;
  isActive: boolean;
}

interface MockupResult {
  mockupUrl: string;
  fromCache: boolean;
  generatedAt: string;
}

export function useCachedMockups(blueprintId?: number, printProviderId?: number) {
  return useQuery<CachedMockups>({
    queryKey: ["/api/mockups/cached", blueprintId, printProviderId],
    enabled: !!blueprintId && !!printProviderId,
  });
}

export function usePlacements(category?: string) {
  const queryKey = category 
    ? ["/api/placements", { category }]
    : ["/api/placements"];
    
  return useQuery<PlacementData[]>({
    queryKey,
  });
}

export function useGenerateMockup() {
  const queryClient = useQueryClient();

  return useMutation<
    MockupResult,
    Error,
    {
      blueprintId: number;
      printProviderId: number;
      colorName: string;
      colorHex?: string;
      canonicalPlacementId?: string;
      artworkUrl: string;
      artworkVariant?: "black" | "white";
    }
  >({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/mockups/get-or-generate", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/mockups/cached", variables.blueprintId, variables.printProviderId],
      });
    },
  });
}

export function isColorDark(hexColor: string): boolean {
  if (!hexColor) return false;
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return false;
  
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance < 0.5;
}

export function getPlacementPositionFromData(
  placement: PlacementData | undefined
): { x: number; y: number; scale: number } {
  if (!placement) {
    return { x: 0.5, y: 0.4, scale: 0.25 };
  }
  return {
    x: parseFloat(placement.previewX) || 0.5,
    y: parseFloat(placement.previewY) || 0.4,
    scale: parseFloat(placement.previewScale) || 0.25,
  };
}
