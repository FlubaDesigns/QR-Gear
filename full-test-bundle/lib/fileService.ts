import { auth } from "@/lib/firebase";

export interface UploadResult {
  url: string;
  mimeType: string;
  fileName: string;
  size: number;
  storagePath: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

export type LibraryStoreType = "internal" | "external" | "member";
export type LibraryMediaType = "video" | "image";

class FileService {
  private async getAuthToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("You must be logged in to upload files");
    }
    return user.getIdToken();
  }

  private getCurrentUserId(): string | null {
    return auth.currentUser?.uid || null;
  }

  async uploadMedia(
    file: File,
    storeType: LibraryStoreType = "internal",
    onProgress?: UploadProgressCallback
  ): Promise<UploadResult> {
    const token = await this.getAuthToken();
    const userId = this.getCurrentUserId();
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("storeType", storeType);
    if (userId) {
      formData.append("userId", userId);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            reject(new Error("Invalid server response"));
          }
        } else if (xhr.status === 401) {
          reject(new Error("Authentication expired. Please refresh and try again."));
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload timed out. Try a smaller file."));

      xhr.open("POST", "/api/test/upload-media");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.timeout = 300000; // 5 minute timeout for large videos
      xhr.send(formData);
    });
  }

  validateMediaFile(file: File, maxSizeMB: number = 100): string | null {
    const maxSize = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSize) {
      return `File too large. Maximum size is ${maxSizeMB}MB`;
    }

    const allowedVideoTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    const allowedImageTypes = [
      "image/gif",
      "image/webp",
      "image/png",
      "image/jpeg",
    ];

    const allowedTypes = [...allowedVideoTypes, ...allowedImageTypes];

    if (!allowedTypes.includes(file.type)) {
      return `Invalid file type. Allowed: MP4, WebM, MOV, GIF, WebP, PNG, JPEG`;
    }

    return null;
  }

  validateImageFile(file: File, maxSizeMB: number = 10): string | null {
    const maxSize = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSize) {
      return `File too large. Maximum size is ${maxSizeMB}MB`;
    }

    const allowedTypes = [
      "image/gif",
      "image/webp",
      "image/png",
      "image/jpeg",
    ];

    if (!allowedTypes.includes(file.type)) {
      return `Invalid file type. Allowed: GIF, WebP, PNG, JPEG`;
    }

    return null;
  }
}

export const fileService = new FileService();
