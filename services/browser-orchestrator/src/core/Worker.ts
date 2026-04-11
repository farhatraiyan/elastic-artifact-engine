import { CaptureJob, QueueMessage } from '@capture-automation-platform/shared-types';

import {
  CaptureService,
  MetadataService,
  QueueService,
  StorageService
} from './interfaces.js';

export class Worker {
  private abortController: AbortController | null = null;
  private activeMessages = new Map<Promise<void>, QueueMessage<CaptureJob>>();
  private capture: CaptureService;
  private isRunning = false;
  private metadata: MetadataService;
  private queue: QueueService<CaptureJob>;
  private storage: StorageService;

  private async processMessage(message: QueueMessage<CaptureJob>) {
    const job = message.body;

    try {
      await this.metadata.updateStatus(job.id, 'Processing');

      const data = await this.capture.capture(job);
      const filename = `${job.id}.${job.type}`;

      const outputUrl = await this.storage.save(filename, data);

      await Promise.all([
        this.metadata.updateStatus(job.id, 'Completed', outputUrl),
        this.queue.complete(message)
      ]);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const err = error as Error;

      await Promise.all([
        this.metadata.updateStatus(job.id, 'Failed', undefined, err.message),
        this.queue.abandon(message)
      ]);
    }
  }

  constructor(
    capture: CaptureService,
    metadata: MetadataService,
    queue: QueueService<CaptureJob>,
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

    try {
      await this.capture.init();

      for await (const message of this.queue.listen(controller.signal)) {
        if (!this.isRunning) {
          break;
        }

        // Wait for a slot if concurrency limit is reached
        while (this.activeMessages.size >= concurrency) {
          await Promise.race(this.activeMessages.keys());
        }

        const promise = this.processMessage(message).finally(() => this.activeMessages.delete(promise));
        this.activeMessages.set(promise, message);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;

      throw error;
    } finally {
      // Graceful shutdown: Abandon all in-flight jobs
      const inFlightMessages = Array.from(this.activeMessages.values());
      const abandonPromises = inFlightMessages.map(msg => this.queue.abandon(msg));

      await Promise.allSettled(abandonPromises);

      await this.capture.close();
      this.isRunning = false;
    }
  }

  stop() {
    this.isRunning = false;
    this.abortController?.abort();
  }
}
