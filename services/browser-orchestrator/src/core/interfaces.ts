import { RenderJob } from '@elastic-artifact-engine/shared-types';
export { MetadataService, QueueService, StorageService } from '@elastic-artifact-engine/azure-adapters';

export interface RenderService {
  render(job: RenderJob): Promise<Buffer>;
  close(): Promise<void>;
  init(): Promise<void>;
}
