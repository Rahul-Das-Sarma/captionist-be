import express from 'express';
import path from 'path';
import fs from 'fs';
import { ExportService } from '../../services/exportService';
import { exportRateLimiter } from '../middleware/rateLimiter';
import {
  validateCaptionStyle,
  normalizeCaptionStyle,
  createStyleFromPreset,
  CAPTION_STYLE_PRESETS,
  CaptionStyle,
} from '../../types/captions';

const router = express.Router();
const exportService = new ExportService();

// Apply lenient rate limiting to all export routes
router.use(exportRateLimiter);

// Function to map flat style properties to nested CaptionStyle structure
function mapFlatStyleToNested(flatStyle: any): CaptionStyle {
  return {
    position: {
      type: flatStyle.type || flatStyle.position || 'bottom',
      x: flatStyle.x,
      y: flatStyle.y,
      margin: flatStyle.margin || 20,
    },
    typography: {
      fontFamily: flatStyle.fontFamily || 'Arial',
      fontSize: flatStyle.fontSize || 20,
      fontWeight: flatStyle.fontWeight || 'normal',
      fontColor: flatStyle.color || '#FFFFFF',
      textAlign: flatStyle.textAlign || 'center',
      lineHeight: flatStyle.lineHeight,
      letterSpacing: flatStyle.letterSpacing,
    },
    background: {
      enabled: flatStyle.backgroundColor ? true : false,
      color: flatStyle.backgroundColor || '#000000',
      opacity: flatStyle.opacity || 0.8,
      borderRadius: flatStyle.borderRadius || 0,
      padding: {
        top: flatStyle.padding || 0,
        right: flatStyle.padding || 0,
        bottom: flatStyle.padding || 0,
        left: flatStyle.padding || 0,
      },
    },
    border: {
      enabled: flatStyle.borderWidth ? flatStyle.borderWidth > 0 : false,
      color: flatStyle.borderColor || '#000000',
      width: flatStyle.borderWidth || 0,
      style: 'solid',
    },
    shadow: {
      enabled: flatStyle.shadowBlur ? flatStyle.shadowBlur > 0 : false,
      color: flatStyle.shadowColor || '#000000',
      blur: flatStyle.shadowBlur || 0,
      offsetX: flatStyle.shadowOffsetX || 0,
      offsetY: flatStyle.shadowOffsetY || 0,
    },
    animation: {
      type: flatStyle.animationType || 'none',
      duration: flatStyle.animationDuration || 0,
      delay: flatStyle.animationDelay || 0,
      easing: flatStyle.animationEasing || 'linear',
    },
    effects: {
      opacity: flatStyle.opacity || 1,
      rotation: flatStyle.rotation || 0,
      scale: flatStyle.scale || 1,
      blur: flatStyle.backdropBlur || 0,
    },
  };
}

router.post('/burn-in', async (req, res): Promise<void> => {
  try {
    const { videoId, captions, style, output, preset } = req.body || {};

    console.log('Burn-in request received:', {
      videoId,
      hasCaptions: Array.isArray(captions),
      captionsLength: captions?.length,
      hasStyle: !!style,
      hasPreset: !!preset,
      styleKeys: style ? Object.keys(style) : null,
    });

    // Debug: Log first caption structure (can be removed in production)
    if (captions && captions.length > 0) {
      console.log('First caption structure:', {
        hasText: !!captions[0].text,
        hasStartTime: typeof captions[0].startTime,
        hasEndTime: typeof captions[0].endTime,
        startTimeValue: captions[0].startTime,
        endTimeValue: captions[0].endTime,
        textValue: captions[0].text,
        captionKeys: Object.keys(captions[0]),
      });
    }

    if (!videoId || !Array.isArray(captions)) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: videoId and captions',
      });
      return;
    }

    // Validate captions array
    if (captions.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Captions array cannot be empty',
      });
      return;
    }

    // Validate each caption has required fields
    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i];
      if (
        !caption.text ||
        typeof caption.startTime !== 'number' ||
        typeof caption.endTime !== 'number'
      ) {
        console.log(`Caption validation failed at index ${i}:`, {
          hasText: !!caption.text,
          textType: typeof caption.text,
          textValue: caption.text,
          hasStartTime: typeof caption.startTime,
          startTimeValue: caption.startTime,
          hasEndTime: typeof caption.endTime,
          endTimeValue: caption.endTime,
          allKeys: Object.keys(caption),
        });
        res.status(400).json({
          success: false,
          error: 'Each caption must have text, startTime, and endTime',
        });
        return;
      }
    }

    // Handle styling - either use preset or validate custom style
    let finalStyle;
    if (preset) {
      // Use preset with optional overrides
      const mappedStyle = style ? mapFlatStyleToNested(style) : undefined;
      finalStyle = createStyleFromPreset(preset, mappedStyle);
    } else if (style && typeof style === 'object') {
      // Map flat style to nested structure first
      const mappedStyle = mapFlatStyleToNested(style);

      // Validate and normalize custom style
      const validation = validateCaptionStyle(mappedStyle);
      if (!validation.isValid) {
        console.log('Style validation failed:', validation.errors);
        res.status(400).json({
          success: false,
          error: 'Invalid style configuration',
          details: validation.errors,
        });
        return;
      }
      finalStyle = normalizeCaptionStyle(mappedStyle);
    } else {
      // Default to classic preset
      finalStyle = createStyleFromPreset('classic');
    }

    const jobId = exportService.startBurnIn({
      videoId,
      captions,
      style: finalStyle,
      output,
    });

    res.json({
      success: true,
      data: {
        jobId,
        status: 'pending',
        progress: 0,
        style: finalStyle, // Return the processed style for reference
      },
    });
  } catch (err: any) {
    console.error('Burn-in export error:', err);
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

// Get available style presets
router.get('/presets', (req, res): void => {
  const presets = Object.keys(CAPTION_STYLE_PRESETS).map(key => ({
    name: key,
    displayName: key.charAt(0).toUpperCase() + key.slice(1),
    style: CAPTION_STYLE_PRESETS[key],
  }));

  res.json({
    success: true,
    data: presets,
  });
});

// Get specific preset details
router.get('/presets/:presetName', (req, res): void => {
  const { presetName } = req.params;
  const preset = CAPTION_STYLE_PRESETS[presetName];

  if (!preset) {
    res.status(404).json({
      success: false,
      error: 'Preset not found',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      name: presetName,
      displayName: presetName.charAt(0).toUpperCase() + presetName.slice(1),
      style: preset,
    },
  });
});

export default router;
