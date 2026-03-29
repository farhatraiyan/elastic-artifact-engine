import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageService } from '../../src/core/interfaces.js';

export class LocalFileSystemAdapter implements StorageService {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async save(jobId: string, filename: string, data: Buffer): Promise<string> {
    await fs.mkdir(this.outputDir, { recursive: true });
    const filePath = path.join(this.outputDir, filename);
    await fs.writeFile(filePath, data);
    return filePath;
  }
}
