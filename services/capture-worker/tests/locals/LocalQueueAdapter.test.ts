import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs/promises';
import { LocalQueueAdapter } from '../../local/adapters/LocalQueueAdapter.js';
import { CaptureJob } from '@render-engine/shared-types';

describe('LocalQueueAdapter', () => {
  const testQueuePath = './test-queue.json';
  let adapter: LocalQueueAdapter;

  const sampleJob: CaptureJob = {
    id: 'job-1',
    url: 'https://example.com',
    type: 'pdf',
    options: { width: 1280, height: 800 },
    retryCount: 0
  };

  before(async () => {
    // Ensure clean state
    try { await fs.unlink(testQueuePath); } catch { /* ignore */ }
  });

  after(async () => {
    try { await fs.unlink(testQueuePath); } catch { /* ignore */ }
  });

  beforeEach(async () => {
    await fs.writeFile(testQueuePath, JSON.stringify([]));
    adapter = new LocalQueueAdapter(testQueuePath, 3);
  });

  test('should enqueue a job', async () => {
    await adapter.enqueue(sampleJob);
    const data = await fs.readFile(testQueuePath, 'utf-8');
    const queue = JSON.parse(data);
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].body.id, 'job-1');
  });

  test('should listen and yield jobs', async () => {
    await adapter.enqueue(sampleJob);

    const controller = new AbortController();
    const iterator = adapter.listen(100, controller.signal);

    const { value, done } = await iterator.next();
    assert.strictEqual(done, false);
    assert.strictEqual(value?.job.id, 'job-1');

    controller.abort();
  });

  test('should resolve job and remove it from queue', async () => {
    await adapter.enqueue(sampleJob);
    const controller = new AbortController();
    const iterator = adapter.listen(100, controller.signal);

    const { value } = await iterator.next();
    await value?.resolve();

    const data = await fs.readFile(testQueuePath, 'utf-8');
    const queue = JSON.parse(data);
    assert.strictEqual(queue.length, 0);
    controller.abort();
  });

  test('should reject job and increment retryCount', async () => {
    await adapter.enqueue(sampleJob);
    const controller = new AbortController();
    const iterator = adapter.listen(100, controller.signal);

    const { value } = await iterator.next();
    await value?.reject(new Error('Retry me'));

    const data = await fs.readFile(testQueuePath, 'utf-8');
    const queue = JSON.parse(data);
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].body.retryCount, 1);
    controller.abort();
  });
});
