import * as fs from 'fs/promises';
import * as path from 'path';
import AsyncLock from 'async-lock';
import { setTimeout } from 'timers/promises';

import {
  CaptureJob,
  CaptureJobSchema,
  QueueMessage
} from '@render-engine/shared-types';

import { QueueConsumer } from '../../src/core/interfaces.js';

export class LocalQueueAdapter implements QueueConsumer<CaptureJob> {
  private inFlight = new Map<string, string>();
  private lock = new AsyncLock();
  private maxRetries: number;
  private pollIntervalMs: number;
  private queuePath: string;

  private async delay(signal?: AbortSignal): Promise<void> {
    try {
      await setTimeout(this.pollIntervalMs, undefined, { signal });
    } catch { /* Ignore AbortError, let the loop handle the exit */ }
  }

  private async readQueue(): Promise<QueueMessage<unknown>[]> {
    try {
      const data = await fs.readFile(this.queuePath, 'utf-8');

      if (!data.trim()) return [];

      return JSON.parse(data);
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];

      // eslint-disable-next-line no-console
      console.error(`Failed to read or parse queue file at ${this.queuePath}:`, error);
      return [];
    }
  }

  private async removeFromQueue(id: string): Promise<void> {
    await this.lock.acquire('queue', async () => {
      const queue = await this.readQueue();
      const updated = queue.filter(m => m.id !== id);

      await this.writeQueue(updated);
    });
  }

  private async writeQueue(queue: QueueMessage<unknown>[]): Promise<void> {
    const tempPath = `${this.queuePath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;

    try {
      await fs.mkdir(path.dirname(this.queuePath), { recursive: true });
      await fs.writeFile(tempPath, JSON.stringify(queue, null, 2));
      await fs.rename(tempPath, this.queuePath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch { /* ignore */ }

      throw error;
    }
  }

  constructor(
    queuePath: string,
    maxRetries: number = 3,
    pollIntervalMs: number = 2000
  ) {
    this.queuePath = queuePath;
    this.maxRetries = maxRetries;
    this.pollIntervalMs = pollIntervalMs;
  }

  async abandon(message: QueueMessage<CaptureJob>): Promise<void> {
    const currentReceipt = this.inFlight.get(message.id);

    if (!currentReceipt || currentReceipt !== message.popReceipt) {
      // Message might have already timed out or been completed
      return;
    }

    const job = message.body;

    try {
      if (job.retryCount >= this.maxRetries) {
        await this.removeFromQueue(message.id);
        return;
      }

      const updatedJob = { ...job, retryCount: job.retryCount + 1 };
      await this.removeFromQueue(message.id);
      await this.enqueue(updatedJob);
    } finally {
      this.inFlight.delete(message.id);
    }
  }

  async clear(): Promise<void> {
    await this.lock.acquire('queue', () => this.writeQueue([]));
  }

  async complete(message: QueueMessage<CaptureJob>): Promise<void> {
    const currentReceipt = this.inFlight.get(message.id);

    if (!currentReceipt || currentReceipt !== message.popReceipt) {
      throw new Error(`Invalid or expired pop receipt for message ${message.id}`);
    }

    try {
      await this.removeFromQueue(message.id);
    } finally {
      this.inFlight.delete(message.id);
    }
  }

  async enqueue(job: CaptureJob): Promise<void> {
    await this.lock.acquire('queue', async () => {
      const queue = await this.readQueue();

      const message: QueueMessage<CaptureJob> = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        body: job,
      };

      queue.push(message);
      await this.writeQueue(queue);
    });
  }

  async list(): Promise<QueueMessage<CaptureJob>[]> {
    return (await this.readQueue()) as QueueMessage<CaptureJob>[];
  }

  private isValidJob(message: QueueMessage<unknown>): message is QueueMessage<CaptureJob> {
    const result = CaptureJobSchema.safeParse(message.body);

    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(`Malformed job in queue: ${message.id}`, result.error.errors);

      return false;
    }

    return true;
  }

  async *listen(signal?: AbortSignal): AsyncGenerator<QueueMessage<CaptureJob>> {
    while (!signal?.aborted) {
      const queue = await this.readQueue();

      if (!queue.length) {
        await this.delay(signal);
        continue;
      }

      const available = queue.filter(m => !this.inFlight.has(m.id));

      if (!available.length) {
        await this.delay(signal);
        continue;
      }

      const rawMessage = available[0];

      if (!this.isValidJob(rawMessage)) {
        await this.removeFromQueue(rawMessage.id);
        continue;
      }

      const popReceipt = Math.random().toString(36).slice(2);

      const messageWithReceipt: QueueMessage<CaptureJob> = {
        ...rawMessage,
        popReceipt,
      };

      this.inFlight.set(rawMessage.id, popReceipt);
      yield messageWithReceipt;
    }
  }
}
