import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../types/api';

// Simple in-memory rate limiter
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000; // 15 minutes
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '100');

  const clientData = requestCounts.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    // Reset or initialize
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + windowMs,
    });
    return next();
  }

  if (clientData.count >= maxRequests) {
    const response: ApiResponse = {
      success: false,
      error: 'Too many requests, please try again later',
    };
    return res.status(429).json(response);
  }

  clientData.count++;
  next();
};
