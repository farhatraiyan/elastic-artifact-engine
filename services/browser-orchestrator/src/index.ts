import { AzureBlobStorageAdapter } from './adapters/AzureBlobStorageAdapter.js';
import { AzureQueueAdapter } from './adapters/AzureQueueAdapter.js';
import { AzureTableMetadataAdapter } from './adapters/AzureTableMetadataAdapter.js';
import { PlaywrightAdapter } from './adapters/PlaywrightAdapter.js';
import { Worker } from './core/Worker.js';
import { CaptureJob } from '@capture-automation-platform/shared-types';

async function main() {
  // Configuration
  const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

  const BLOB_CONTAINER_NAME = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'captures';
  const QUEUE_NAME = process.env.AZURE_STORAGE_QUEUE_NAME || 'jobs';
  const TABLE_NAME = process.env.AZURE_STORAGE_TABLE_NAME || 'metadata';

  const CONCURRENCY = process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY) : 2;
  const MAX_RETRIES = process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES) : 5;

  // Adapters
  const capture = new PlaywrightAdapter();
  const metadata = new AzureTableMetadataAdapter(CONNECTION_STRING, TABLE_NAME);
  const queue = new AzureQueueAdapter<CaptureJob>(CONNECTION_STRING, QUEUE_NAME, MAX_RETRIES);
  const storage = new AzureBlobStorageAdapter(CONNECTION_STRING, BLOB_CONTAINER_NAME);

  // Worker
  const worker = new Worker(capture, metadata, queue, storage);

  // eslint-disable-next-line no-console
  console.log('--- Browser Orchestrator Worker ---');
  // eslint-disable-next-line no-console
  console.log(`Storage: ${CONNECTION_STRING === 'UseDevelopmentStorage=true' ? 'Azurite (Local)' : 'Azure Storage (Cloud)'}`);

  // Start Worker
  worker.start(CONCURRENCY).catch(err => {
    // eslint-disable-next-line no-console
    console.error('[Worker] Failed:', err);
    process.exit(1);
  });

  // Graceful shutdown
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
