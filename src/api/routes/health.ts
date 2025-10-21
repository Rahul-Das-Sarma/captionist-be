import express from 'express';
import { ApiResponse } from '../../types/api';

const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    },
  };

  res.json(response);
});

export default router;
