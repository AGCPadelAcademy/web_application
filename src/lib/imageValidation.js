/** Shared image upload validation (child avatars, camp flyers). */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Returns null when the file is acceptable, otherwise a user-facing message. */
export function validateImageFile(file) {
  if (!file) return null;
  if (!IMAGE_TYPES.includes(file.type)) {
    return 'Please choose a PNG, JPEG, or WebP image.';
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return 'The image must be 5 MB or smaller.';
  }
  return null;
}

/** Safe object-path extension for an uploaded image. */
export function imageFileExtension(file) {
  return (file?.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}
