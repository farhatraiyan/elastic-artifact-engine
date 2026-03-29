import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Worker } from '../../src/core/Worker.js';
import {
  ICaptureService,
  IMetadataService,
  IQueueConsumer,
  IStorageService,
  IWorkUnit
} from '../../src/core/interfaces.js';
import { CaptureJob } from '@render-engine/shared-types';

describe('Worker', () => {
  let mockCapture: ICaptureService;
  let mockMetadata: IMetadataService;
  let mockQueue: IQueueConsumer;
  let mockStorage: IStorageService;
  let worker: Worker;

  const sampleJob: CaptureJob = {
    id: 'job-1',
    url: 'https://example.com',
    type: 'pdf',
    options: { width: 1280, height: 800 },
    retryCount: 0
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
      listen: async function* () {
        const unit: IWorkUnit = {
          job: sampleJob,
          resolve: async () => {},
          reject: async () => {}
        };
        yield unit;
      }
    };

    worker = new Worker(mockCapture, mockMetadata, mockQueue, mockStorage);
  });

  test('should process a job successfully', async () => {
    const statusUpdates: string[] = [];
    mockMetadata.updateStatus = async (id, status) => {
      statusUpdates.push(status);
    };

    let saved = false;
    mockStorage.save = async () => {
      saved = true;
      return 'done';
    };

    // We only want to process one job then stop
    const startPromise = worker.start(100);

    // Give it a moment to process the first job
    await new Promise(resolve => setTimeout(resolve, 200));
    worker.stop();
    await startPromise;

    assert.deepStrictEqual(statusUpdates, ['Processing', 'Completed']);
    assert.strictEqual(saved, true);
  });

  test('should handle capture failure and update status to Failed', async () => {
    const statusUpdates: string[] = [];
    mockMetadata.updateStatus = async (id, status) => {
      statusUpdates.push(status);
    };

    mockCapture.capture = async () => {
      throw new Error('Capture failed');
    };

    let rejected = false;
    mockQueue.listen = async function* () {
      yield {
        job: sampleJob,
        resolve: async () => {},
        reject: async () => { rejected = true; }
      };
    };

    const startPromise = worker.start(100);
    await new Promise(resolve => setTimeout(resolve, 200));
    worker.stop();
    await startPromise;

    assert.ok(statusUpdates.includes('Failed'));
    assert.strictEqual(rejected, true);
  });
});
