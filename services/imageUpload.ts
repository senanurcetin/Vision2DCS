export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Raw upload limit; larger drawings are downscaled before they are sent.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// Longest side sent to the model. Enough to read ISA tag bubbles on an A3 sheet.
export const MAX_IMAGE_DIMENSION = 2048;

export interface PreparedImage {
  base64: string;
  mimeType: string;
  dataUrl: string;
}

/** Returns a user-facing reason the file cannot be analyzed, or null if it can. */
export const validateImageFile = (file: { type: string; size: number }): string | null => {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) return 'Unsupported file type. Upload a JPEG, PNG or WebP image.';
  if (file.size > MAX_UPLOAD_BYTES) return 'File is too large. The limit is 25 MB.';
  return null;
};

/** Size that fits within max on the longest side, keeping the aspect ratio. Never upscales. */
export const scaleToFit = (width: number, height: number, max = MAX_IMAGE_DIMENSION) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });

const toPrepared = (dataUrl: string, mimeType: string): PreparedImage =>
  ({ base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType, dataUrl });

/**
 * Reads the image and downscales it when its longest side exceeds
 * MAX_IMAGE_DIMENSION, keeping the original format so line drawings stay crisp.
 */
export const prepareImage = async (file: File): Promise<PreparedImage> => {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('The file could not be decoded as an image.');
  });
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height);
    if (width === bitmap.width && height === bitmap.height) {
      return toPrepared(await readAsDataUrl(file), file.type);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not resize the image in this browser.');
    context.drawImage(bitmap, 0, 0, width, height);
    const dataUrl = canvas.toDataURL(file.type, 0.92);
    // Browsers fall back to PNG for formats they cannot encode
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
    return toPrepared(dataUrl, mimeType);
  } finally {
    bitmap.close();
  }
};
