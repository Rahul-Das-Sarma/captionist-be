import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import videoRoutes from './api/routes/video';
import exportRoutes from './api/routes/export';
import captionRoutes from './api/routes/captions';
import transcriptionRoutes from './api/routes/transcription';
import healthRoutes from './api/routes/health';

// Import middleware
import { errorHandler } from './api/middleware/errorHandler';
import { rateLimiter } from './api/middleware/rateLimiter';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      process.env.CORS_ORIGIN || 'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  })
);

// Logging
app.use(morgan('combined'));

// Compression
app.use(compression());

// Rate limiting - applied per route as needed
// app.use(rateLimiter); // Removed global rate limiting

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/captions', captionRoutes);
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/export', exportRoutes);

// Public exports hosting (optional)
import path from 'path';
import expressStatic from 'express';
app.use(
  '/api/export/exports',
  expressStatic.static(path.resolve(process.env.EXPORTS_DIR || 'data/exports'))
);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
