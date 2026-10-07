import { useQuery } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import type { LibraryTemplate } from '@shared/templateDisplay';
import type { SkinItem } from './components/skins/types';
import { QR_PRODUCT_STATES } from '@/features/adminProducts/builder/types';

export const TEMPLATE_LIBRARY_QK = ['/api/admin/templates'] as const;
export async function fetchTemplateLibrary(): Promise<LibraryTemplate[]> {
  const data = await adminFetch<{ templates: LibraryTemplate[] }>('/templates');
  return data.templates;
}
export function useTemplateLibrary(enabled = true) {
  return useQuery({ queryKey: TEMPLATE_LIBRARY_QK, queryFn: fetchTemplateLibrary, enabled });
}
export function templateToSkinItem(item: LibraryTemplate): SkinItem {
  const packet = item.packet;
  const mode = item.qrProductState || packet?.qrProductState;
  return {
    id: item.id,
    packetId: item.packetId || undefined,
    name: item.previewTitle,
    primaryImage: item.previewImageUrl,
    images: item.previewImages,
    price: item.previewPrice,
    qrContent: item.qrContent || packet?.qrContent,
    headerText: item.headerText || packet?.headerText,
    footerText: item.footerText || packet?.footerText,
    qrMode: QR_PRODUCT_STATES.find(type => type.id === mode)?.label,
    createdAt: item.createdAt,
    metadata: item,
  };
}
export type { LibraryTemplate };
