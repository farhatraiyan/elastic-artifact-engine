import { StorageService } from '../../src/core/interfaces.js';

import { WebSocketQueueAdapter } from './WebSocketQueueAdapter.js';

export class WebSocketStorageAdapter implements StorageService {
  private queue: WebSocketQueueAdapter;

  constructor(queue: WebSocketQueueAdapter) {
    this.queue = queue;
  }

  async save(jobId: string, filename: string, data: Buffer): Promise<string> {
    this.queue.sendUpdate(jobId, 'job_result', { filename, data: data.toString('base64') });

    return `dev://websocket/${filename}`;
  }
}
