import { CaptureJob, JobStatus, QueueMessage } from '@render-engine/shared-types';

export interface CaptureService {
  capture(job: CaptureJob): Promise<Buffer>;
  close(): Promise<void>;
  init(): Promise<void>;
}

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
