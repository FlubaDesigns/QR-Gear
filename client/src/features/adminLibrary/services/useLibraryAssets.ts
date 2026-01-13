import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLibraryContext } from "../LibraryContext";
import type { CustomDesign, LibraryAsset, BackgroundAssetWithProxy } from "../shared/types";

export function useTemplates() {
  const { apiBase } = useLibraryContext();
  const { toast } = useToast();

  const query = useQuery<CustomDesign[]>({
    queryKey: [`${apiBase}/admin/library/templates`],
    queryFn: async () => {
      const res = await apiRequest("GET", `${apiBase}/admin/library/templates`);
      return res.json();
    },
  });

  const removeFromLibrary = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `${apiBase}/admin/custom-designs/${id}`, { savedToLibrary: false });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Template Removed",
        description: "The design has been removed from your library.",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/library/templates`] });
    },
    onError: (error: any) => {
      toast({
        title: "Remove Failed",
        description: error?.message || "Couldn't remove the template.",
        variant: "destructive",
      });
    },
  });

  return { ...query, removeFromLibrary };
}

export function useLibraryBackgrounds() {
  const { apiBase } = useLibraryContext();
  const { toast } = useToast();

  const query = useQuery<BackgroundAssetWithProxy[]>({
    queryKey: [`${apiBase}/admin/library/backgrounds`],
    queryFn: async () => {
      const res = await apiRequest("GET", `${apiBase}/admin/library/backgrounds`);
      return res.json();
    },
  });

  const uploadBackground = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`${apiBase}/admin/library/backgrounds`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Upload failed");
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Background Uploaded", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/library/backgrounds`] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error?.message || "Couldn't upload the background.",
        variant: "destructive",
      });
    },
  });

  const deleteBackground = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `${apiBase}/admin/library/backgrounds/${id}`);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Background Deleted", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/library/backgrounds`] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Couldn't delete the background.",
        variant: "destructive",
      });
    },
  });

  return { ...query, uploadBackground, deleteBackground };
}

export function useSourceImages() {
  const { apiBase } = useLibraryContext();
  const { toast } = useToast();

  const query = useQuery<LibraryAsset[]>({
    queryKey: [`${apiBase}/admin/library/assets`, "source"],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/admin/library/assets?type=source`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch source images");
      return await response.json();
    },
  });

  const uploadSource = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`${apiBase}/admin/library/assets`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Upload failed");
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Source Image Uploaded", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/library/assets`, "source"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error?.message || "Couldn't upload the image.",
        variant: "destructive",
      });
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `${apiBase}/admin/library/assets/${id}`);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Source Image Deleted", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/library/assets`, "source"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Couldn't delete the image.",
        variant: "destructive",
      });
    },
  });

  return { ...query, uploadSource, deleteSource };
}

export function useCroppedImages() {
  const { apiBase } = useLibraryContext();
  const { toast } = useToast();

  const query = useQuery<LibraryAsset[]>({
    queryKey: [`${apiBase}/admin/library/assets`, "cropped"],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/admin/library/assets?type=cropped`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch cropped images");
      return await response.json();
    },
  });

  const deleteCropped = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `${apiBase}/admin/library/assets/${id}`);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Cropped Image Deleted", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/admin/library/assets`, "cropped"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Couldn't delete the image.",
        variant: "destructive",
      });
    },
  });

  return { ...query, deleteCropped };
}
