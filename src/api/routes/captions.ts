import express from 'express';
import { CaptionGenerator } from '../../services/captionGenerator';
import { validateCaptionGeneration } from '../middleware/validation';
import {
  CaptionGenerationRequest,
  CaptionGenerationResponse,
} from '../../types/captions';
import { ApiResponse } from '../../types/api';

const router = express.Router();
const captionGenerator = new CaptionGenerator();

// Generate captions
router.post('/generate', validateCaptionGeneration, async (req, res) => {
  try {
    const request: CaptionGenerationRequest = req.body;

    // Start caption generation job
    const jobId = await captionGenerator.startGeneration(request);

    const response: CaptionGenerationResponse = {
      jobId,
      status: 'pending',
      progress: 0,
    };

    res.json({
      success: true,
      data: response,
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

// Get caption generation status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await captionGenerator.getJobStatus(jobId);

    res.json({
      success: true,
      data: status,
    } as ApiResponse);
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: 'Job not found',
    } as ApiResponse);
  }
});

// Get generated captions
router.get('/:jobId/captions', async (req, res) => {
  try {
    const { jobId } = req.params;
    const captions = await captionGenerator.getCaptions(jobId);

    res.json({
      success: true,
      data: captions,
    } as ApiResponse);
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: 'Captions not found',
    } as ApiResponse);
  }
});

// Download captions as SRT
router.get('/:jobId/download/srt', async (req, res) => {
  try {
    const { jobId } = req.params;
    const srtContent = await captionGenerator.exportToSRT(jobId);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="captions.srt"');
    res.send(srtContent);
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: 'SRT file not found',
    } as ApiResponse);
  }
});

export default router;
