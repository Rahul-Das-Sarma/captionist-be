export interface VideoUpload {
  file: Express.Multer.File;
  metadata: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    bitrate: number;
  };
}

export interface VideoProcessingJob {
  id: string;
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface VideoMetadata {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  format: string;
  uploadedAt: Date;
  processedAt?: Date;
}
