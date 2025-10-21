import express from 'express';
import multer from 'multer';
import { TranscriptionService } from '../../services/transcriptionService';
import { ApiResponse } from '../../types/api';

const router = express.Router();
const transcriptionService = new TranscriptionService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Transcribe video
router.post('/transcribe', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided',
      } as ApiResponse);
    }

    const { language = 'en-US' } = req.body;

    // Start transcription job
    const jobId = await transcriptionService.startTranscription({
      file: req.file,
      language,
      onProgress: progress => {
        // Emit progress via WebSocket or Server-Sent Events
        console.log(`Transcription progress: ${progress}%`);
      },
      onResult: transcript => {
        console.log('Transcription completed:', transcript);
      },
      onError: error => {
        console.error('Transcription error:', error);
      },
    });

    return res.json({
      success: true,
      data: { jobId, status: 'pending' },
    } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

// Get transcription status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await transcriptionService.getJobStatus(jobId);

    return res.json({
      success: true,
      data: status,
    } as ApiResponse);
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      error: 'Job not found',
    } as ApiResponse);
  }
});

export default router;
