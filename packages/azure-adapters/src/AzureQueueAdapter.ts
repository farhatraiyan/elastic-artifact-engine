import { QueueClient } from '@azure/storage-queue';
import { QueueService } from './interfaces.js';
import { QueueMessage } from '@capture-automation-platform/shared-types';
import { setTimeout } from 'timers/promises';

export class AzureQueueAdapter<T> implements QueueService<T> {
  private readonly MIN_DELAY = 200;
  private readonly MAX_DELAY = 30000;
  private maxRetries: number;
  private queueClient: QueueClient;

  private async delay(delay: number, signal?: AbortSignal): Promise<void> {
    try {
      await setTimeout(delay, undefined, { signal });
    } catch { /* ignore */ }
  }

  constructor(connectionString: string, queueName: string, maxRetries: number = 5) {
    this.queueClient = new QueueClient(connectionString, queueName);
    this.maxRetries = maxRetries;
  }

  async abandon(message: QueueMessage<T>): Promise<void> {
    if (!message.popReceipt) return;

    // Reset visibility to 0 so it's immediately available for retry
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
      let queueMessage: QueueMessage<T>;

      try {
        queueMessage = {
          body: JSON.parse(msg.messageText),
          id: msg.messageId,
          popReceipt: msg.popReceipt
        };
      } catch {
        // eslint-disable-next-line no-console
        console.error('Failed to parse message body:', msg.messageText);
        await this.queueClient.deleteMessage(msg.messageId, msg.popReceipt);
        continue;
      }

      yield queueMessage;
    }
  }
}
