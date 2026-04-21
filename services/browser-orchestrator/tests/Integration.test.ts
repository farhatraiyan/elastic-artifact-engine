import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import { setTimeout } from 'timers/promises';

import { BlobServiceClient } from '@azure/storage-blob';
import { TableClient } from '@azure/data-tables';
import { QueueClient } from '@azure/storage-queue';

import { RenderJob, JobStatus } from '@elastic-artifact-engine/shared-types';
import {
  AzureBlobStorageAdapter,
  AzureQueueAdapter,
  AzureTableMetadataAdapter
} from '@elastic-artifact-engine/azure-adapters';

import { PlaywrightAdapter } from '../src/adapters/PlaywrightAdapter.js';
import { Worker } from '../src/core/Worker.js';

describe('Full Worker Integration', () => {
  const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
  const QUEUE_NAME = 'int-jobs';
  const BLOB_CONTAINER_NAME = 'int-artifacts';
  const TABLE_NAME = 'IntMetadata';

  let worker: Worker;
  let queueClient: QueueClient;
  let tableClient: TableClient;
  let blobServiceClient: BlobServiceClient;

  before(async () => {
    queueClient = new QueueClient(CONNECTION_STRING, QUEUE_NAME);
    tableClient = TableClient.fromConnectionString(CONNECTION_STRING, TABLE_NAME);
    blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);

    await Promise.all([
      queueClient.createIfNotExists(),
      tableClient.createTable().catch(e => {
        if (e.statusCode !== 409) {
          // eslint-disable-next-line no-console
          console.error('Failed to create integration table:', e);
          throw e;
        }
      }),
      blobServiceClient.getContainerClient(BLOB_CONTAINER_NAME).createIfNotExists()
    ]);

    const renderService = new PlaywrightAdapter();
    const metadata = AzureTableMetadataAdapter.fromConnectionString(CONNECTION_STRING, TABLE_NAME);
    const queue = AzureQueueAdapter.fromConnectionString<RenderJob>(CONNECTION_STRING, QUEUE_NAME);
    const storage = AzureBlobStorageAdapter.fromConnectionString(CONNECTION_STRING, BLOB_CONTAINER_NAME);

    worker = new Worker(renderService, metadata, queue, storage);
  });

  after(async () => {
    // Cleanup is handled by the root test script (npm run services:down),
    // but we should ensure the worker is stopped if it was started.
    worker.stop();
  });

  it('should process a job from queue to blob storage', async () => {
    const jobId = `int-job-${Date.now()}`;
    const job: RenderJob = {
      id: jobId,
      url: 'data:text/html,<h1>Integration Test</h1>',
      type: 'pdf',
      options: { width: 1280, height: 800 },
      retryCount: 0
    };

    await tableClient.createEntity({
      partitionKey: 'Jobs',
      rowKey: jobId,
      status: 'Queued' as JobStatus,
      url: job.url,
      type: job.type,
      updatedAt: new Date()
    });

    await queueClient.sendMessage(JSON.stringify(job));

    const workerPromise = worker.start(1);

    let status: JobStatus = 'Queued';
    const startTime = Date.now();
    const timeout = 30000; // 30 seconds

    while (status !== 'Completed' && (Date.now() - startTime) < timeout) {
      await setTimeout(1000);
      const entity = await tableClient.getEntity('Jobs', jobId);
      status = entity.status as JobStatus;
    }

    worker.stop();
    await workerPromise;

    assert.strictEqual(status, 'Completed', 'Job status should be Completed');

    const finalEntity = await tableClient.getEntity('Jobs', jobId);
    assert.ok(finalEntity.outputUrl, 'Output URL should be present in metadata');

    const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient(`${jobId}.pdf`);
    const exists = await blobClient.exists();
    assert.strictEqual(exists, true, 'Resulting PDF should exist in Blob Storage');
  });
});
