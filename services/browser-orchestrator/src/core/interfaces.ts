import { CaptureJob } from '@capture-automation-platform/shared-types';
export { MetadataService, QueueService, StorageService } from '@capture-automation-platform/azure-adapters';

export interface CaptureService {
  capture(job: CaptureJob): Promise<Buffer>;
  close(): Promise<void>;
  init(): Promise<void>;
}
