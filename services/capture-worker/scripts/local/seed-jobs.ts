import { LocalQueueAdapter } from '../../local/adapters/LocalQueueAdapter.js';
import { CaptureJob } from '@render-engine/shared-types';

/**
 * seed-jobs.ts: Local utility to populate the local-queue.json
 *
 * Usage:
 *   npx tsx scripts/local/seed-jobs.ts [url] [type]
 */

const QUEUE_PATH = './local/storage/queue.json';
const adapter = new LocalQueueAdapter(QUEUE_PATH);

const samples: CaptureJob[] = [
  {
    id: `seed-google-${Date.now()}`,
    url: 'https://www.google.com',
    type: 'pdf',
    options: { width: 1280, height: 800 },
    retryCount: 0
  },
  {
    id: `seed-github-${Date.now()}`,
    url: 'https://github.com',
    type: 'png',
    options: {
      width: 1920,
      height: 1080,
      injectCss: 'body { border: 10px solid #238636; }'
    },
    retryCount: 0
  },
  {
    id: `seed-wikipedia-${Date.now()}`,
    url: 'https://en.wikipedia.org/wiki/Special:Random',
    type: 'pdf',
    options: { width: 1024, height: 768 },
    retryCount: 0
  },
  {
    id: `seed-example-md-${Date.now()}`,
    url: 'https://example.com',
    type: 'md',
    options: { width: 1280, height: 800, raw: true },
    retryCount: 0
  },
  {
    id: `seed-wikipedia-md-${Date.now()}`,
    url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
    type: 'md',
    options: { width: 1280, height: 800 },
    retryCount: 0
  }
];

async function seed() {
  const args = process.argv.slice(2);

  if (args.length >= 1) {
    const isRaw = args.includes('--raw');
    const customJob: CaptureJob = {
      id: `custom-${Date.now()}`,
      url: args[0],
      type: (args[1] as 'pdf' | 'png' | 'md') || 'pdf',
      options: { width: 1280, height: 800, raw: isRaw },
      retryCount: 0
    };

    await adapter.enqueue(customJob);
    // eslint-disable-next-line no-console
    console.log(`✅ Seeded 1 custom job: ${customJob.url} (${customJob.type})`);
  } else {
    for (const job of samples) {
      await adapter.enqueue(job);
    }
    // eslint-disable-next-line no-console
    console.log(`✅ Seeded ${samples.length} sample jobs into ${QUEUE_PATH}`);
  }
}

seed().catch(err => {
  // eslint-disable-next-line no-console
  console.error('❌ Failed to seed jobs:', err);
  process.exit(1);
});
