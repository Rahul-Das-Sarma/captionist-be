import {
  CaptionSegment,
  CaptionStyle,
  CaptionGenerationRequest,
} from '../types/captions';
import { VideoProcessor } from './videoProcessor';
import { FileStorage } from './fileStorage';

export class CaptionGenerator {
  private videoProcessor: VideoProcessor;
  private fileStorage: FileStorage;
  private jobs: Map<string, any> = new Map();

  constructor() {
    this.videoProcessor = new VideoProcessor();
    this.fileStorage = new FileStorage();
  }

  async startGeneration(request: CaptionGenerationRequest): Promise<string> {
    const jobId = `caption_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Store job info
    this.jobs.set(jobId, {
      status: 'pending',
      progress: 0,
      request,
      captions: null,
      error: null,
    });

    // Start processing asynchronously
    this.processCaptions(jobId, request);

    return jobId;
  }

  private async processCaptions(
    jobId: string,
    request: CaptionGenerationRequest
  ): Promise<void> {
    try {
      const job = this.jobs.get(jobId);
      if (!job) return;

      job.status = 'processing';
      job.progress = 10;

      // Generate captions from transcript
      const captions = this.generateCaptionsFromTranscript(
        request.transcript,
        60, // Default duration - should be calculated from video
        request.options
      );

      job.progress = 80;
      job.captions = captions;
      job.progress = 100;
      job.status = 'completed';
    } catch (error: any) {
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
      }
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    return {
      jobId,
      status: job.status,
      progress: job.progress,
      captions: job.captions,
      error: job.error,
    };
  }

  async getCaptions(jobId: string): Promise<CaptionSegment[]> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'completed' || !job.captions) {
      throw new Error('Captions not ready');
    }

    return job.captions;
  }

  async exportToSRT(jobId: string): Promise<string> {
    const captions = await this.getCaptions(jobId);

    let srtContent = '';
    captions.forEach((caption, index) => {
      const startTime = this.formatSRTTime(caption.startTime);
      const endTime = this.formatSRTTime(caption.endTime);

      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${caption.text}\n\n`;
    });

    return srtContent;
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds
      .toString()
      .padStart(3, '0')}`;
  }

  generateCaptionsFromTranscript(
    transcript: string,
    duration: number,
    options: any
  ): CaptionSegment[] {
    const {
      maxSegmentDuration = 5,
      minSegmentDuration = 1,
      wordPerMinute = 150,
    } = options;

    // Split transcript into segments
    const segments = this.splitTextIntoSegments(
      transcript,
      duration,
      maxSegmentDuration
    );

    const captions: CaptionSegment[] = [];
    let currentTime = 0;

    segments.forEach((segment, index) => {
      const segmentDuration = Math.min(
        this.calculateReadingTime(segment, wordPerMinute),
        maxSegmentDuration
      );

      const endTime = Math.min(currentTime + segmentDuration, duration);

      if (endTime > currentTime) {
        captions.push({
          id: `caption-${Date.now()}-${index}`,
          text: segment,
          startTime: currentTime,
          endTime: endTime,
          confidence: 0.9,
        });
      }

      currentTime = endTime;
    });

    return captions;
  }

  private splitTextIntoSegments(
    text: string,
    totalDuration: number,
    maxSegmentDuration: number
  ): string[] {
    const words = text.trim().split(/\s+/);
    const totalWords = words.length;
    const targetSegments = Math.ceil(totalDuration / maxSegmentDuration);
    const wordsPerSegment = Math.ceil(totalWords / targetSegments);

    const segments: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerSegment) {
      const segment = words.slice(i, i + wordsPerSegment).join(' ');
      if (segment.trim()) {
        segments.push(segment.trim());
      }
    }

    return segments;
  }

  private calculateReadingTime(text: string, wordPerMinute: number): number {
    const wordCount = text.trim().split(/\s+/).length;
    const minutes = wordCount / wordPerMinute;
    return Math.max(minutes * 60, 1);
  }
}
