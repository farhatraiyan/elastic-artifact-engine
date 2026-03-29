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
    adapter = new LocalQueueAdapter(testQueuePath, 3, 10);
  });

  test('should enqueue a job', async () => {
    await adapter.enqueue(sampleJob);
    const data = await fs.readFile(testQueuePath, 'utf-8');
    const queue = JSON.parse(data);
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].body.id, 'job-1');
  });

  test('should not yield the same job twice if it is inFlight', async () => {
    await adapter.enqueue(sampleJob);
    await adapter.enqueue({ ...sampleJob, id: 'job-2' });

    const controller = new AbortController();
    const iterator = adapter.listen(controller.signal);

    const { value: msg1 } = await iterator.next();
    assert.strictEqual(msg1?.body.id, 'job-1');

    // msg1 is inFlight, next yield should be job-2
    const { value: msg2 } = await iterator.next();
    assert.strictEqual(msg2?.body.id, 'job-2');

    controller.abort();
  });

  test('should remove from inFlight after complete', async () => {
    await adapter.enqueue(sampleJob);
    const controller = new AbortController();
    const iterator = adapter.listen(controller.signal);

    const { value: msg1 } = await iterator.next();
    assert.ok(msg1);
    await adapter.complete(msg1);

    // Re-enqueue same job ID (simulated)
    await adapter.enqueue(sampleJob);

    // Should be able to yield it again since it's no longer inFlight
    const { value: msg2 } = await iterator.next();
    assert.strictEqual(msg2?.body.id, 'job-1');

    controller.abort();
  });

  test('should fail complete if popReceipt is invalid', async () => {
    await adapter.enqueue(sampleJob);
    const controller = new AbortController();
    const iterator = adapter.listen(controller.signal);

    const { value: msg1 } = await iterator.next();
    assert.ok(msg1);

    const invalidMsg = { ...msg1, popReceipt: 'wrong' };
    await assert.rejects(adapter.complete(invalidMsg), /Invalid or expired pop receipt/);

    controller.abort();
  });

  test('should resolve job and remove it from queue', async () => {
    await adapter.enqueue(sampleJob);
    const controller = new AbortController();
    const iterator = adapter.listen(controller.signal);

    const { value } = await iterator.next();
    assert.ok(value);
    await adapter.complete(value);

    const data = await fs.readFile(testQueuePath, 'utf-8');
    const queue = JSON.parse(data);
    assert.strictEqual(queue.length, 0);
    controller.abort();
  });

  test('should reject job and increment retryCount', async () => {
    await adapter.enqueue(sampleJob);
    const controller = new AbortController();
    const iterator = adapter.listen(controller.signal);

    const { value } = await iterator.next();
    assert.ok(value);
    await adapter.abandon(value);

    const data = await fs.readFile(testQueuePath, 'utf-8');
    const queue = JSON.parse(data);
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].body.retryCount, 1);
    controller.abort();
  });
});
