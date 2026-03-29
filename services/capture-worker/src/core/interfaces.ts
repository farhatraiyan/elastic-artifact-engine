import { CaptureJob, JobStatus, QueueMessage } from '@render-engine/shared-types';

export interface ICaptureService {
  capture(job: CaptureJob): Promise<Buffer>;
  close(): Promise<void>;
  init(): Promise<void>;
}

export interface IMetadataService {
  updateStatus(jobId: string, status: JobStatus, outputUrl?: string, error?: string): Promise<void>;
}

export interface IQueueConsumer {
  abandon(message: QueueMessage): Promise<void>;
  complete(message: QueueMessage): Promise<void>;
  listen(signal?: AbortSignal): AsyncGenerator<QueueMessage>;
}

export interface IStorageService {
  save(jobId: string, filename: string, data: Buffer): Promise<string>;
}
