import { IMetadataService } from '../../src/core/interfaces.js';
import { JobStatus } from '@render-engine/shared-types';

export class MockMetadataAdapter implements IMetadataService {
  async updateStatus(jobId: string, status: JobStatus, outputUrl?: string, error?: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[Job ${jobId}] -> ${status}${outputUrl ? ` (URL: ${outputUrl})` : ''}${error ? ` (Error: ${error})` : ''}`);
  }
}
