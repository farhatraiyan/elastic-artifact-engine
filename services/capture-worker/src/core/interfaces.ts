import { CaptureJob, JobStatus } from '@render-engine/shared-types';

export interface ICaptureService {
  capture(job: CaptureJob): Promise<Buffer>;
  close(): Promise<void>;
  init(): Promise<void>;
}

export interface IMetadataService {
  updateStatus(jobId: string, status: JobStatus, outputUrl?: string, error?: string): Promise<void>;
}

export interface IQueueConsumer {
  listen(pollIntervalMs: number, signal?: AbortSignal): AsyncGenerator<IWorkUnit>;
}

export interface IStorageService {
  save(jobId: string, filename: string, data: Buffer): Promise<string>;
}

export interface IWorkUnit {
  job: CaptureJob;
  reject(error: Error): Promise<void>;
  resolve(): Promise<void>;
}
