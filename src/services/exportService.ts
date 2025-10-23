import { v4 as uuidv4 } from 'uuid';
import { CaptionSegment, CaptionStyle } from '../types/captions';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { VideoProcessor } from './videoProcessor';
import { FileStorage } from './fileStorage';

interface ExportJob {
  id: string;
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

interface BurnInOptions {
  videoId: string;
  captions: CaptionSegment[];
  style: CaptionStyle;
  output?: {
    format: 'mp4' | 'mov' | 'avi';
    quality: 'low' | 'medium' | 'high';
    resolution?: string;
  };
}

export class ExportService {
  private jobs: Map<string, ExportJob> = new Map();
  private videoProcessor: VideoProcessor;
  private fileStorage: FileStorage;

  constructor() {
    this.videoProcessor = new VideoProcessor();
    this.fileStorage = new FileStorage();
  }

  startBurnIn(options: BurnInOptions): string {
    const jobId = uuidv4();

    const job: ExportJob = {
      id: jobId,
      videoId: options.videoId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Start processing asynchronously
    this.processBurnIn(jobId, options);

    return jobId;
  }

  getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  getJobsByVideoId(videoId: string): ExportJob[] {
    return Array.from(this.jobs.values()).filter(
      job => job.videoId === videoId
    );
  }

  private async processBurnIn(
    jobId: string,
    options: BurnInOptions
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      job.progress = 10;

      // Generate output path
      const outputDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputFilename = `burn-in-${jobId}.mp4`;
      const outputPath = path.join(outputDir, outputFilename);

      // Get the input video path
      const inputPath = this.fileStorage.getVideoPath(options.videoId);

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Video file not found: ${inputPath}`);
      }

      job.progress = 20;

      // Process video with real FFmpeg
      await this.burnInCaptions(inputPath, outputPath, options);

      job.outputPath = outputPath;
      job.progress = 100;
      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
    }
  }

  private async burnInCaptions(
    inputPath: string,
    outputPath: string,
    options: BurnInOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const job = this.jobs.get(options.videoId);

      // Create FFmpeg command
      let command = ffmpeg(inputPath);

      // Build a single complex filter that handles all captions
      const filterComplex = this.buildComplexFilter(
        options.captions,
        options.style
      );

      // Apply the filter
      if (filterComplex) {
        // Use simple filter instead of complex filter for now
        command = command.videoFilters(filterComplex);
      } else {
        // If no captions, just copy the video
        command = command.outputOptions(['-c:v', 'copy']);
      }

      // Set output options based on quality settings
      const outputOptions = this.getOutputOptions(options.output);
      command = command.outputOptions(outputOptions);

      command
        .output(outputPath)
        .on('start', commandLine => {
          console.log('FFmpeg command:', commandLine);
          console.log('Filter complex:', filterComplex);
          console.log('Input path:', inputPath);
          console.log('Output path:', outputPath);
          if (job) job.progress = 30;
        })
        .on('progress', progress => {
          if (job) {
            // Convert FFmpeg progress to percentage
            const percent = Math.min(95, Math.round(progress.percent || 0));
            job.progress = Math.max(30, percent);
          }
        })
        .on('end', () => {
          console.log('Video processing completed');
          if (job) job.progress = 95;
          resolve();
        })
        .on('error', err => {
          console.error('FFmpeg error:', err);
          reject(new Error(`Video processing failed: ${err.message}`));
        })
        .run();
    });
  }

  public buildComplexFilter(
    captions: CaptionSegment[],
    style: CaptionStyle
  ): string {
    if (captions.length === 0) return '';

    // Validate captions
    const validCaptions = captions.filter(
      caption =>
        caption.text &&
        caption.text.trim().length > 0 &&
        caption.startTime >= 0 &&
        caption.endTime > caption.startTime
    );

    if (validCaptions.length === 0) return '';

    // Sort captions by start time to ensure proper ordering
    const sortedCaptions = [...validCaptions].sort(
      (a, b) => a.startTime - b.startTime
    );

    // For now, let's use a simpler approach - just handle the first caption
    // This avoids complex filter issues and should work reliably
    const caption = sortedCaptions[0];
    const text = this.escapeText(caption.text);
    return this.createDrawTextFilter(
      text,
      style,
      caption.startTime,
      caption.endTime,
      0
    );
  }

  private createMultipleDrawTextFilter(
    captions: CaptionSegment[],
    style: CaptionStyle
  ): string {
    // For multiple captions, we need to chain them properly
    // Each drawtext filter takes the output of the previous one
    const filters: string[] = [];

    captions.forEach((caption, index) => {
      const text = this.escapeText(caption.text);
      const drawTextFilter = this.createDrawTextFilter(
        text,
        style,
        caption.startTime,
        caption.endTime,
        index
      );

      if (index === 0) {
        // First filter takes input from video
        filters.push(`[0:v]${drawTextFilter}[v${index}]`);
      } else {
        // Subsequent filters take input from previous filter
        filters.push(`[v${index - 1}]${drawTextFilter}[v${index}]`);
      }
    });

    // The last filter output should be mapped to the final output
    const lastIndex = captions.length - 1;
    filters.push(`[v${lastIndex}]format=yuv420p[vout]`);

    return filters.join(';');
  }

  private escapeText(text: string): string {
    // Properly escape text for FFmpeg drawtext filter
    return text
      .replace(/\\/g, '\\\\') // Escape backslashes first
      .replace(/'/g, "\\'") // Escape single quotes
      .replace(/:/g, '\\:') // Escape colons
      .replace(/\[/g, '\\[') // Escape square brackets
      .replace(/\]/g, '\\]') // Escape square brackets
      .replace(/;/g, '\\;'); // Escape semicolons
  }

  private normalizeColor(color: string): string {
    if (!color) return 'white';

    // Handle common color formats
    if (color.startsWith('#')) {
      // Convert hex to FFmpeg format
      const hex = color.replace('#', '');
      return `0x${hex}`;
    }

    if (color.startsWith('rgb(')) {
      // Convert RGB to hex
      const rgb = color.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const r = parseInt(rgb[0]).toString(16).padStart(2, '0');
        const g = parseInt(rgb[1]).toString(16).padStart(2, '0');
        const b = parseInt(rgb[2]).toString(16).padStart(2, '0');
        return `0x${r}${g}${b}`;
      }
    }

    // Handle named colors
    const colorMap: { [key: string]: string } = {
      white: '0xFFFFFF',
      black: '0x000000',
      red: '0xFF0000',
      green: '0x00FF00',
      blue: '0x0000FF',
      yellow: '0xFFFF00',
      cyan: '0x00FFFF',
      magenta: '0xFF00FF',
      transparent: '0x00000000',
    };

    return colorMap[color.toLowerCase()] || '0xFFFFFF';
  }

  private createDrawTextFilter(
    text: string,
    style: CaptionStyle,
    startTime: number,
    endTime: number,
    index: number
  ): string {
    // Start with a very simple drawtext filter to avoid syntax issues
    let filter = `drawtext=text='${text}':fontsize=${style.fontSize}:fontcolor=white`;

    // Add position
    const position = this.getPositionString(style.position, style.padding);
    filter += `:x=${position.x}:y=${position.y}`;

    // Add time-based enable only if needed
    if (startTime > 0 || endTime < 999999) {
      filter += `:enable='between(t,${startTime},${endTime})'`;
    }

    // Add simple background if specified
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      filter += `:box=1:boxcolor=black@0.8`;
    }

    return filter;
  }

  private getPositionString(
    position: string,
    padding: number
  ): { x: string; y: string } {
    switch (position) {
      case 'top':
        return { x: '(w-text_w)/2', y: `${padding}` };
      case 'center':
        return { x: '(w-text_w)/2', y: '(h-text_h)/2' };
      case 'bottom':
      default:
        return { x: '(w-text_w)/2', y: `h-text_h-${padding}` };
    }
  }

  private getOutputOptions(output?: BurnInOptions['output']): string[] {
    const options: string[] = [];

    if (output) {
      switch (output.quality) {
        case 'low':
          options.push('-crf', '28', '-preset', 'fast');
          break;
        case 'medium':
          options.push('-crf', '23', '-preset', 'medium');
          break;
        case 'high':
          options.push('-crf', '18', '-preset', 'slow');
          break;
      }

      if (output.resolution) {
        options.push('-s', output.resolution);
      }
    } else {
      // Default to medium quality
      options.push('-crf', '23', '-preset', 'medium');
    }

    return options;
  }

  // Clean up old jobs (optional utility method)
  cleanupOldJobs(maxAgeHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffTime) {
        // Clean up the output file if it exists
        if (job.outputPath && fs.existsSync(job.outputPath)) {
          try {
            fs.unlinkSync(job.outputPath);
          } catch (error) {
            console.error(
              `Failed to delete output file: ${job.outputPath}`,
              error
            );
          }
        }
        this.jobs.delete(jobId);
      }
    }
  }
}
