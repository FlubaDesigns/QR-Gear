/* Firebase Storage Helper - Kingdom Connects */
import { storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

export async function uploadBusinessImage(businessId, file, type = 'images') {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storageRef = ref(storage, `businesses/${businessId}/${type}/${timestamp}_${sanitizedName}`);
  
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return {
      success: true,
      url: downloadURL,
      path: snapshot.ref.fullPath,
      name: file.name,
      size: file.size
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function uploadChurchImage(churchId, file, type = 'images') {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storageRef = ref(storage, `churches/${churchId}/${type}/${timestamp}_${sanitizedName}`);
  
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return {
      success: true,
      url: downloadURL,
      path: snapshot.ref.fullPath,
      name: file.name,
      size: file.size
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function deleteFile(filePath) {
  try {
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: error.message };
  }
}

export async function listBusinessFiles(businessId, type = 'images') {
  try {
    const listRef = ref(storage, `businesses/${businessId}/${type}`);
    const result = await listAll(listRef);
    
    const files = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          path: itemRef.fullPath,
          url: url
        };
      })
    );
    
    return { success: true, files };
  } catch (error) {
    console.error('List error:', error);
    return { success: false, error: error.message, files: [] };
  }
}

export async function listChurchFiles(churchId, type = 'images') {
  try {
    const listRef = ref(storage, `churches/${churchId}/${type}`);
    const result = await listAll(listRef);
    
    const files = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          path: itemRef.fullPath,
          url: url
        };
      })
    );
    
    return { success: true, files };
  } catch (error) {
    console.error('List error:', error);
    return { success: false, error: error.message, files: [] };
  }
}

export function validateFile(file, options = {}) {
  const {
    maxSize = 10 * 1024 * 1024,
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
  } = options;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload images (JPEG, PNG, GIF, WebP) or videos (MP4, WebM).'
    };
  }

  return { valid: true };
}
