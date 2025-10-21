import ffmpeg from 'fluent-ffmpeg';
// @ts-ignore
import ffprobe from 'ffprobe-static';
import { VideoMetadata, VideoUpload } from '../types/video';
import { FileStorage } from './fileStorage';

export class VideoProcessor {
  private fileStorage: FileStorage;

  constructor() {
    this.fileStorage = new FileStorage();

    // Set FFmpeg paths - use ffprobe-static for cross-platform support
    // Force Windows paths, ignore environment variables
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffprobePath = ffprobe.path;

    console.log('Setting FFmpeg paths:', { ffmpegPath, ffprobePath });
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
  }

  async getVideoMetadata(file: Express.Multer.File): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      // Create a temporary file for ffprobe
      const tempPath = `./temp/${Date.now()}_${file.originalname}`;
      console.log('Creating temp file:', tempPath);
      require('fs').writeFileSync(tempPath, file.buffer);

      console.log('Running ffprobe on:', tempPath);

      // Force Windows ffprobe path, ignore environment variables
      const ffprobePath = ffprobe.path;
      console.log('Using ffprobe path:', ffprobePath);

      // Set the ffprobe path for this specific call
      ffmpeg.setFfprobePath(ffprobePath);

      ffmpeg.ffprobe(tempPath, (err, metadata) => {
        if (err) {
          console.error('FFprobe error:', err);
          // Clean up temp file on error
          try {
            require('fs').unlinkSync(tempPath);
          } catch (cleanupErr) {
            console.warn('Failed to clean up temp file on error:', cleanupErr);
          }
          reject(new Error(`Failed to analyze video: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(
          stream => stream.codec_type === 'video'
        );
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const metadataResult: VideoMetadata = {
          id: '', // Will be set by caller
          filename: file.originalname,
          originalName: file.originalname,
          size: file.size,
          duration: parseFloat(videoStream.duration || '0'),
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps: this.calculateFPS(videoStream),
          bitrate: parseInt(videoStream.bit_rate || '0'),
          format: videoStream.codec_name || 'unknown',
          uploadedAt: new Date(),
        };

        resolve(metadataResult);

        // Clean up temporary file
        require('fs').unlinkSync(tempPath);
      });
    });
  }

  async getVideoMetadataById(videoId: string): Promise<VideoMetadata> {
    // Implementation to get metadata from database
    // This would typically query your database
    throw new Error('Not implemented - requires database integration');
  }

  async saveVideoMetadata(
    videoId: string,
    filename: string,
    metadata: VideoMetadata
  ): Promise<void> {
    // Implementation to save metadata to database
    // This would typically save to MongoDB or your chosen database
    console.log('Saving video metadata:', { videoId, filename, metadata });
  }

  private calculateFPS(videoStream: any): number {
    const frameRate = videoStream.r_frame_rate;
    if (frameRate) {
      const [numerator, denominator] = frameRate.split('/').map(Number);
      return denominator ? numerator / denominator : 0;
    }
    return 0;
  }

  async processVideoWithCaptions(
    videoId: string,
    captions: any[],
    style: any
  ): Promise<string> {
    // Implementation to overlay captions on video using FFmpeg
    return new Promise((resolve, reject) => {
      const inputPath = this.fileStorage.getVideoPath(videoId);
      const outputPath = `./temp/${videoId}_captioned.mp4`;

      let command = ffmpeg(inputPath);

      // Add caption filters based on style
      captions.forEach((caption, index) => {
        const startTime = caption.startTime;
        const endTime = caption.endTime;
        const text = caption.text;

        // Create subtitle filter
        const subtitleFilter = this.createSubtitleFilter(
          text,
          style,
          startTime,
          endTime
        );
        command = command.complexFilter(subtitleFilter);
      });

      command
        .output(outputPath)
        .on('end', () => {
          console.log('Video processing completed');
          resolve(outputPath);
        })
        .on('error', err => {
          console.error('Video processing error:', err);
          reject(err);
        })
        .run();
    });
  }

  private createSubtitleFilter(
    text: string,
    style: any,
    startTime: number,
    endTime: number
  ): string {
    // Create FFmpeg subtitle filter based on style
    const escapedText = text.replace(/:/g, '\\:').replace(/'/g, "\\'");

    return `drawtext=text='${escapedText}':fontsize=${style.fontSize}:fontcolor=${style.color}:x=(w-text_w)/2:y=h-th-${style.padding}:enable='between(t,${startTime},${endTime})'`;
  }
}
