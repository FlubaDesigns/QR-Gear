import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import { normalizeImageFolder, validateImageUpload, type AdminImage } from '@shared/imageLibrary';
import type { SkinItem } from './components/skins/types';

export const ADMIN_IMAGES_QK = ['admin-images'] as const;
export const ADMIN_IMAGE_FOLDERS_QK = [...ADMIN_IMAGES_QK, 'folders'] as const;
export function useAdminImages(folder: string | null, enabled = true) {
  return useQuery({ queryKey: [...ADMIN_IMAGES_QK, 'list', folder], enabled,
    queryFn: () => adminFetch<AdminImage[]>(`/images${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`) });
}
export function useAdminImageFolders(enabled = true) {
  return useQuery({ queryKey: ADMIN_IMAGE_FOLDERS_QK, enabled, queryFn: () => adminFetch<string[]>('/images/folders') });
}
export function adminImageToSkinItem(image: AdminImage): SkinItem {
  return { id: image.id, name: image.name, primaryImage: image.publicUrl, metadata: { raw: image } };
}
export interface ImageUpload { file: Blob; name: string }
export async function uploadAdminImages({ files, folder }: { files: ImageUpload[]; folder: string }) {
  const uploaded: AdminImage[] = [];
  const failed: { name: string; message: string }[] = [];
  for (const { file, name } of files) {
    try {
      validateImageUpload(file.type, file.size);
      const body = new FormData();
      body.append('file', file, name); body.append('name', name); body.append('folder', normalizeImageFolder(folder));
      uploaded.push(await adminFetch<AdminImage>('/images', { method: 'POST', body }));
    } catch (error) { failed.push({ name, message: (error as Error).message }); }
  }
  return { uploaded, failed };
}
export function useAdminImageUpload() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: uploadAdminImages, onSettled: () => queryClient.invalidateQueries({ queryKey: ADMIN_IMAGES_QK }) });
}
export function useCreateImageFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminFetch<{ folder: string; created: boolean }>('/images/folders', { method: 'POST', json: { name: normalizeImageFolder(name) } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_IMAGES_QK }),
  });
}
export type { AdminImage };
