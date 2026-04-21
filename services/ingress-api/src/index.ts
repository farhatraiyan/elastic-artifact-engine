import { app } from '@azure/functions';
import { DefaultAzureCredential } from '@azure/identity';
import {
  AzureBlobStorageAdapter,
  AzureQueueAdapter,
  AzureTableMetadataAdapter
} from '@elastic-artifact-engine/azure-adapters';
import { RenderJob, RenderJobSchema } from '@elastic-artifact-engine/shared-types';

import { RenderHandler } from './functions/RenderHandler.js';
import { DownloadHandler } from './functions/DownloadHandler.js';
import { StatusHandler } from './functions/StatusHandler.js';

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;

const BLOB_CONTAINER_NAME = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'artifacts';
const QUEUE_NAME = process.env.AZURE_STORAGE_QUEUE_NAME || 'jobs';
const TABLE_NAME = process.env.AZURE_STORAGE_TABLE_NAME || 'metadata';

let metadata: AzureTableMetadataAdapter;
let queue: AzureQueueAdapter<RenderJob>;
let storage: AzureBlobStorageAdapter;

if (ACCOUNT_NAME) {
  const blobUrl = `https://${ACCOUNT_NAME}.blob.core.windows.net`;
  const queueUrl = `https://${ACCOUNT_NAME}.queue.core.windows.net`;
  const tableUrl = `https://${ACCOUNT_NAME}.table.core.windows.net`;

  const credential = new DefaultAzureCredential();

  metadata = AzureTableMetadataAdapter.fromCredential(tableUrl, credential, TABLE_NAME);
  queue = AzureQueueAdapter.fromCredential<RenderJob>(queueUrl, credential, QUEUE_NAME, undefined, RenderJobSchema);
  storage = AzureBlobStorageAdapter.fromCredential(blobUrl, credential, BLOB_CONTAINER_NAME);
} else {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

  metadata = AzureTableMetadataAdapter.fromConnectionString(connectionString, TABLE_NAME);
  queue = AzureQueueAdapter.fromConnectionString<RenderJob>(connectionString, QUEUE_NAME, undefined, RenderJobSchema);
  storage = AzureBlobStorageAdapter.fromConnectionString(connectionString, BLOB_CONTAINER_NAME);
}

const renderHandler = new RenderHandler(metadata, queue);
const downloadHandler = new DownloadHandler(metadata, storage);
const statusHandler = new StatusHandler(metadata, storage);

app.http('render', {
  authLevel: 'function',
  handler: renderHandler.handle.bind(renderHandler),
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
