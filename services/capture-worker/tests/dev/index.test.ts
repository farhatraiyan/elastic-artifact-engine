import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { PlaywrightAdapter } from '../../src/adapters/PlaywrightAdapter.js';
import { Worker } from '../../src/core/Worker.js';
import { WebSocketQueueAdapter } from '../../dev/adapters/WebSocketQueueAdapter.js';
import { WebSocketMetadataAdapter } from '../../dev/adapters/WebSocketMetadataAdapter.js';
import { WebSocketStorageAdapter } from '../../dev/adapters/WebSocketStorageAdapter.js';
import { CaptureJob } from '@render-engine/shared-types';

interface JobResult {
  jobId: string;
  filename: string;
  data: string;
}

interface WSMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any; // We use any here as it's a generic envelope from the adapter broadcast
}

describe('Dev Entry Point (index.ts)', () => {
  const TEST_PORT = 3005;
  let queue: WebSocketQueueAdapter;
  let capture: PlaywrightAdapter;
  let worker: Worker;

  before(async () => {
    queue = new WebSocketQueueAdapter(TEST_PORT);
    const metadata = new WebSocketMetadataAdapter(queue);
    const storage = new WebSocketStorageAdapter(queue);
    capture = new PlaywrightAdapter();

    worker = new Worker(capture, metadata, queue, storage);

    // Start worker in background
    worker.start(1).catch(() => {});
  });

  after(async () => {
    worker.stop();
    await capture.close();
    queue.close();
  });

  /**
   * Helper to run a full E2E job over WebSockets
   */
  const runE2EJob = (job: CaptureJob): Promise<{ statuses: string[], result?: JobResult }> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      const statuses: string[] = [];
      let result: JobResult | undefined;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`E2E Job ${job.id} timed out`));
      }, 15000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'job_submit', payload: job }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        if (msg.type === 'job_status') {
          statuses.push(msg.payload.status as string);
          if (msg.payload.status === 'Failed') {
            clearTimeout(timeout);
            ws.close();
            resolve({ statuses });
          }
        }
        if (msg.type === 'job_result') {
          result = msg.payload as JobResult;
          clearTimeout(timeout);
          ws.close();
          resolve({ statuses, result });
        }
      });

      ws.on('error', reject);
    });
  };

  test('should complete a full PDF capture loop with valid binary output', async () => {
    const job: CaptureJob = {
      id: `e2e-pdf-${Date.now()}`,
      url: 'data:text/html,<h1>E2E PDF Test</h1>',
      type: 'pdf',
      retryCount: 0
    };

    const { statuses, result } = await runE2EJob(job);

    assert.ok(statuses.includes('Processing'), 'Should have reached Processing');
    assert.ok(statuses.includes('Completed'), 'Should have reached Completed');
    assert.ok(result, 'Should have received a job_result');

    // Magic Byte Validation for PDF: %PDF (0x25 0x50 0x44 0x46)
    const buffer = Buffer.from(result.data, 'base64');
    assert.ok(buffer.length > 500, 'PDF should be a non-trivial size');
    assert.strictEqual(buffer.subarray(0, 4).toString(), '%PDF', 'Buffer should have PDF magic bytes');
  });

  test('should complete a full Screenshot capture loop with valid binary output', async () => {
    const job: CaptureJob = {
      id: `e2e-ss-${Date.now()}`,
      url: 'data:text/html,<h1>E2E Screenshot Test</h1>',
      type: 'screenshot',
      retryCount: 0
    };

    const { statuses, result } = await runE2EJob(job);

    assert.ok(statuses.includes('Processing'));
    assert.ok(statuses.includes('Completed'));
    assert.ok(result);

    // Magic Byte Validation for PNG: 0x89 0x50 0x4E 0x47
    const buffer = Buffer.from(result.data, 'base64');
    assert.ok(buffer.length > 500, 'Screenshot should be a non-trivial size');
    assert.strictEqual(buffer[0], 0x89, 'PNG magic byte 0 should match');
    assert.strictEqual(buffer.subarray(1, 4).toString(), 'PNG', 'PNG magic bytes 1-3 should match');
  });

  test('should propagate browser failures back to the client via WebSocket', async () => {
    const job: CaptureJob = {
      id: `e2e-fail-${Date.now()}`,
      url: 'https://invalid-domain-that-will-fail.test',
      type: 'pdf',
      retryCount: 0
    };

    const { statuses } = await runE2EJob(job);

    assert.ok(statuses.includes('Failed'), 'Status should transition to Failed on DNS error');
  });

  test('should isolate job updates between different clients', async () => {
    const job1: CaptureJob = {
      id: `job-1-${Date.now()}`,
      url: 'data:text/html,<h1>Job 1</h1>',
      type: 'pdf',
      retryCount: 0
    };

    const ws1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const ws2 = new WebSocket(`ws://localhost:${TEST_PORT}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receivedByWS2: any[] = [];

    await new Promise<void>((resolve, reject) => {
      ws2.on('open', resolve);
      ws2.on('error', reject);
    });

    ws2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      receivedByWS2.push(msg);
    });

    // Run job 1 via ws1
    await new Promise<void>((resolve, reject) => {
      const run = () => {
        ws1.send(JSON.stringify({ type: 'job_submit', payload: job1 }));
      };

      if (ws1.readyState === WebSocket.OPEN) {
        run();
      } else {
        ws1.on('open', run);
      }

      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        if (msg.type === 'job_result') {
          resolve();
        }
      });
      ws1.on('error', reject);

      setTimeout(() => reject(new Error('Job 1 timed out in isolation test')), 10000);
    });

    // Verify ws2 received nothing for job 1
    const job1Updates = receivedByWS2.filter(m => m.payload.jobId === job1.id);
    assert.strictEqual(job1Updates.length, 0, 'Client 2 should not have received updates for Client 1\'s job');

    ws1.close();
    ws2.close();
  });
});
