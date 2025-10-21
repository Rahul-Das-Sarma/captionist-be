import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../../types/api';

export const validateVideoUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    const response: ApiResponse = {
      success: false,
      error: 'No video file provided',
    };
    return res.status(400).json(response);
  }

  const allowedTypes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/webm',
    'video/quicktime',
  ];

  if (!allowedTypes.includes(req.file.mimetype)) {
    const response: ApiResponse = {
      success: false,
      error: 'Invalid video format. Supported formats: MP4, AVI, MOV, WebM',
    };
    return res.status(400).json(response);
  }

  return next();
};

export const validateCaptionGeneration = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const schema = Joi.object({
    videoId: Joi.string().required(),
    transcript: Joi.string().required(),
    style: Joi.object({
      type: Joi.string().valid('reel', 'classic', 'bounce', 'slide').required(),
      position: Joi.string().valid('bottom', 'center', 'top').required(),
      fontSize: Joi.number().min(12).max(72).required(),
      fontFamily: Joi.string().required(),
      color: Joi.string().required(),
      backgroundColor: Joi.string().required(),
      padding: Joi.number().min(0).max(50).required(),
      borderRadius: Joi.number().min(0).max(25).required(),
    }).required(),
    options: Joi.object({
      maxSegmentDuration: Joi.number().min(1).max(10).required(),
      minSegmentDuration: Joi.number().min(0.5).max(5).required(),
      wordPerMinute: Joi.number().min(50).max(300).required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response: ApiResponse = {
      success: false,
      error: error.details[0].message,
    };
    return res.status(400).json(response);
  }

  return next();
};
