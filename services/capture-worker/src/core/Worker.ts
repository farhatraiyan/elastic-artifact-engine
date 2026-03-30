import { CaptureJob, QueueMessage } from '@render-engine/shared-types';

import {
  CaptureService,
  MetadataService,
  QueueConsumer,
  StorageService
} from './interfaces.js';

export class Worker {
  private abortController: AbortController | null = null;
  private activeMessages = new Map<Promise<void>, QueueMessage<CaptureJob>>();
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
      if (error instanceof Error && error.name === 'AbortError') {
        // We're stopping, let's just return and let start() handle it
        return;
      }

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
