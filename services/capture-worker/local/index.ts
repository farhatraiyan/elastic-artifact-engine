import { LocalQueueAdapter } from './adapters/LocalQueueAdapter.js';
import { LocalFileSystemAdapter } from './adapters/LocalFileSystemAdapter.js';
import { MockMetadataAdapter } from './adapters/MockMetadataAdapter.js';
import { PlaywrightAdapter } from '../src/adapters/PlaywrightAdapter.js';
import { Worker } from '../src/core/Worker.js';

import { LocalCLI } from './cli.js';

async function main() {
  const STORAGE_DIR = './local/storage';
  const QUEUE_PATH = `${STORAGE_DIR}/queue.json`;
  const OUTPUT_DIR = `${STORAGE_DIR}/output`;
  const POLL_INTERVAL_MS = 2000;
  const CONCURRENCY = 2;

  const capture = new PlaywrightAdapter();
  const metadata = new MockMetadataAdapter();
  const queue = new LocalQueueAdapter(QUEUE_PATH, 3, POLL_INTERVAL_MS);
  const storage = new LocalFileSystemAdapter(OUTPUT_DIR);

  const worker = new Worker(capture, metadata, queue, storage);

  const cli = new LocalCLI(worker, queue, metadata);

  // Poll every 2s, concurrency 2
  worker.start(CONCURRENCY).catch(err => {
    // eslint-disable-next-line no-console
    console.error('Worker failed:', err);
  });

  cli.start();
}

// eslint-disable-next-line no-console
main().catch(console.error);
