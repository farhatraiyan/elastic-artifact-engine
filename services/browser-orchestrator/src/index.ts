import { DefaultAzureCredential } from '@azure/identity';
import {
  AzureBlobStorageAdapter,
  AzureQueueAdapter,
  AzureTableMetadataAdapter
} from '@capture-automation-platform/azure-adapters';
import { PlaywrightAdapter } from './adapters/PlaywrightAdapter.js';
import { Worker } from './core/Worker.js';
import { CaptureJob, CaptureJobSchema } from '@capture-automation-platform/shared-types';

async function main() {
  const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;

  const BLOB_CONTAINER_NAME = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'captures';
  const QUEUE_NAME = process.env.AZURE_STORAGE_QUEUE_NAME || 'jobs';
  const TABLE_NAME = process.env.AZURE_STORAGE_TABLE_NAME || 'metadata';

  const CONCURRENCY = process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY) : 2;
  const MAX_RETRIES = process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES) : 5;

  const capture = new PlaywrightAdapter();

  let metadata: AzureTableMetadataAdapter;
  let queue: AzureQueueAdapter<CaptureJob>;
  let storage: AzureBlobStorageAdapter;
  let storageMode: string;

  if (ACCOUNT_NAME) {
    const blobUrl = `https://${ACCOUNT_NAME}.blob.core.windows.net`;
    const queueUrl = `https://${ACCOUNT_NAME}.queue.core.windows.net`;
    const tableUrl = `https://${ACCOUNT_NAME}.table.core.windows.net`;

    const credential = new DefaultAzureCredential();

    metadata = AzureTableMetadataAdapter.fromCredential(tableUrl, credential, TABLE_NAME);
    queue = AzureQueueAdapter.fromCredential<CaptureJob>(queueUrl, credential, QUEUE_NAME, MAX_RETRIES, CaptureJobSchema);
    storage = AzureBlobStorageAdapter.fromCredential(blobUrl, credential, BLOB_CONTAINER_NAME);
    storageMode = `Azure Storage (${ACCOUNT_NAME}, DefaultAzureCredential)`;
  } else {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

    metadata = AzureTableMetadataAdapter.fromConnectionString(connectionString, TABLE_NAME);
    queue = AzureQueueAdapter.fromConnectionString<CaptureJob>(connectionString, QUEUE_NAME, MAX_RETRIES, CaptureJobSchema);
    storage = AzureBlobStorageAdapter.fromConnectionString(connectionString, BLOB_CONTAINER_NAME);
    storageMode = connectionString === 'UseDevelopmentStorage=true' ? 'Azurite (Local)' : 'Azure Storage (connection string)';
  }

  const worker = new Worker(capture, metadata, queue, storage);

  // eslint-disable-next-line no-console
  console.log('--- Browser Orchestrator Worker ---');
  // eslint-disable-next-line no-console
  console.log(`Storage: ${storageMode}`);

  worker.start(CONCURRENCY).catch(err => {
    // eslint-disable-next-line no-console
    console.error('[Worker] Failed:', err);
    process.exit(1);
  });

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log('\n[Worker] Shutting down...');
    worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[Fatal] Initialisation failed:', err);
  process.exit(1);
});
