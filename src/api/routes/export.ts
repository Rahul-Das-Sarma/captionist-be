import express from 'express';
import path from 'path';
import fs from 'fs';
import { ExportService } from '../../services/exportService';

const router = express.Router();
const exportService = new ExportService();

router.post('/burn-in', async (req, res): Promise<void> => {
  try {
    const { videoId, captions, style, output } = req.body || {};
    if (!videoId || !Array.isArray(captions) || !style) {
      res.status(400).json({ success: false, error: 'Invalid payload' });
      return;
    }
    const jobId = exportService.startBurnIn({
      videoId,
      captions,
      style,
      output,
    });
    res.json({
      success: true,
      data: { jobId, status: 'pending', progress: 0 },
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ success: false, error: err.message || 'Failed to start export' });
  }
});

router.get('/status/:jobId', (req, res): void => {
  const job = exportService.getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ success: false, error: 'Job not found' });
    return;
  }
  res.json({ success: true, data: job });
});

router.get('/:jobId/download', (req, res): void => {
  const job = exportService.getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ success: false, error: 'Job not found' });
    return;
  }
  if (job.status !== 'completed' || !job.outputPath) {
    res.status(409).json({ success: false, error: 'Export not ready' });
    return;
  }
  if (!fs.existsSync(job.outputPath)) {
    res.status(404).json({ success: false, error: 'File missing' });
    return;
  }
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${path.basename(job.outputPath)}`
  );
  const mime = 'video/mp4';
  res.setHeader('Content-Type', mime);
  fs.createReadStream(job.outputPath).pipe(res);
});

export default router;
