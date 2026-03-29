import { JobStatus } from '@render-engine/shared-types';
import { MetadataService } from '../../src/core/interfaces.js';

import { WebSocketQueueAdapter } from './WebSocketQueueAdapter.js';

export class WebSocketMetadataAdapter implements MetadataService {
  private queue: WebSocketQueueAdapter;

  constructor(queue: WebSocketQueueAdapter) {
    this.queue = queue;
  }

  async updateStatus(jobId: string, status: JobStatus, outputUrl?: string, error?: string): Promise<void> {
    this.queue.broadcast('job_status', { jobId, status, outputUrl, error });
  }
}
