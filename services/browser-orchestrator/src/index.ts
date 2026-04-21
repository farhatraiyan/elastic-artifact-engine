import { DefaultAzureCredential } from '@azure/identity';
import {
  AzureBlobStorageAdapter,
  AzureQueueAdapter,
  AzureTableMetadataAdapter
} from '@elastic-artifact-engine/azure-adapters';
import { PlaywrightAdapter } from './adapters/PlaywrightAdapter.js';
import { Worker } from './core/Worker.js';
import { RenderJob, RenderJobSchema } from '@elastic-artifact-engine/shared-types';

async function main() {
  const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;

  const BLOB_CONTAINER_NAME = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'artifacts';
  const QUEUE_NAME = process.env.AZURE_STORAGE_QUEUE_NAME || 'jobs';
  const TABLE_NAME = process.env.AZURE_STORAGE_TABLE_NAME || 'metadata';

  const CONCURRENCY = process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY) : 2;
  const MAX_RETRIES = process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES) : 5;

  const renderService = new PlaywrightAdapter();

  let metadata: AzureTableMetadataAdapter;
  let queue: AzureQueueAdapter<RenderJob>;
  let storage: AzureBlobStorageAdapter;
  let storageMode: string;

  if (ACCOUNT_NAME) {
    const blobUrl = `https://${ACCOUNT_NAME}.blob.core.windows.net`;
    const queueUrl = `https://${ACCOUNT_NAME}.queue.core.windows.net`;
    const tableUrl = `https://${ACCOUNT_NAME}.table.core.windows.net`;

    const credential = new DefaultAzureCredential();

    metadata = AzureTableMetadataAdapter.fromCredential(tableUrl, credential, TABLE_NAME);
    queue = AzureQueueAdapter.fromCredential<RenderJob>(queueUrl, credential, QUEUE_NAME, MAX_RETRIES, RenderJobSchema);
    storage = AzureBlobStorageAdapter.fromCredential(blobUrl, credential, BLOB_CONTAINER_NAME);
    storageMode = `Azure Storage (${ACCOUNT_NAME}, DefaultAzureCredential)`;
  } else {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

    metadata = AzureTableMetadataAdapter.fromConnectionString(connectionString, TABLE_NAME);
    queue = AzureQueueAdapter.fromConnectionString<RenderJob>(connectionString, QUEUE_NAME, MAX_RETRIES, RenderJobSchema);
    storage = AzureBlobStorageAdapter.fromConnectionString(connectionString, BLOB_CONTAINER_NAME);
    storageMode = connectionString === 'UseDevelopmentStorage=true' ? 'Azurite (Local)' : 'Azure Storage (connection string)';
  }

  const worker = new Worker(renderService, metadata, queue, storage);

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
