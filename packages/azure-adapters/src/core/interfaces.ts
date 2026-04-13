import { JobStatus, QueueMessage } from '@capture-automation-platform/shared-types';

export interface MetadataService {
  updateStatus(jobId: string, status: JobStatus, outputUrl?: string, error?: string): Promise<void>;
}

export interface QueueService<T = unknown> {
  abandon(message: QueueMessage<T>): Promise<void>;
  complete(message: QueueMessage<T>): Promise<void>;
  listen(signal?: AbortSignal): AsyncGenerator<QueueMessage<T>>;
}

export interface StorageService {
  save(filename: string, data: Buffer): Promise<string>;
}
