import { PlaywrightAdapter } from '../src/adapters/PlaywrightAdapter.js';
import { WebSocketMetadataAdapter } from './adapters/WebSocketMetadataAdapter.js';
import { WebSocketStorageAdapter } from './adapters/WebSocketStorageAdapter.js';
import { WebSocketQueueAdapter } from './adapters/WebSocketQueueAdapter.js';
import { Worker } from '../src/core/Worker.js';

async function main() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3005;
  const CONCURRENCY = process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY) : 1;

  const capture = new PlaywrightAdapter();
  const queue = new WebSocketQueueAdapter(PORT);

  const metadata = new WebSocketMetadataAdapter(queue);
  const storage = new WebSocketStorageAdapter(queue);

  const worker = new Worker(capture, metadata, queue, storage);

  // eslint-disable-next-line no-console
  console.log('--- Render Engine Dev Worker (WebSocket) ---');

  worker.start(CONCURRENCY).catch(err => {
    // eslint-disable-next-line no-console
    console.error('[Dev Worker] Failed:', err);
  });

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log('\n[Dev Worker] Shutting down...');
    worker.stop();
    queue.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// eslint-disable-next-line no-console
main().catch(console.error);
