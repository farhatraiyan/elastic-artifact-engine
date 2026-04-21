import { RenderJob, QueueMessage } from '@elastic-artifact-engine/shared-types';

import {
  RenderService,
  MetadataService,
  QueueService,
  StorageService
} from './interfaces.js';

export class Worker {
  private abortController: AbortController | null = null;
  private activeMessages = new Map<Promise<void>, QueueMessage<RenderJob>>();
  private renderService: RenderService;
  private isRunning = false;
  private metadata: MetadataService;
  private queue: QueueService<RenderJob>;
  private storage: StorageService;

  private async processMessage(message: QueueMessage<RenderJob>) {
    const job = message.body;

    try {
      await this.metadata.updateStatus(job.id, 'Processing');

      const data = await this.renderService.render(job);
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
    renderService: RenderService,
    metadata: MetadataService,
    queue: QueueService<RenderJob>,
    storage: StorageService
  ) {
    this.renderService = renderService;
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
      await this.renderService.init();

      for await (const message of this.queue.listen(controller.signal)) {
        if (!this.isRunning) {
          break;
        }

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

      await this.renderService.close();
      this.isRunning = false;
    }
  }

  stop() {
    this.isRunning = false;
    this.abortController?.abort();
  }
}
