import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
// @ts-ignore
import ffprobe from 'ffprobe-static';
import { FileStorage } from './fileStorage';
import { CaptionSegment, CaptionStyle } from '../types/captions';

type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ExportOutputOpts {
  format: 'mp4' | 'mov' | 'webm';
  codec: 'h264' | 'h265' | 'vp9' | 'av1';
  quality: 'low' | 'medium' | 'high';
  resolution?: string; // e.g. 1080x1920
  fps?: number;
}

export interface BurnInRequest {
  videoId: string;
  captions: CaptionSegment[];
  style: CaptionStyle;
  output?: Partial<ExportOutputOpts>;
}

export interface ExportJob {
  jobId: string;
  status: ExportStatus;
  progress: number;
  outputPath?: string;
  publicUrl?: string;
  error?: string;
}

const DEFAULT_OUTPUT: ExportOutputOpts = {
  format: 'mp4',
  codec: 'h264',
  quality: 'medium',
};

export class ExportService {
  private jobs: Map<string, ExportJob> = new Map();
  private fileStorage: FileStorage;
  private exportsDir: string;

  constructor() {
    this.fileStorage = new FileStorage();
    this.exportsDir = path.resolve(process.env.EXPORTS_DIR || 'data/exports');
    if (!fs.existsSync(this.exportsDir))
      fs.mkdirSync(this.exportsDir, { recursive: true });

    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffprobePath = ffprobe.path;
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
  }

  getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  startBurnIn(req: BurnInRequest): string {
    const jobId = `job_${uuidv4()}`;
    this.jobs.set(jobId, { jobId, status: 'pending', progress: 0 });
    this.process(jobId, req).catch(err => {
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err instanceof Error ? err.message : String(err);
        this.jobs.set(jobId, job);
      }
    });
    return jobId;
  }

  private async process(jobId: string, req: BurnInRequest): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'processing';
    job.progress = 1;
    this.jobs.set(jobId, job);

    const inputPath = this.fileStorage.getVideoPath(req.videoId);
    const assPath = path.join(this.exportsDir, `${jobId}.ass`);
    const output = {
      ...DEFAULT_OUTPUT,
      ...(req.output || {}),
    } as ExportOutputOpts;

    const { width, height, duration } = await this.probe(inputPath);
    await this.writeAssFile(
      assPath,
      req.captions,
      req.style,
      output.resolution || `${width}x${height}`
    );

    const outputPath = path.join(this.exportsDir, `${jobId}.${output.format}`);

    await this.runFfmpeg(
      jobId,
      inputPath,
      assPath,
      outputPath,
      output,
      duration
    );

    const final = this.jobs.get(jobId);
    if (final) {
      final.status = 'completed';
      final.progress = 100;
      final.outputPath = outputPath;
      final.publicUrl = `/export/exports/${path.basename(outputPath)}`;
      this.jobs.set(jobId, final);
    }
  }

  private async probe(
    inputPath: string
  ): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) return reject(err);
        const video = data.streams.find(
          s => (s as any).codec_type === 'video'
        ) as any;
        const width = video?.width || 1080;
        const height = video?.height || 1920;
        const duration = Number(video?.duration || data.format.duration || 0);
        resolve({ width, height, duration });
      });
    });
  }

  private async writeAssFile(
    assPath: string,
    captions: CaptionSegment[],
    style: CaptionStyle,
    resolution: string
  ): Promise<void> {
    const [wStr, hStr] = resolution.split('x');
    const playResX = Number(wStr) || 1080;
    const playResY = Number(hStr) || 1920;

    // Calculate dynamic font size based on video resolution
    const baseFontSize = style.fontSize || 36;
    const scaleFactor = Math.max(1, Math.min(playResX / 1080, playResY / 1920));
    const scaledFontSize = Math.max(48, Math.round(baseFontSize * scaleFactor));

    // Position alignment
    const align =
      style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;

    // Color conversions - force high contrast for visibility
    const primary = this.hexToAssColor(style.color || '#ffffff');
    const backgroundColor = this.hexToAssColor(
      style.backgroundColor || '#000000'
    );

    // Force high contrast colors for better visibility - always use pure white text and solid black background
    const forcedPrimary = '&H00FFFFFF&'; // Always pure white text
    const forcedBackground = '&HFF000000&'; // Always solid black background

    // Debug the actual colors being used
    console.log('Using forced colors:', {
      text: forcedPrimary,
      background: forcedBackground,
    });

    // Create solid background for better visibility - ALWAYS use forced colors
    const backColor = forcedBackground; // Use forced high contrast background
    const textColor = forcedPrimary; // Use forced high contrast text

    // Calculate margins based on padding and resolution
    const marginH = Math.max(style.padding || 20, Math.round(playResX * 0.05));
    const marginV = Math.max(style.padding || 40, Math.round(playResY * 0.06));

    // Calculate outline and shadow based on font size - make them stronger for better visibility
    const outline = Math.max(4, Math.round(scaledFontSize * 0.12)); // Stronger outline
    const shadow = Math.max(3, Math.round(scaledFontSize * 0.08)); // Stronger shadow

    const header = [
      '[Script Info]',
      'ScriptType: v4.00+',
      'Collisions: Normal',
      'WrapStyle: 2',
      `PlayResX: ${playResX}`,
      `PlayResY: ${playResY}`,
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      `Style: Default,${style.fontFamily || 'Arial'},${scaledFontSize},${textColor},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,3,${outline},${shadow},${align},${marginH},${marginH},${marginV},0`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ].join('\n');

    const events = captions
      .map(c => {
        const start = this.secondsToAssTime(c.startTime);
        const end = this.secondsToAssTime(c.endTime);
        const text = this.escapeAssText(c.text);

        // Calculate positioning
        const centerX = playResX / 2;
        const centerY = playResY / 2;

        // Calculate Y position based on style.position
        let yPosition;
        switch (style.position) {
          case 'top':
            yPosition = marginV + scaledFontSize + 20;
            break;
          case 'center':
            yPosition = centerY;
            break;
          case 'bottom':
          default:
            yPosition = playResY - marginV - scaledFontSize - 20;
            break;
        }

        // Generate style-specific effects and animations
        const effect = this.generateAssEffect(
          style,
          centerX,
          yPosition,
          c,
          scaledFontSize,
          outline,
          shadow
        );

        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${effect}${text}`;
      })
      .join('\n');

    const content = `${header}\n${events}\n`;

    // Debug the ASS file content
    console.log('ASS File generated with', events.split('\n').length, 'events');
    console.log(
      'ASS Style:',
      `Style: Default,${style.fontFamily || 'Arial'},${scaledFontSize},${textColor},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,3,${outline},${shadow},${align},${marginH},${marginH},${marginV},0`
    );
    console.log('First event:', events.split('\n')[0]);

    await fs.promises.writeFile(assPath, content, 'utf8');
  }

  private runFfmpeg(
    jobId: string,
    inputPath: string,
    assPath: string,
    outputPath: string,
    out: ExportOutputOpts,
    duration: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const assFilterPath = this.escapeFilterPath(path.resolve(assPath));
      const command = ffmpeg(inputPath)
        .outputOptions(['-y', '-pix_fmt yuv420p'])
        .videoFilters(`ass=${assFilterPath}`)
        .output(outputPath)
        .on('start', () => this.update(jobId, { progress: 2 }))
        .on('stderr', line => {
          const match = /time=(\d+):(\d+):(\d+\.\d+)/.exec(line);
          if (match && duration > 0) {
            const h = Number(match[1]);
            const m = Number(match[2]);
            const s = Number(match[3]);
            const current = h * 3600 + m * 60 + s;
            const pct = Math.min(99, Math.floor((current / duration) * 100));
            this.update(jobId, { progress: pct });
          }
        })
        .on('end', () => resolve())
        .on('error', err => reject(err));

      // codec
      if (out.codec === 'h264') command.videoCodec('libx264');
      else if (out.codec === 'h265') command.videoCodec('libx265');
      else if (out.codec === 'vp9') command.videoCodec('libvpx-vp9');
      else if (out.codec === 'av1') command.videoCodec('libaom-av1');

      // quality to CRF
      const crf = out.quality === 'high' ? 18 : out.quality === 'low' ? 28 : 23;
      command.outputOptions([`-crf ${crf}`, '-preset veryfast']);

      if (out.resolution) command.size(out.resolution);
      if (out.fps) command.fps(out.fps);
      command.audioCodec('copy');

      command.run();
    });
  }

  private update(jobId: string, patch: Partial<ExportJob>) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const next = { ...job, ...patch } as ExportJob;
    this.jobs.set(jobId, next);
  }

  private secondsToAssTime(sec: number): string {
    const s = Math.max(0, sec);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = (s % 60).toFixed(2).padStart(5, '0');
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
  }

  private hexToAssColor(hex: string): string {
    // Handle various hex formats including rgba
    let cleanHex = hex.replace('#', '');

    // Handle rgba format like "rgba(0, 0, 0, 0.8)"
    if (hex.startsWith('rgba')) {
      const rgbaMatch = hex.match(
        /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/
      );
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        const alpha = parseFloat(rgbaMatch[4]);
        const toHex = (n: number) =>
          n.toString(16).toUpperCase().padStart(2, '0');
        const alphaHex = Math.round(alpha * 255)
          .toString(16)
          .toUpperCase()
          .padStart(2, '0');
        return `&H${alphaHex}${toHex(b)}${toHex(g)}${toHex(r)}&`;
      }
    }

    // Handle 3-digit hex (e.g., #fff -> #ffffff)
    if (cleanHex.length === 3) {
      cleanHex = cleanHex
        .split('')
        .map(c => c + c)
        .join('');
    }

    // Ensure we have a valid 6-digit hex
    if (cleanHex.length !== 6) {
      cleanHex = 'FFFFFF'; // Default to white
    }

    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    const toHex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
    // ASS format is &HBBGGRR& (Blue-Green-Red)
    return `&H00${toHex(b)}${toHex(g)}${toHex(r)}&`;
  }

  private generateAssEffect(
    style: CaptionStyle,
    centerX: number,
    yPosition: number,
    caption: CaptionSegment,
    scaledFontSize: number,
    outline: number,
    shadow: number
  ): string {
    const duration = (caption.endTime - caption.startTime) * 1000; // Convert to milliseconds
    const animationDuration = style.animationDuration || 300;
    const animationDelay = style.animationDelay || 0;

    // Build base effects with custom properties - force pure white text for maximum visibility
    const textColor = '&H00FFFFFF&'; // Always pure white text
    let baseEffect = `{\\1c${textColor}\\bord${outline}\\shad${shadow}\\q2\\pos(${centerX},${yPosition})`;

    // Debug the effect being generated (simplified)
    // console.log('ASS Effect:', baseEffect);

    // Don't add opacity - keep text fully opaque for maximum visibility
    // if (style.opacity !== undefined) {
    //   const alpha = Math.round(style.opacity * 255);
    //   baseEffect += `\\alpha&H${alpha.toString(16).padStart(2, '0')}&`;
    // }

    // Add rotation if specified
    if (style.rotation !== undefined) {
      baseEffect += `\\frz${style.rotation}`;
    }

    // Don't add conflicting shadow/border properties - keep it simple

    // Add style-specific effects and animations
    switch (style.type) {
      case 'reel':
        // Modern social media style with pill background and subtle animations
        const reelScale = 105;
        const reelDuration = Math.min(animationDuration, duration / 4);
        return `${baseEffect}\\t(${animationDelay},${animationDelay + reelDuration},\\fscx${reelScale}\\fscy${reelScale})\\t(${animationDelay + reelDuration},${duration - reelDuration},\\fscx100\\fscy100)\\t(${duration - reelDuration},${duration},\\fscx95\\fscy95)}`;

      case 'classic':
        // Traditional subtitle style - no animations
        return `${baseEffect}}`;

      case 'bounce':
        // Bounce animation effect with custom duration
        const bounceDuration = Math.min(animationDuration, duration / 4);
        const bounceScale = 110;
        const bounceDelay = animationDelay;
        return `${baseEffect}\\t(${bounceDelay},${bounceDelay + bounceDuration},\\fscx${bounceScale}\\fscy${bounceScale})\\t(${bounceDelay + bounceDuration},${bounceDelay + bounceDuration * 2},\\fscx100\\fscy100)\\t(${bounceDelay + bounceDuration * 2},${bounceDelay + bounceDuration * 3},\\fscx${bounceScale}\\fscy${bounceScale})\\t(${bounceDelay + bounceDuration * 3},${duration},\\fscx100\\fscy100)}`;

      case 'slide':
        // Slide in effect from the side with custom properties
        const slideDuration = Math.min(animationDuration, duration / 3);
        const slideDistance = Math.min(200, centerX * 0.3);
        const slideStartX =
          style.position === 'top'
            ? centerX - slideDistance
            : centerX + slideDistance;
        const slideDelay = animationDelay;
        return `${baseEffect}\\t(${slideDelay},${slideDelay + slideDuration},\\move(${slideStartX},${yPosition},${centerX},${yPosition}))}`;

      default:
        return `${baseEffect}}`;
    }
  }

  private escapeAssText(text: string): string {
    return text.replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, '\\N');
  }

  // Windows-safe escaping for FFmpeg filter paths (ass/subtitles)
  private escapeFilterPath(p: string): string {
    // Convert backslashes, escape colon, wrap in single quotes
    // Example: C:\foo bar\subs.ass -> 'C\:\\foo bar\\subs.ass'
    const withEscapedBackslashes = p.replace(/\\/g, '\\\\');
    const withEscapedColon = withEscapedBackslashes.replace(/:/g, '\\:');
    return `'${withEscapedColon}'`;
  }
}
