import { CaptureJob, QueueMessage } from '@render-engine/shared-types';

import {
  CaptureService,
  MetadataService,
  QueueConsumer,
  StorageService
} from './interfaces.js';

export class Worker {
  private abortController: AbortController | null = null;
  private capture: CaptureService;
  private isRunning = false;
  private metadata: MetadataService;
  private queue: QueueConsumer<CaptureJob>;
  private storage: StorageService;

  private async processMessage(message: QueueMessage<CaptureJob>) {
    const job = message.body;

    try {
      await this.metadata.updateStatus(job.id, 'Processing');

      const data = await this.capture.capture(job);
      const ext = job.type === 'pdf' ? 'pdf' : 'png';
      const filename = `${job.id}.${ext}`;

      const outputUrl = await this.storage.save(job.id, filename, data);

      await this.metadata.updateStatus(job.id, 'Completed', outputUrl);
      await this.queue.complete(message);
    } catch (error) {
      const err = error as Error;

      await this.metadata.updateStatus(job.id, 'Failed', undefined, err.message);
      await this.queue.abandon(message);
    }
  }

  constructor(
    capture: CaptureService,
    metadata: MetadataService,
    queue: QueueConsumer<CaptureJob>,
    storage: StorageService
  ) {
    this.capture = capture;
    this.metadata = metadata;
    this.queue = queue;
    this.storage = storage;
  }

  async start(concurrency: number = 1) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const controller = new AbortController();
    this.abortController = controller;

    const activePromises = new Set<Promise<void>>();

    try {
      await this.capture.init();

      for await (const message of this.queue.listen(controller.signal)) {
        if (!this.isRunning) {
          break;
        }

        // Wait for a slot if concurrency limit is reached
        while (activePromises.size >= concurrency) {
          await Promise.race(activePromises);
        }

        const promise = this.processMessage(message).finally(() => activePromises.delete(promise));
        activePromises.add(promise);
      }

      // Wait for all remaining jobs to finish
      await Promise.all(activePromises);
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
