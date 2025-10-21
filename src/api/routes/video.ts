import express from 'express';
import multer from 'multer';
import { VideoProcessor } from '../../services/videoProcessor';
import { FileStorage } from '../../services/fileStorage';
import { validateVideoUpload } from '../middleware/validation';
import { ApiResponse, UploadResponse } from '../../types/api';

const router = express.Router();
const videoProcessor = new VideoProcessor();
const fileStorage = new FileStorage();

// Configure multer for video uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/webm',
      'video/quicktime',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format') as any, false);
    }
  },
});

// Handle CORS preflight for upload
router.options('/upload', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, Origin, X-Requested-With'
  );
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Upload video
router.post(
  '/upload',
  upload.single('video'),
  validateVideoUpload,
  async (req, res) => {
    try {
      console.log('Upload request received:', {
        hasFile: !!req.file,
        fileSize: req.file?.size,
        fileName: req.file?.originalname,
        mimeType: req.file?.mimetype,
      });

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No video file provided',
        } as ApiResponse);
      }

      console.log('Storing file...');
      // Store file
      const fileId = await fileStorage.storeVideo(req.file);
      console.log('File stored with ID:', fileId);

      // Process video metadata
      console.log('Getting video metadata...');
      const metadata = await videoProcessor.getVideoMetadata(req.file);
      console.log('Video metadata:', metadata);

      // Store metadata in database
      await videoProcessor.saveVideoMetadata(
        fileId,
        req.file.originalname,
        metadata
      );

      const response: ApiResponse<UploadResponse> = {
        success: true,
        data: {
          fileId,
          filename: req.file.originalname,
          size: req.file.size,
          url: `/api/video/${fileId}/stream`,
        },
      };

      // Set CORS headers
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      return res.json(response);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      } as ApiResponse);
    }
  }
);

// Get video metadata
router.get('/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = await videoProcessor.getVideoMetadataById(id);

    return res.json({
      success: true,
      data: metadata,
    } as ApiResponse);
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      error: 'Video not found',
    } as ApiResponse);
  }
});

// Stream video
router.get('/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;
    const videoStream = await fileStorage.getVideoStream(id);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    videoStream.pipe(res);
    return;
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      error: 'Video not found',
    } as ApiResponse);
  }
});

export default router;
