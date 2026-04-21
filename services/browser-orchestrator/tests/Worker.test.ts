import assert from 'node:assert';
import { test, describe, beforeEach } from 'node:test';

import { RenderJob, QueueMessage } from '@elastic-artifact-engine/shared-types';

import {
  RenderService,
  MetadataService,
  QueueService,
  StorageService
} from '../src/core/interfaces.js';
import { Worker } from '../src/core/Worker.js';

describe('Worker', () => {
  let mockRenderService: RenderService;
  let mockMetadata: MetadataService;
  let mockQueue: QueueService<RenderJob>;
  let mockStorage: StorageService;
  let worker: Worker;

  const sampleJob: RenderJob = {
    id: 'job-1',
    url: 'https://example.com',
    type: 'pdf',
    options: { width: 1280, height: 800 },
    retryCount: 0
  };

  const sampleMessage: QueueMessage<RenderJob> = {
    id: 'msg-1',
    body: sampleJob,
    popReceipt: 'receipt-1'
  };

  beforeEach(() => {
    mockRenderService = {
      render: async () => Buffer.from('fake-pdf'),
      close: async () => {},
      init: async () => {}
    };
    mockMetadata = {
      getJobState: async () => undefined,
      updateStatus: async () => {}
    };
    mockStorage = {
      generateReadSasUrl: async () => 'http://sas-url',
      save: async () => '/path/to/job-1.pdf'
    };
    mockQueue = {
      abandon: async () => {},
      complete: async () => {},
      listen: async function* () {
        yield sampleMessage;
      },
      push: async () => {}
    };

    worker = new Worker(mockRenderService, mockMetadata, mockQueue, mockStorage);
  });

  test('should process multiple jobs in parallel up to concurrency limit', async () => {
    const job1: RenderJob = { ...sampleJob, id: 'job-1' };
    const job2: RenderJob = { ...sampleJob, id: 'job-2' };
    const job3: RenderJob = { ...sampleJob, id: 'job-3' };

    let activeCount = 0;
    let maxActiveCount = 0;

    mockRenderService.render = async () => {
      activeCount++;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      await new Promise(resolve => setTimeout(resolve, 50));
      activeCount--;
      return Buffer.from('fake');
    };

    mockQueue.listen = async function* () {
      yield { id: 'm1', body: job1, popReceipt: 'r1' };
      yield { id: 'm2', body: job2, popReceipt: 'r2' };
      yield { id: 'm3', body: job3, popReceipt: 'r3' };
    };

    const startPromise = worker.start(2);

    await new Promise(resolve => setTimeout(resolve, 300));
    worker.stop();
    await startPromise;

    assert.strictEqual(maxActiveCount, 2, 'Should have processed exactly 2 jobs in parallel');
  });

  test('should process a job successfully', async () => {
    const statusUpdates: string[] = [];
    mockMetadata.updateStatus = async (id: string, status: string) => {
      statusUpdates.push(status);
    };

    let completedMessage: QueueMessage<RenderJob> | null = null;
    const completeStub = async (msg: QueueMessage<RenderJob>) => {
      completedMessage = msg;
    };
    mockQueue.complete = completeStub;

    const startPromise = worker.start();

    await new Promise(resolve => setTimeout(resolve, 200));
    worker.stop();
    await startPromise;

    assert.deepStrictEqual(statusUpdates, ['Processing', 'Completed']);
    assert.ok(completedMessage);
    assert.strictEqual((completedMessage as QueueMessage<RenderJob>).id, 'msg-1');
  });

  test('should handle render failure and update status to Failed', async () => {
    const statusUpdates: string[] = [];
    mockMetadata.updateStatus = async (id: string, status: string) => {
      statusUpdates.push(status);
    };

    mockRenderService.render = async () => {
      throw new Error('Render failed');
    };

    let abandonedMessage: QueueMessage<RenderJob> | null = null;
    const abandonStub = async (msg: QueueMessage<RenderJob>) => {
      abandonedMessage = msg;
    };
    mockQueue.abandon = abandonStub;

    const startPromise = worker.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    worker.stop();
    await startPromise;

    assert.ok(statusUpdates.includes('Failed'));
    assert.ok(abandonedMessage);
    assert.strictEqual((abandonedMessage as QueueMessage<RenderJob>).id, 'msg-1');
  });

  test('should abandon in-flight jobs on stop', async () => {
    const abandonedMessages: string[] = [];
    mockQueue.abandon = async (msg: QueueMessage<RenderJob>) => {
      abandonedMessages.push(msg.id);
    };

    mockRenderService.render = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return Buffer.from('fake');
    };

    mockQueue.listen = async function* () {
      yield { id: 'm1', body: { ...sampleJob, id: 'j1' }, popReceipt: 'r1' };
      yield { id: 'm2', body: { ...sampleJob, id: 'j2' }, popReceipt: 'r2' };
    };

    const startPromise = worker.start(2);

    await new Promise(resolve => setTimeout(resolve, 100));

    worker.stop();
    await startPromise;

    assert.strictEqual(abandonedMessages.length, 2, 'Should have abandoned both in-flight jobs');
    assert.ok(abandonedMessages.includes('m1'));
    assert.ok(abandonedMessages.includes('m2'));
  });
});
