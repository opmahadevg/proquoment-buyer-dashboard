import { ChatImage } from '@/lib/rfq/types';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGES_PER_MESSAGE = 5;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file format, size, and integrity.
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid format (${file.type || 'unknown'}). Only JPEG, PNG, and WebP are supported.`,
    };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 5 MB limit.`,
    };
  }
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File appears to be empty or corrupted.',
    };
  }
  return { valid: true };
}

/**
 * Converts a File object into a structured ChatImage with Base64 Data URL.
 */
export function fileToChatImage(file: File): Promise<ChatImage> {
  return new Promise((resolve, reject) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return reject(new Error(validation.error));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const uniqueId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      resolve({
        id: uniqueId,
        url: dataUrl,
        title: file.name,
        mimeType: file.type,
        size: file.size,
        source: 'upload',
      });
    };
    reader.onerror = () => {
      reject(new Error('Failed to read image file. Please try re-uploading.'));
    };
    reader.readAsDataURL(file);
  });
}
