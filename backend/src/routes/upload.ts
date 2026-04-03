import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();

// POST /api/upload/image
// Body: { data: 'base64string', filename: 'name.jpg' }
router.post('/image', authenticate as any, asyncHandler(async (req: AuthRequest, res) => {
  const { data, filename } = req.body;
  if (!data) return res.status(400).json({ error: 'No image data' });
  try {
    const result = await cloudinary.uploader.upload(data, {
      upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
      folder: 'shop-os/products',
      public_id: filename ? filename.split('.')[0] + '-' + Date.now() : undefined,
      resource_type: 'image',
    });
    return res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (e: any) {
    return res.status(500).json({ error: 'Upload failed', details: e.message });
  }
}));

export default router;
