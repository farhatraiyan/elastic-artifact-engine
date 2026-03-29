import * as fs from 'fs/promises';
import * as path from 'path';
import { setTimeout } from 'timers/promises';
import {
  CaptureJob,
  CaptureJobSchema,
  QueueMessage
} from '@render-engine/shared-types';
import { IQueueConsumer, IWorkUnit as IWorkerUnit } from '../../src/core/interfaces.js';

export class LocalQueueAdapter implements IQueueConsumer {
  private maxRetries: number;
  private queuePath: string;

  private async readQueue(): Promise<QueueMessage[]> {
    try {
      const data = await fs.readFile(this.queuePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      // eslint-disable-next-line no-console
      console.error(`Error reading or parsing queue file at ${this.queuePath}:`, error);
      throw error;
    }
  }

  private async removeFromQueue(id: string): Promise<void> {
    const queue = await this.readQueue();
    const updated = queue.filter(m => m.id !== id);
    await this.writeQueue(updated);
  }

  private async writeQueue(queue: QueueMessage[]): Promise<void> {
    const tempPath = `${this.queuePath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;

    try {
      await fs.mkdir(path.dirname(this.queuePath), { recursive: true });
      await fs.writeFile(tempPath, JSON.stringify(queue, null, 2));
      await fs.rename(tempPath, this.queuePath);
    } catch (error) {
      // Cleanup temp file if it exists
      try { await fs.unlink(tempPath); } catch { /* ignore */ }
      // eslint-disable-next-line no-console
      console.error(`Failed to write queue to ${this.queuePath}:`, error);
      throw error;
    }
  }

  constructor(
    queuePath: string,
    maxRetries: number = 3
  ) {
    this.queuePath = queuePath;
    this.maxRetries = maxRetries;
  }

  async enqueue(job: CaptureJob): Promise<void> {
    const queue = await this.readQueue();
    const message: QueueMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      body: job,
    };
    queue.push(message);
    await this.writeQueue(queue);
  }

  async *listen(pollIntervalMs: number, signal?: AbortSignal): AsyncGenerator<IWorkerUnit> {
    while (!signal?.aborted) {
      let queue: QueueMessage[];
      try {
        queue = await this.readQueue();
      } catch {
        // If queue read fails (e.g. corrupted JSON), wait and retry
        try {
          await setTimeout(pollIntervalMs, undefined, { signal });
        } catch {
          return;
        }
        continue;
      }

      if (queue.length === 0) {
        try {
          await setTimeout(pollIntervalMs, undefined, { signal });
        } catch {
          return;
        }
        continue;
      }

      const message = queue[0];
      const result = CaptureJobSchema.safeParse(message.body);

      if (!result.success) {
        // eslint-disable-next-line no-console
        console.error(`Malformed job in queue: ${message.id}`, result.error.errors);
        await this.removeFromQueue(message.id);
        continue;
      }

      const job = result.data;

      const unit: IWorkerUnit = {
        job,
        resolve: async () => {
          await this.removeFromQueue(message.id);
        },
        reject: async (error: Error) => {
          if (job.retryCount >= this.maxRetries) {
            // eslint-disable-next-line no-console
            console.error(`Max retries reached for job ${job.id}: ${error.message}`);
            await this.removeFromQueue(message.id);
            return;
          }

          const updatedJob = { ...job, retryCount: job.retryCount + 1 };
          await this.removeFromQueue(message.id);
          await this.enqueue(updatedJob);
        }
      };

      yield unit;
    }
  }
}
