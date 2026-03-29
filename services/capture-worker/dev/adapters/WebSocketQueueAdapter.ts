import { WebSocketServer, WebSocket } from 'ws';
import { CaptureJob, CaptureJobSchema, QueueMessage } from '@render-engine/shared-types';

import { QueueConsumer } from '../../src/core/interfaces.js';

/**
 * WebSocketQueueAdapter: A "push-to-pull" bridge for the dev Worker.
 * It hosts a WebSocket server and yields jobs as they are pushed by the Dev CLI.
 * Mirrors the retry and in-flight logic of the LocalQueueAdapter.
 */
export class WebSocketQueueAdapter implements QueueConsumer<CaptureJob> {
  private buffer: CaptureJob[] = [];
  private inFlight = new Map<string, string>();
  private maxRetries: number;
  private wss: WebSocketServer;

  private enqueue(job: CaptureJob) {
    this.buffer.push(job);

    if (this.onPush) {
      this.onPush();
      this.onPush = null;
    }
  }

  private isValidJob(job: unknown): job is CaptureJob {
    const result = CaptureJobSchema.safeParse(job);
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(`Malformed job received over WS:`, result.error.errors);
      return false;
    }
    return true;
  }

  private onPush: (() => void) | null = null;

  private async waitForPush(signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      this.onPush = resolve;

      signal?.addEventListener('abort', () => {
        this.onPush = null;
        resolve();
      }, { once: true });
    });
  }

  constructor(port: number = 3005, maxRetries: number = 3) {
    this.wss = new WebSocketServer({ port });
    this.maxRetries = maxRetries;

    this.wss.on('connection', (ws: WebSocket) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type !== 'job_submit') return;

          const rawJob = message.payload;

          if (!this.isValidJob(rawJob)) return;

          this.enqueue(rawJob);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse WebSocket message:', error);
        }
      });
    });

    // eslint-disable-next-line no-console
    console.log(`[Dev Worker] WebSocket server listening on port ${port}`);
  }

  async abandon(message: QueueMessage<CaptureJob>): Promise<void> {
    const currentReceipt = this.inFlight.get(message.id);

    if (!currentReceipt || currentReceipt !== message.popReceipt) return;

    try {
      const job = message.body;

      if (job.retryCount >= this.maxRetries) return;

      const updatedJob = { ...job, retryCount: (job.retryCount || 0) + 1 };
      this.enqueue(updatedJob);
    } finally {
      this.inFlight.delete(message.id);
    }
  }

  public broadcast(type: string, payload: unknown) {
    const message = JSON.stringify({ type, payload });

    for (const client of this.wss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;

      client.send(message);
    }
  }

  public close() {
    this.wss.close();
  }

  async complete(message: QueueMessage<CaptureJob>): Promise<void> {
    const currentReceipt = this.inFlight.get(message.id);

    if (!currentReceipt || currentReceipt !== message.popReceipt) {
      throw new Error(`Invalid or expired pop receipt for message ${message.id}`);
    }

    this.inFlight.delete(message.id);
  }

  async *listen(signal?: AbortSignal): AsyncGenerator<QueueMessage<CaptureJob>> {
    while (!signal?.aborted) {
      const jobIndex = this.buffer.findIndex(j => !this.inFlight.has(j.id));

      if (jobIndex === -1) {
        await this.waitForPush(signal);
        continue;
      }

      const job = this.buffer.splice(jobIndex, 1)[0];
      const popReceipt = Math.random().toString(36).slice(2);

      const messageWithReceipt: QueueMessage<CaptureJob> = {
        id: job.id,
        body: job,
        popReceipt,
      };

      this.inFlight.set(job.id, popReceipt);
      yield messageWithReceipt;
    }
  }
}
