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

    const align =
      style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;
    const primary = this.hexToAssColor(style.color || '#ffffff');
    // Semi-transparent background for a pill-like box; 0x40 ≈ 25% transparent
    const back = this.hexToAssColor(style.backgroundColor || '#000000').replace(
      /^&H00/,
      '&H40'
    );
    const marginH = Math.max(20, Math.round(playResX * 0.05));
    const marginV = Math.max(40, Math.round(playResY * 0.06));

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
      `Style: Default,${style.fontFamily || 'Arial'},${style.fontSize || 36},${primary},&H000000FF,&H00000000,${back},0,0,0,0,100,100,0,0,3,0,0,${align},${marginH},${marginH},${marginV},0`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ].join('\n');

    const events = captions
      .map(c => {
        const start = this.secondsToAssTime(c.startTime);
        const end = this.secondsToAssTime(c.endTime);
        const text = this.escapeAssText(c.text);
        // \q2 = smart wrapping; disable outline/shadow at line level for cleaner box
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\q2} ${text}`;
      })
      .join('\n');

    const content = `${header}\n${events}\n`;
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
    const m =
      /^#?([a-fA-F0-9]{6})$/.exec(hex) || /^#?([a-fA-F0-9]{3})$/.exec(hex);
    let r = 255,
      g = 255,
      b = 255;
    if (m) {
      let h = m[1];
      if (h.length === 3)
        h = h
          .split('')
          .map(c => c + c)
          .join('');
      r = parseInt(h.substring(0, 2), 16);
      g = parseInt(h.substring(2, 4), 16);
      b = parseInt(h.substring(4, 6), 16);
    }
    const toHex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
    // ASS is &HBBGGRR&
    return `&H00${toHex(b)}${toHex(g)}${toHex(r)}&`;
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
