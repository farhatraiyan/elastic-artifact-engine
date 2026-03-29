import { EventEmitter } from 'events';
import { IMetadataService } from '../../src/core/interfaces.js';
import { JobStatus } from '@render-engine/shared-types';

export interface StatusUpdate {
  jobId: string;
  status: JobStatus;
  outputUrl?: string;
  error?: string;
}

export class MockMetadataAdapter extends EventEmitter implements IMetadataService {
  async updateStatus(jobId: string, status: JobStatus, outputUrl?: string, error?: string): Promise<void> {
    const update: StatusUpdate = { jobId, status, outputUrl, error };

    this.emit('statusUpdate', update);
  }
}
