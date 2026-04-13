import assert from 'node:assert';
import { test, describe, beforeEach } from 'node:test';

import { CaptureJob, QueueMessage } from '@capture-automation-platform/shared-types';

import {
  CaptureService,
  MetadataService,
  QueueService,
  StorageService
} from '../src/core/interfaces.js';
import { Worker } from '../src/core/Worker.js';

describe('Worker', () => {
  let mockCapture: CaptureService;
  let mockMetadata: MetadataService;
  let mockQueue: QueueService<CaptureJob>;
  let mockStorage: StorageService;
  let worker: Worker;

  const sampleJob: CaptureJob = {
    id: 'job-1',
    url: 'https://example.com',
    type: 'pdf',
    options: { width: 1280, height: 800 },
    retryCount: 0
  };

  const sampleMessage: QueueMessage<CaptureJob> = {
    id: 'msg-1',
    body: sampleJob,
    popReceipt: 'receipt-1'
  };

  beforeEach(() => {
    mockCapture = {
      init: async () => {},
      capture: async () => Buffer.from('fake-pdf'),
      close: async () => {}
    };
    mockMetadata = {
      updateStatus: async () => {}
    };
    mockStorage = {
      save: async () => '/path/to/job-1.pdf'
    };
    mockQueue = {
      complete: async () => {},
      abandon: async () => {},
      listen: async function* () {
        yield sampleMessage;
      }
    };

    worker = new Worker(mockCapture, mockMetadata, mockQueue, mockStorage);
  });

  test('should process multiple jobs in parallel up to concurrency limit', async () => {
    const job1: CaptureJob = { ...sampleJob, id: 'job-1' };
    const job2: CaptureJob = { ...sampleJob, id: 'job-2' };
    const job3: CaptureJob = { ...sampleJob, id: 'job-3' };

    let activeCount = 0;
    let maxActiveCount = 0;

    mockCapture.capture = async () => {
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

    // Concurrency 2
    const startPromise = worker.start(2);

    // Give it time to process
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

    let completedMessage: QueueMessage<CaptureJob> | null = null;
    const completeStub = async (msg: QueueMessage<CaptureJob>) => {
      completedMessage = msg;
    };
    mockQueue.complete = completeStub;

    // We only want to process one job then stop
    const startPromise = worker.start();

    // Give it a moment to process the first job
    await new Promise(resolve => setTimeout(resolve, 200));
    worker.stop();
    await startPromise;

    assert.deepStrictEqual(statusUpdates, ['Processing', 'Completed']);
    assert.ok(completedMessage);
    assert.strictEqual((completedMessage as QueueMessage<CaptureJob>).id, 'msg-1');
  });

  test('should handle capture failure and update status to Failed', async () => {
    const statusUpdates: string[] = [];
    mockMetadata.updateStatus = async (id: string, status: string) => {
      statusUpdates.push(status);
    };

    mockCapture.capture = async () => {
      throw new Error('Capture failed');
    };

    let abandonedMessage: QueueMessage<CaptureJob> | null = null;
    const abandonStub = async (msg: QueueMessage<CaptureJob>) => {
      abandonedMessage = msg;
    };
    mockQueue.abandon = abandonStub;

    const startPromise = worker.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    worker.stop();
    await startPromise;

    assert.ok(statusUpdates.includes('Failed'));
    assert.ok(abandonedMessage);
    assert.strictEqual((abandonedMessage as QueueMessage<CaptureJob>).id, 'msg-1');
  });

  test('should abandon in-flight jobs on stop', async () => {
    const abandonedMessages: string[] = [];
    mockQueue.abandon = async (msg: QueueMessage<CaptureJob>) => {
      abandonedMessages.push(msg.id);
    };

    mockCapture.capture = async () => {
      // Simulate a long-running job
      await new Promise(resolve => setTimeout(resolve, 500));
      return Buffer.from('fake');
    };

    mockQueue.listen = async function* () {
      yield { id: 'm1', body: { ...sampleJob, id: 'j1' }, popReceipt: 'r1' };
      yield { id: 'm2', body: { ...sampleJob, id: 'j2' }, popReceipt: 'r2' };
    };

    const startPromise = worker.start(2);

    // Give it time to pick up the jobs but not finish them
    await new Promise(resolve => setTimeout(resolve, 100));

    worker.stop();
    await startPromise;

    assert.strictEqual(abandonedMessages.length, 2, 'Should have abandoned both in-flight jobs');
    assert.ok(abandonedMessages.includes('m1'));
    assert.ok(abandonedMessages.includes('m2'));
  });
});
