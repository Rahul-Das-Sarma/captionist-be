import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class FileStorage {
  private uploadDir: string;
  private tempDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.tempDir = process.env.TEMP_DIR || './temp';

    // Ensure directories exist
    this.ensureDirectoryExists(this.uploadDir);
    this.ensureDirectoryExists(this.tempDir);
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async storeVideo(file: Express.Multer.File): Promise<string> {
    const fileId = uuidv4();
    const filename = `${fileId}.${this.getFileExtension(file.originalname)}`;
    const filePath = path.join(this.uploadDir, filename);

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, file.buffer, err => {
        if (err) {
          reject(new Error(`Failed to store file: ${err.message}`));
        } else {
          resolve(fileId);
        }
      });
    });
  }

  async getVideoStream(videoId: string): Promise<fs.ReadStream> {
    const filePath = this.getVideoPath(videoId);

    if (!fs.existsSync(filePath)) {
      throw new Error('Video file not found');
    }

    return fs.createReadStream(filePath);
  }

  getVideoPath(videoId: string): string {
    // This is a simplified implementation
    // In production, you'd want to store the actual filename in a database

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      throw new Error(`Upload directory does not exist: ${this.uploadDir}`);
    }

    try {
      const files = fs.readdirSync(this.uploadDir);
      const file = files.find(f => f.startsWith(videoId));

      if (!file) {
        throw new Error(`Video file not found for ID: ${videoId}`);
      }

      return path.join(this.uploadDir, file);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Upload directory not found: ${this.uploadDir}`);
      }
      throw new Error(`Failed to access video file: ${error.message}`);
    }
  }

  async deleteVideo(videoId: string): Promise<void> {
    const filePath = this.getVideoPath(videoId);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop() || 'mp4';
  }
}
