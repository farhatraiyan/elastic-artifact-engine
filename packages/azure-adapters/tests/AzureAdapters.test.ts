import assert from 'node:assert';
import { describe, it, before } from 'node:test';

import { BlobServiceClient } from '@azure/storage-blob';
import { TableClient } from '@azure/data-tables';
import { QueueClient } from '@azure/storage-queue';

import { CaptureJob, CaptureJobSchema } from '@capture-automation-platform/shared-types';

import {
  AzureBlobStorageAdapter,
  AzureQueueAdapter,
  AzureTableMetadataAdapter
} from '@capture-automation-platform/azure-adapters';

describe('Azure Adapters (Integration with Azurite)', () => {
  const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
  const QUEUE_NAME = 'test-jobs';
  const BLOB_CONTAINER_NAME = 'test-captures';
  const TABLE_NAME = 'TestMetadata';

  const queue = AzureQueueAdapter.fromConnectionString<CaptureJob>(CONNECTION_STRING, QUEUE_NAME, 5, CaptureJobSchema);
  const storage = AzureBlobStorageAdapter.fromConnectionString(CONNECTION_STRING, BLOB_CONTAINER_NAME);
  const metadata = AzureTableMetadataAdapter.fromConnectionString(CONNECTION_STRING, TABLE_NAME);

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
        id: 'test-job-listen',
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
      assert.strictEqual(result.value.body.id, 'test-job-listen');

      await queue.complete(result.value);
    });

    it('should push a message', async () => {
      const job: CaptureJob = {
        id: 'test-job-push',
        url: 'https://example.com/push',
        type: 'png',
        retryCount: 0
      };

      await queue.push(job);

      const iterator = queue.listen();
      const result = await iterator.next();

      assert.strictEqual(result.done, false);
      assert.ok(result.value);
      assert.strictEqual(result.value.body.id, 'test-job-push');

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

    it('should generate a SAS URL', async () => {
      const data = Buffer.from('sas test');
      await storage.save('sas-test.txt', data);

      const sasUrl = await storage.generateReadSasUrl('sas-test.txt', 15);

      assert.ok(sasUrl.includes('sas-test.txt'));
      assert.ok(sasUrl.includes('sig=')); // Signature should be present
    });
  });

  describe('AzureTableMetadataAdapter', () => {
    it('should update status and retrieve state', async () => {
      const jobId = 'test-job-state';
      await metadata.updateStatus(jobId, 'Processing', 'http://output.com');

      const state = await metadata.getJobState(jobId);
      assert.ok(state);
      assert.strictEqual(state.status, 'Processing');
      assert.strictEqual(state.outputUrl, 'http://output.com');
    });

    it('should return undefined for non-existent job', async () => {
      const state = await metadata.getJobState('non-existent');
      assert.strictEqual(state, undefined);
    });
  });

  describe('fromCredential factories (construction smoke)', () => {
    // Stub TokenCredential — never invoked since we don't make a network call.
    const stubCredential = {
      getToken: async () => ({ token: 'stub', expiresOnTimestamp: Date.now() + 60_000 })
    };

    it('AzureBlobStorageAdapter.fromCredential constructs', () => {
      const adapter = AzureBlobStorageAdapter.fromCredential(
        'https://example.blob.core.windows.net',
        stubCredential,
        'captures'
      );
      assert.ok(adapter);
    });

    it('AzureQueueAdapter.fromCredential constructs', () => {
      const adapter = AzureQueueAdapter.fromCredential<CaptureJob>(
        'https://example.queue.core.windows.net',
        stubCredential,
        'jobs'
      );
      assert.ok(adapter);
    });

    it('AzureTableMetadataAdapter.fromCredential constructs', () => {
      const adapter = AzureTableMetadataAdapter.fromCredential(
        'https://example.table.core.windows.net',
        stubCredential,
        'metadata'
      );
      assert.ok(adapter);
    });
  });
});
