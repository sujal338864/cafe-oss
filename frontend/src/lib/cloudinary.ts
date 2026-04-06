/**
 * Cloudinary Transformation Utility
 * Optimizes images for SaaS performance (f_auto, q_auto, width-capping)
 */

export const getOptimizedImage = (url: string | null | undefined, width = 400) => {
  if (!url) return null;
  
  // If not a Cloudinary URL, return as is
  if (!url.includes('cloudinary.com')) return url;

  // Cloudinary URL format: .../upload/v12345/path/to/image.jpg
  // We want: .../upload/f_auto,q_auto,w_{width}/v12345/path/to/image.jpg
  
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  return `${parts[0]}/upload/f_auto,q_auto,w_${width}/${parts[1]}`;
};
