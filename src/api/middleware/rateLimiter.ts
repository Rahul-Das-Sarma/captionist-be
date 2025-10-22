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

  // More lenient rate limiting for status checks
  if (req.path.includes('/status/')) {
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 300; // 300 requests per minute for status checks (5 per second)
    const clientData = requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (clientData.count >= maxRequests) {
      const response: ApiResponse = {
        success: false,
        error: 'Too many status requests, please slow down',
      };
      return res.status(429).json(response);
    }

    clientData.count++;
    return next();
  }

  // Standard rate limiting for other endpoints
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000; // 15 minutes
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '200'); // Increased from 100

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

// More lenient rate limiter specifically for export endpoints
export const exportRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();

  // Very lenient rate limiting for export operations
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxRequests = 1000; // 1000 requests per 5 minutes for export operations (very lenient)

  const clientData = requestCounts.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + windowMs,
    });
    return next();
  }

  if (clientData.count >= maxRequests) {
    const response: ApiResponse = {
      success: false,
      error: 'Too many export requests, please wait before trying again',
    };
    return res.status(429).json(response);
  }

  clientData.count++;
  next();
};
