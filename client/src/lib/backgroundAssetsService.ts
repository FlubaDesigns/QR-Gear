import { apiRequest } from "./queryClient";
import { auth } from "./firebase";

export interface BackgroundAsset {
  id: string;
  name: string;
  assetType: "source" | "cropped";
  imageUrl: string;
  storagePath: string;
  sourceAssetId: string | null;
  mimeType: string;
  cropData: any | null;
  tags: string[] | null;
  isActive: boolean;
  createdAt: string;
  proxyUrl: string;
}

export interface UploadBackgroundParams {
  name: string;
  file: File;
  tags?: string[];
}

export interface UpdateBackgroundParams {
  name?: string;
  tags?: string[];
  isActive?: boolean;
}

const ENDPOINT = "/api/admin/background-assets";
export const QUERY_KEY = [ENDPOINT, "source"] as const;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const backgroundAssetsService = {
  async list(type: "source" | "cropped" = "source"): Promise<BackgroundAsset[]> {
    const res = await apiRequest("GET", `${ENDPOINT}?type=${type}`);
    return res.json();
  },

  async upload(params: UploadBackgroundParams): Promise<BackgroundAsset> {
    const imageData = await fileToBase64(params.file);
    const authHeaders = await getAuthHeaders();

    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        name: params.name || params.file.name,
        assetType: "source",
        imageData,
        mimeType: params.file.type,
        tags: params.tags || null,
      }),
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }

    return res.json();
  },

  async update(id: string, params: UpdateBackgroundParams): Promise<BackgroundAsset> {
    const res = await apiRequest("PUT", `${ENDPOINT}/${id}`, params);
    return res.json();
  },

  async delete(id: string): Promise<void> {
    await apiRequest("DELETE", `${ENDPOINT}/${id}`, {});
  },

  async uploadCropped(params: {
    name: string;
    imageData: string;
    mimeType: string;
    sourceAssetId: string;
    cropData: any;
  }): Promise<BackgroundAsset> {
    const authHeaders = await getAuthHeaders();

    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        ...params,
        assetType: "cropped",
      }),
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }

    return res.json();
  },
};

export default backgroundAssetsService;
