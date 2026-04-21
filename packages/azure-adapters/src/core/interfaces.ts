import { JobStatus, QueueMessage, JobState } from '@elastic-artifact-engine/shared-types';

export interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export interface MetadataService {
  getJobState(jobId: string): Promise<JobState | undefined>;
  updateStatus(jobId: string, status: JobStatus, outputUrl?: string, error?: string): Promise<void>;
}

export interface QueueService<T = unknown> {
  abandon(message: QueueMessage<T>): Promise<void>;
  complete(message: QueueMessage<T>): Promise<void>;
  listen(signal?: AbortSignal): AsyncGenerator<QueueMessage<T>>;
  push(message: T): Promise<void>;
}

export interface StorageService {
  generateReadSasUrl(filename: string, expiryMinutes: number): Promise<string>;
  save(filename: string, data: Buffer): Promise<string>;
}
