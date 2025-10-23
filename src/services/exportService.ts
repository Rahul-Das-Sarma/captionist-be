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
      await this.burnInCaptions(jobId, inputPath, outputPath, options);

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
    jobId: string,
    inputPath: string,
    outputPath: string,
    options: BurnInOptions
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const job = this.jobs.get(jobId);

      // Create FFmpeg command
      let command = ffmpeg(inputPath);

      // Use robust drawtext approach with limited captions for stability
      let srtPath: string | null = null;
      if (options.captions.length > 0) {
        // First, get video duration to filter captions properly
        let videoDuration: number;
        try {
          videoDuration = await this.getVideoDuration(inputPath);
          console.log(`Video duration: ${videoDuration} seconds`);
        } catch (error) {
          console.warn(
            'Could not detect video duration, using fallback duration of 30 seconds:',
            error
          );
          videoDuration = 30; // Fallback to 30 seconds
        }

        // Filter captions to only include those within video duration
        const validCaptions = options.captions.filter(
          caption =>
            caption.startTime < videoDuration &&
            caption.endTime <= videoDuration
        );

        console.log(
          `Found ${validCaptions.length} captions within video duration out of ${options.captions.length} total`
        );

        // Log first few captions for debugging
        console.log('First 5 captions timing:');
        options.captions.slice(0, 5).forEach((caption, index) => {
          console.log(
            `Caption ${index + 1}: ${caption.startTime}s - ${caption.endTime}s: "${caption.text}"`
          );
        });

        // Log valid captions
        console.log('Valid captions timing:');
        validCaptions.slice(0, 5).forEach((caption, index) => {
          console.log(
            `Valid ${index + 1}: ${caption.startTime}s - ${caption.endTime}s: "${caption.text}"`
          );
        });

        // Process all captions within video duration (no limit)
        const limitedCaptions = validCaptions;
        console.log(
          `Processing ${limitedCaptions.length} captions out of ${validCaptions.length} valid captions`
        );

        // Additional debugging to understand filtering
        console.log(`Total original captions: ${options.captions.length}`);
        console.log(`Video duration: ${videoDuration} seconds`);
        console.log(`Valid captions after filtering: ${validCaptions.length}`);
        console.log(
          `Limited captions for processing: ${limitedCaptions.length}`
        );

        if (limitedCaptions.length === 0) {
          console.log(
            'No captions found within video duration, copying video without captions'
          );
          command = command.outputOptions(['-c:v', 'copy']);
        } else {
          const filters = this.buildComplexFilter(
            limitedCaptions,
            options.style
          );

          if (filters.length > 0) {
            command = command.videoFilters(filters);
            console.log(`Using ${filters.length} drawtext filters`);

            // Use hardware-accelerated encoding with conservative settings
            command = command.outputOptions([
              '-c:v',
              'h264_nvenc', // Use NVIDIA hardware acceleration
              '-preset',
              'fast', // Use fast preset for better performance
              '-crf',
              '23', // Use constant rate factor for quality/speed balance
              '-threads',
              '6', // Increased thread count for all captions
              '-max_muxing_queue_size',
              '2048', // Increased buffer size for all captions
              '-bufsize',
              '4M', // Increased buffer size for all captions
              '-maxrate',
              '5M', // Increased bitrate for all captions
              '-g',
              '30', // Set GOP size for better compression
              '-sc_threshold',
              '0', // Disable scene change detection for better performance
              '-tune',
              'fastdecode', // Optimize for fast decoding
              '-profile:v',
              'high', // Use high profile for better compression
              '-level',
              '4.1', // Set H.264 level for compatibility
              '-movflags',
              '+faststart', // Optimize for streaming
              '-avoid_negative_ts',
              'make_zero', // Handle timestamp issues
              '-fflags',
              '+genpts', // Generate presentation timestamps
            ]);
          } else {
            console.log(
              'No valid captions found, copying video without captions'
            );
            command = command.outputOptions(['-c:v', 'copy']);
          }
        }
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
          console.log('Processing captions with robust drawtext approach');
          console.log('Input path:', inputPath);
          console.log('Output path:', outputPath);
          console.log(
            `System memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`
          );
          console.log(
            `CPU usage: ${process.cpuUsage().user / 1000000}ms user, ${process.cpuUsage().system / 1000000}ms system`
          );
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
          console.log(
            `Final memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
          );

          // Cleanup temporary SRT file
          try {
            if (srtPath && fs.existsSync(srtPath)) {
              fs.unlinkSync(srtPath);
              console.log('Cleaned up temporary SRT file');
            }
          } catch (cleanupError) {
            console.warn('Could not cleanup temporary SRT file:', cleanupError);
          }

          if (job) job.progress = 95;
          resolve();
        })
        .on('error', err => {
          console.error('FFmpeg error:', err);
          console.error('Processing captions with robust drawtext approach');
          console.error(
            'Number of captions processed:',
            options.captions.length
          );
          reject(new Error(`Video processing failed: ${err.message}`));
        })
        .run();
    });
  }

  public buildComplexFilter(
    captions: CaptionSegment[],
    style: CaptionStyle
  ): string[] {
    if (captions.length === 0) return [];

    // Validate captions
    const validCaptions = captions.filter(
      caption =>
        caption.text &&
        caption.text.trim().length > 0 &&
        caption.startTime >= 0 &&
        caption.endTime > caption.startTime
    );

    if (validCaptions.length === 0) return [];

    // Sort captions by start time to ensure proper ordering
    const sortedCaptions = [...validCaptions].sort(
      (a, b) => a.startTime - b.startTime
    );

    // Create multiple simple drawtext filters (limited to prevent overload)
    return this.createMultipleSimpleFilters(sortedCaptions, style);
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

  private async createSRTFile(
    captions: CaptionSegment[],
    style: CaptionStyle
  ): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Create temporary SRT file with memory management
    const tempDir = os.tmpdir();
    const srtPath = path.join(tempDir, `captions_${Date.now()}.srt`);

    console.log(`Creating SRT file for ${captions.length} captions...`);
    console.log(
      `Available memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`
    );

    // Process captions in chunks to manage memory
    const chunkSize = 100; // Process 100 captions at a time
    let srtContent = '';

    for (let i = 0; i < captions.length; i += chunkSize) {
      const chunk = captions.slice(i, i + chunkSize);

      chunk.forEach((caption, chunkIndex) => {
        const globalIndex = i + chunkIndex;
        const startTime = this.formatSRTTime(caption.startTime);
        const endTime = this.formatSRTTime(caption.endTime);
        const text = caption.text.replace(/\n/g, ' '); // Replace newlines with spaces

        srtContent += `${globalIndex + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${text}\n\n`;
      });

      // Log progress for large caption sets
      if (captions.length > 50) {
        console.log(
          `Processed ${Math.min(i + chunkSize, captions.length)}/${captions.length} captions`
        );
      }
    }

    // Write file with error handling
    try {
      fs.writeFileSync(srtPath, srtContent, 'utf8');
      console.log(
        `Created SRT file with ${captions.length} captions: ${srtPath}`
      );
      console.log(
        `File size: ${Math.round(fs.statSync(srtPath).size / 1024)}KB`
      );
    } catch (error) {
      console.error('Error writing SRT file:', error);
      throw error;
    }

    return srtPath;
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  private createSubtitleFilter(srtPath: string, style: CaptionStyle): string {
    let filter = `subtitles=${srtPath}`;

    // Add basic styling
    if (style.typography.fontSize) {
      filter += `:fontsize=${style.typography.fontSize}`;
    }

    if (style.typography.fontColor) {
      filter += `:fontcolor=${this.normalizeColor(style.typography.fontColor)}`;
    }

    if (style.background.enabled) {
      filter += `:force_style='FontSize=${style.typography.fontSize},PrimaryColour=${this.normalizeColor(style.typography.fontColor)}'`;
    }

    return filter;
  }

  private async getVideoDuration(inputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.error('Error getting video duration:', err);
          reject(err);
          return;
        }

        const duration = metadata.format.duration;
        if (duration === undefined) {
          console.error('Could not determine video duration');
          reject(new Error('Could not determine video duration'));
          return;
        }
        console.log(`Video duration detected: ${duration} seconds`);
        resolve(duration);
      });
    });
  }

  private normalizeColor(color: string): string {
    if (!color) return 'white';

    // Handle common color formats
    if (color.startsWith('#')) {
      // Convert hex to FFmpeg format
      const hex = color.replace('#', '');
      return `0x${hex}`;
    }

    if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
      // Convert RGB/RGBA to hex
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

  private createMultipleSimpleFilters(
    captions: CaptionSegment[],
    style: CaptionStyle
  ): string[] {
    // Process all captions with hardware acceleration
    const limitedCaptions = captions; // No limit - process all captions
    const filters: string[] = [];

    console.log(
      `Processing all ${limitedCaptions.length} captions with hardware acceleration`
    );

    limitedCaptions.forEach(caption => {
      const text = this.escapeText(caption.text);
      let filter = `drawtext=text='${text}'`;

      // Basic styling only
      filter += `:fontsize=${style.typography.fontSize}`;
      filter += `:fontcolor=${this.normalizeColor(style.typography.fontColor)}`;
      filter += `:x=(w-text_w)/2:y=h-text_h-20`;

      // Time-based visibility
      filter += `:enable='between(t,${caption.startTime},${caption.endTime})'`;

      // Simple background
      if (style.background.enabled) {
        filter += `:box=1:boxcolor=${this.normalizeColor(style.background.color)}@${style.background.opacity}`;
      }

      filters.push(filter);
    });

    return filters;
  }

  private createSimpleDrawTextFilter(
    caption: CaptionSegment,
    style: CaptionStyle
  ): string {
    // Create a very simple drawtext filter
    const text = this.escapeText(caption.text);
    let filter = `drawtext=text='${text}'`;

    // Basic styling only
    filter += `:fontsize=${style.typography.fontSize}`;
    filter += `:fontcolor=${this.normalizeColor(style.typography.fontColor)}`;
    filter += `:x=(w-text_w)/2:y=h-text_h-20`;

    // Time-based visibility
    filter += `:enable='between(t,${caption.startTime},${caption.endTime})'`;

    // Simple background
    if (style.background.enabled) {
      filter += `:box=1:boxcolor=${this.normalizeColor(style.background.color)}@${style.background.opacity}`;
    }

    return filter;
  }

  private createBasicDrawTextFilter(
    caption: CaptionSegment,
    style: CaptionStyle
  ): string {
    // Create a very basic drawtext filter
    const text = this.escapeText(caption.text);
    let filter = `drawtext=text='${text}'`;

    // Basic styling
    filter += `:fontsize=${style.typography.fontSize}`;
    filter += `:fontcolor=${this.normalizeColor(style.typography.fontColor)}`;
    filter += `:x=(w-text_w)/2:y=h-text_h-20`;

    // Time-based visibility
    filter += `:enable='between(t,${caption.startTime},${caption.endTime})'`;

    // Simple background
    if (style.background.enabled) {
      filter += `:box=1:boxcolor=${this.normalizeColor(style.background.color)}@${style.background.opacity}`;
    }

    return filter;
  }

  private createAdvancedDrawTextFilter(
    text: string,
    style: CaptionStyle,
    startTime: number,
    endTime: number
  ): string {
    const filters: string[] = [];

    // Base drawtext filter with enhanced styling
    let filter = `drawtext=text='${text}'`;

    // Typography settings
    filter += `:fontsize=${style.typography.fontSize}`;
    filter += `:fontcolor=${this.normalizeColor(style.typography.fontColor)}`;
    filter += `:fontfile=${this.getFontPath(style.typography.fontFamily)}`;

    // Position calculation
    const position = this.calculatePosition(style.position);

    // Text alignment - only set x if not already set by position calculation
    if (style.typography.textAlign === 'center') {
      filter += `:x=(w-text_w)/2`;
    } else if (style.typography.textAlign === 'right') {
      filter += `:x=w-text_w-${style.position.margin}`;
    } else {
      filter += `:x=${position.x}`;
    }

    filter += `:y=${position.y}`;

    // Background styling
    if (style.background.enabled) {
      filter += `:box=1`;
      filter += `:boxcolor=${this.normalizeColor(style.background.color)}@${style.background.opacity}`;
      filter += `:boxborderw=${style.background.padding.top + style.background.padding.bottom}`;
    }

    // Border styling
    if (style.border.enabled) {
      filter += `:bordercolor=${this.normalizeColor(style.border.color)}`;
      filter += `:borderw=${style.border.width}`;
    }

    // Shadow effects
    if (style.shadow.enabled) {
      filter += `:shadowcolor=${this.normalizeColor(style.shadow.color)}`;
      filter += `:shadowx=${style.shadow.offsetX}`;
      filter += `:shadowy=${style.shadow.offsetY}`;
    }

    // Time-based visibility
    if (startTime > 0 || endTime < 999999) {
      filter += `:enable='between(t,${startTime},${endTime})'`;
    }

    // Animation effects
    if (style.animation.type !== 'none') {
      filter += this.addAnimationEffects(style.animation);
    }

    // Advanced effects
    if (style.effects.opacity < 1) {
      filter += `:alpha=${style.effects.opacity}`;
    }

    return filter;
  }

  private createMultipleCaptionFilter(
    captions: CaptionSegment[],
    style: CaptionStyle
  ): string {
    const filters: string[] = [];

    captions.forEach((caption, index) => {
      const text = this.escapeText(caption.text);
      const drawTextFilter = this.createAdvancedDrawTextFilter(
        text,
        style,
        caption.startTime,
        caption.endTime
      );

      if (index === 0) {
        filters.push(`[0:v]${drawTextFilter}[v${index}]`);
      } else {
        filters.push(`[v${index - 1}]${drawTextFilter}[v${index}]`);
      }
    });

    // Final output mapping - remove the format filter as it might cause issues
    const lastIndex = captions.length - 1;
    filters.push(`[v${lastIndex}]null[vout]`);

    return filters.join(';');
  }

  private calculatePosition(position: CaptionStyle['position']): {
    x: string;
    y: string;
  } {
    const margin = position.margin;

    switch (position.type) {
      case 'top':
        return { x: '(w-text_w)/2', y: `${margin}` };
      case 'center':
        return { x: '(w-text_w)/2', y: '(h-text_h)/2' };
      case 'bottom':
        return { x: '(w-text_w)/2', y: `h-text_h-${margin}` };
      case 'custom':
        return {
          x: position.x !== undefined ? `w*${position.x}` : '(w-text_w)/2',
          y:
            position.y !== undefined ? `h*${position.y}` : `h-text_h-${margin}`,
        };
      default:
        return { x: '(w-text_w)/2', y: `h-text_h-${margin}` };
    }
  }

  private getFontPath(fontFamily: string): string {
    // Map common font families to system font paths
    const fontMap: { [key: string]: string } = {
      Arial:
        process.platform === 'win32'
          ? 'C:\\Windows\\Fonts\\arial.ttf'
          : '/System/Library/Fonts/Arial.ttf',
      Helvetica:
        process.platform === 'win32'
          ? 'C:\\Windows\\Fonts\\helvetica.ttf'
          : '/System/Library/Fonts/Helvetica.ttc',
      'Times New Roman':
        process.platform === 'win32'
          ? 'C:\\Windows\\Fonts\\times.ttf'
          : '/System/Library/Fonts/Times New Roman.ttf',
      Courier:
        process.platform === 'win32'
          ? 'C:\\Windows\\Fonts\\cour.ttf'
          : '/System/Library/Fonts/Courier.ttf',
      Verdana:
        process.platform === 'win32'
          ? 'C:\\Windows\\Fonts\\verdana.ttf'
          : '/System/Library/Fonts/Verdana.ttf',
    };

    return fontMap[fontFamily] || fontMap['Arial'];
  }

  private addAnimationEffects(animation: CaptionStyle['animation']): string {
    if (animation.type === 'none') return '';

    let effects = '';

    switch (animation.type) {
      case 'fade':
        effects += `:alpha='if(between(t,${animation.delay},${animation.delay + animation.duration}),1,0)'`;
        break;
      case 'slide':
        effects += `:x='if(between(t,${animation.delay},${animation.delay + animation.duration}),(w-text_w)/2,w)'`;
        break;
      case 'bounce':
        effects += `:y='if(between(t,${animation.delay},${animation.delay + animation.duration}),h-text_h-20,h)'`;
        break;
      case 'typewriter':
        // This would require more complex logic for character-by-character reveal
        effects += `:enable='between(t,${animation.delay},${animation.delay + animation.duration})'`;
        break;
    }

    return effects;
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

    // Clean up old subtitle files
    this.cleanupSubtitleFiles();
  }

  private cleanupSubtitleFiles(): void {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) return;

    try {
      const files = fs.readdirSync(tempDir);
      const subtitleFiles = files.filter(file => file.endsWith('.srt'));

      subtitleFiles.forEach(file => {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        const ageHours =
          (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

        if (ageHours > 24) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.error('Failed to cleanup subtitle files:', error);
    }
  }
}
