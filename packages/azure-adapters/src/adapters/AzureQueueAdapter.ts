import { QueueClient } from '@azure/storage-queue';
import { QueueMessage } from '@capture-automation-platform/shared-types';
import type { TokenCredential } from '@azure/core-auth';
import { setTimeout } from 'timers/promises';

import { QueueService, Schema } from '../core/interfaces.js';

export class AzureQueueAdapter<T> implements QueueService<T> {
  private readonly MAX_DELAY = 30000;
  private readonly MIN_DELAY = 200;
  private maxRetries: number;
  private queueClient: QueueClient;
  private schema?: Schema<T>;

  private async delay(delay: number, signal?: AbortSignal): Promise<void> {
    try {
      await setTimeout(delay, undefined, { signal });
    } catch { /* ignore */ }
  }

  private constructor(queueClient: QueueClient, maxRetries: number, schema?: Schema<T>) {
    this.queueClient = queueClient;
    this.maxRetries = maxRetries;
    this.schema = schema;
  }

  static fromConnectionString<T>(connectionString: string, queueName: string, maxRetries: number = 5, schema?: Schema<T>): AzureQueueAdapter<T> {
    return new AzureQueueAdapter<T>(new QueueClient(connectionString, queueName), maxRetries, schema);
  }

  static fromCredential<T>(accountUrl: string, credential: TokenCredential, queueName: string, maxRetries: number = 5, schema?: Schema<T>): AzureQueueAdapter<T> {
    return new AzureQueueAdapter<T>(new QueueClient(`${accountUrl}/${queueName}`, credential), maxRetries, schema);
  }

  async abandon(message: QueueMessage<T>): Promise<void> {
    if (!message.popReceipt) return;

    await this.queueClient.updateMessage(message.id, message.popReceipt, undefined, 0);
  }

  async complete(message: QueueMessage<T>): Promise<void> {
    if (!message.popReceipt) return;

    await this.queueClient.deleteMessage(message.id, message.popReceipt);
  }

  async *listen(signal?: AbortSignal): AsyncGenerator<QueueMessage<T>> {
    let currentDelay = this.MIN_DELAY;

    while (!signal?.aborted) {
      const response = await this.queueClient.receiveMessages({
        numberOfMessages: 1,
        visibilityTimeout: 120
      });

      // Adaptive backoff
      if (!response.receivedMessageItems.length) {
        await this.delay(currentDelay, signal);
        currentDelay = Math.min(currentDelay * 2, this.MAX_DELAY);
        continue;
      }

      const msg = response.receivedMessageItems[0];

      if (msg.dequeueCount > this.maxRetries) {
        // eslint-disable-next-line no-console
        console.error('Message retries exceeded max', { messageId: msg.messageId });
        await this.queueClient.deleteMessage(msg.messageId, msg.popReceipt);
        continue;
      }

      // Reset delay
      currentDelay = this.MIN_DELAY;
      let messageBody: T;

      try {
        const body = JSON.parse(msg.messageText);

        if (this.schema) {
          const result = this.schema.safeParse(body);

          if (!result.success) {
            await this.queueClient.deleteMessage(msg.messageId, msg.popReceipt);
            continue;
          }

          messageBody = result.data;
        } else {
          messageBody = body as T;
        }
      } catch {
        // eslint-disable-next-line no-console
        console.error('Failed to parse message body:', msg.messageText);
        await this.queueClient.deleteMessage(msg.messageId, msg.popReceipt);
        continue;
      }

      yield {
        body: messageBody,
        id: msg.messageId,
        popReceipt: msg.popReceipt
      };
    }
  }

  async push(message: T): Promise<void> {
    await this.queueClient.sendMessage(JSON.stringify(message));
  }
}
