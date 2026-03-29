import {
  ICaptureService,
  IMetadataService,
  IQueueConsumer,
  IStorageService
} from './interfaces.js';

export class Worker {
  private abortController: AbortController | null = null;
  private capture: ICaptureService;
  private isRunning = false;
  private metadata: IMetadataService;
  private queue: IQueueConsumer;
  private storage: IStorageService;

  constructor(
    capture: ICaptureService,
    metadata: IMetadataService,
    queue: IQueueConsumer,
    storage: IStorageService
  ) {
    this.capture = capture;
    this.metadata = metadata;
    this.queue = queue;
    this.storage = storage;
  }

  async start(pollIntervalMs: number = 2000) {
    if (this.isRunning) return;

    this.isRunning = true;
    const controller = new AbortController();
    this.abortController = controller;

    try {
      await this.capture.init();

      for await (const unit of this.queue.listen(pollIntervalMs, controller.signal)) {
        if (!this.isRunning) break;

        const { job, resolve, reject } = unit;

        try {
          await this.metadata.updateStatus(job.id, 'Processing');

          const data = await this.capture.capture(job);
          const ext = job.type === 'pdf' ? 'pdf' : 'png';
          const filename = `${job.id}.${ext}`;

          const outputUrl = await this.storage.save(job.id, filename, data);

          await this.metadata.updateStatus(job.id, 'Completed', outputUrl);
          await resolve();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.metadata.updateStatus(job.id, 'Failed', undefined, message);
          await reject(error instanceof Error ? error : new Error(message));
        }
      }
    } finally {
      await this.capture.close();
      this.isRunning = false;
    }
  }

  stop() {
    this.isRunning = false;
    this.abortController?.abort();
  }
}
