import { app } from '@azure/functions';
import {
  AzureBlobStorageAdapter,
  AzureQueueAdapter,
  AzureTableMetadataAdapter
} from '@capture-automation-platform/azure-adapters';
import { CaptureJob, CaptureJobSchema } from '@capture-automation-platform/shared-types';

import { CaptureHandler } from './functions/CaptureHandler.js';
import { DownloadHandler } from './functions/DownloadHandler.js';
import { StatusHandler } from './functions/StatusHandler.js';

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

const BLOB_CONTAINER_NAME = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'captures';
const QUEUE_NAME = process.env.AZURE_STORAGE_QUEUE_NAME || 'jobs';
const TABLE_NAME = process.env.AZURE_STORAGE_TABLE_NAME || 'metadata';

const metadata = new AzureTableMetadataAdapter(CONNECTION_STRING, TABLE_NAME);
const queue = new AzureQueueAdapter<CaptureJob>(CONNECTION_STRING, QUEUE_NAME, undefined, CaptureJobSchema);
const storage = new AzureBlobStorageAdapter(CONNECTION_STRING, BLOB_CONTAINER_NAME);

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

app.http('status', {
  authLevel: 'function',
  handler: statusHandler.handle.bind(statusHandler),
  methods: ['GET'],
  route: 'status/{jobId}'
});
