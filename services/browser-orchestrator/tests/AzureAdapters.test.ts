import assert from 'node:assert';
import { describe, it, before } from 'node:test';

import { BlobServiceClient } from '@azure/storage-blob';
import { TableClient } from '@azure/data-tables';
import { QueueClient } from '@azure/storage-queue';

import { CaptureJob } from '@capture-automation-platform/shared-types';

import { AzureBlobStorageAdapter } from '../src/adapters/AzureBlobStorageAdapter.js';
import { AzureQueueAdapter } from '../src/adapters/AzureQueueAdapter.js';
import { AzureTableMetadataAdapter } from '../src/adapters/AzureTableMetadataAdapter.js';

describe('Azure Adapters (Integration with Azurite)', () => {
  const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
  const QUEUE_NAME = 'test-jobs';
  const BLOB_CONTAINER_NAME = 'test-captures';
  const TABLE_NAME = 'TestMetadata';

  const queue = new AzureQueueAdapter<CaptureJob>(CONNECTION_STRING, QUEUE_NAME);
  const storage = new AzureBlobStorageAdapter(CONNECTION_STRING, BLOB_CONTAINER_NAME);
  const metadata = new AzureTableMetadataAdapter(CONNECTION_STRING, TABLE_NAME);

  before(async () => {
    // Integration tests require pre-creating resources
    const queueClient = new QueueClient(CONNECTION_STRING, QUEUE_NAME);
    const blobService = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    const tableClient = TableClient.fromConnectionString(CONNECTION_STRING, TABLE_NAME);

    await Promise.all([
      queueClient.createIfNotExists(),
      blobService.getContainerClient(BLOB_CONTAINER_NAME).createIfNotExists(),
      tableClient.createTable().catch(e => {
        if (e.statusCode !== 409) {
          // eslint-disable-next-line no-console
          console.error('Failed to create table in test setup', e);
        }
      })
    ]);
  });

  describe('AzureQueueAdapter', () => {
    it('should enqueue and receive a message', async () => {
      const job: CaptureJob = {
        id: 'test-job',
        url: 'https://example.com',
        type: 'pdf',
        retryCount: 0
      };

      // Note: We use the adapter here, but message must exist
      const queueClient = new QueueClient(CONNECTION_STRING, QUEUE_NAME);
      await queueClient.sendMessage(JSON.stringify(job));

      const iterator = queue.listen();
      const result = await iterator.next();

      assert.strictEqual(result.done, false);
      assert.ok(result.value);
      assert.strictEqual(result.value.body.id, 'test-job');

      await queue.complete(result.value);
    });
  });

  describe('AzureBlobStorageAdapter', () => {
    it('should save data and return a URL', async () => {
      const data = Buffer.from('hello world');
      const url = await storage.save('test.txt', data);

      assert.ok(url.includes('test.txt'));
      assert.ok(url.startsWith('http'));
    });
  });

  describe('AzureTableMetadataAdapter', () => {
    it('should update status in table', async () => {
      await metadata.updateStatus('test-job', 'Processing');
      // Success is implied if no error is thrown
    });
  });
});
