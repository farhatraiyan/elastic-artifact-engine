import { app } from '@azure/functions';
import { DefaultAzureCredential } from '@azure/identity';
import {
  AzureBlobStorageAdapter,
  AzureQueueAdapter,
  AzureTableMetadataAdapter
} from '@capture-automation-platform/azure-adapters';
import { CaptureJob, CaptureJobSchema } from '@capture-automation-platform/shared-types';

import { CaptureHandler } from './functions/CaptureHandler.js';
import { DownloadHandler } from './functions/DownloadHandler.js';
import { StatusHandler } from './functions/StatusHandler.js';

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;

const BLOB_CONTAINER_NAME = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'captures';
const QUEUE_NAME = process.env.AZURE_STORAGE_QUEUE_NAME || 'jobs';
const TABLE_NAME = process.env.AZURE_STORAGE_TABLE_NAME || 'metadata';

let metadata: AzureTableMetadataAdapter;
let queue: AzureQueueAdapter<CaptureJob>;
let storage: AzureBlobStorageAdapter;

if (ACCOUNT_NAME) {
  const blobUrl = `https://${ACCOUNT_NAME}.blob.core.windows.net`;
  const queueUrl = `https://${ACCOUNT_NAME}.queue.core.windows.net`;
  const tableUrl = `https://${ACCOUNT_NAME}.table.core.windows.net`;

  const credential = new DefaultAzureCredential();

  metadata = AzureTableMetadataAdapter.fromCredential(tableUrl, credential, TABLE_NAME);
  queue = AzureQueueAdapter.fromCredential<CaptureJob>(queueUrl, credential, QUEUE_NAME, undefined, CaptureJobSchema);
  storage = AzureBlobStorageAdapter.fromCredential(blobUrl, credential, BLOB_CONTAINER_NAME);
} else {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

  metadata = AzureTableMetadataAdapter.fromConnectionString(connectionString, TABLE_NAME);
  queue = AzureQueueAdapter.fromConnectionString<CaptureJob>(connectionString, QUEUE_NAME, undefined, CaptureJobSchema);
  storage = AzureBlobStorageAdapter.fromConnectionString(connectionString, BLOB_CONTAINER_NAME);
}

const captureHandler = new CaptureHandler(metadata, queue);
const downloadHandler = new DownloadHandler(metadata, storage);
const statusHandler = new StatusHandler(metadata, storage);

app.http('capture', {
  authLevel: 'function',
  handler: captureHandler.handle.bind(captureHandler),
  methods: ['POST']
});

app.http('download', {
  authLevel: 'function',
  handler: downloadHandler.handle.bind(downloadHandler),
  methods: ['GET'],
  route: 'download/{jobId}'
});

app.http('health', {
  authLevel: 'anonymous',
  handler: async () => ({ status: 200, body: 'OK' }),
  methods: ['GET']
});

app.http('status', {
  authLevel: 'function',
  handler: statusHandler.handle.bind(statusHandler),
  methods: ['GET'],
  route: 'status/{jobId}'
});
