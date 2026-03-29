import { LocalQueueAdapter } from './adapters/LocalQueueAdapter.js';
import { LocalFileSystemAdapter } from './adapters/LocalFileSystemAdapter.js';
import { MockMetadataAdapter } from './adapters/MockMetadataAdapter.js';
import { PlaywrightAdapter } from '../src/adapters/PlaywrightAdapter.js';
import { Worker } from '../src/core/Worker.js';

async function main() {
  const capture = new PlaywrightAdapter();
  const metadata = new MockMetadataAdapter();
  const queue = new LocalQueueAdapter('./local-queue.json', 3);
  const storage = new LocalFileSystemAdapter('./output');

  const worker = new Worker(capture, metadata, queue, storage);

  // Handle shutdown
  const shutdown = () => {
    // eslint-disable-next-line no-console
    console.log('\nShutting down worker...');
    worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // eslint-disable-next-line no-console
  console.log('Worker started. Listening for jobs in local-queue.json...');

  await worker.start();
}

// eslint-disable-next-line no-console
main().catch(console.error);
