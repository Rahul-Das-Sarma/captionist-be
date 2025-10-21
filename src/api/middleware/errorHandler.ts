import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../types/api';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  const response: ApiResponse = {
    success: false,
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  };

  res.status(500).json(response);
};
