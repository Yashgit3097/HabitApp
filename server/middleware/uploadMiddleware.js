import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Use in-memory storage so NO files are stored locally on the server disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

/**
 * Uploads an in-memory file buffer directly to Cloudinary and returns the secure HTTPS URL.
 * @param {Express.Multer.File} file - Multer memory storage file object with buffer
 * @returns {Promise<string|null>} Cloudinary secure URL
 */
export const processUploadedFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      return resolve(null);
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'habit_tracker',
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(new Error(`Cloudinary upload failed: ${error.message || error}`));
        }
        resolve(result.secure_url);
      }
    );

    uploadStream.end(file.buffer);
  });
};
