import assert from 'node:assert';
import { test, describe } from 'node:test';

import { CaptureJob } from '@capture-automation-platform/shared-types';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { MetadataService, QueueService, StorageService } from '@capture-automation-platform/azure-adapters';

import { CaptureHandler } from '../src/functions/CaptureHandler.js';
import { StatusHandler } from '../src/functions/StatusHandler.js';

// Simple mock for HttpRequest
function mockRequest(options: { method?: string; body?: unknown; params?: Record<string, string> }): HttpRequest {
  return {
    url: 'http://localhost/api/test',
    method: options.method || 'GET',
    headers: new Map(),
    query: new Map(),
    params: options.params || {},
    user: null,
    json: async () => options.body,
    text: async () => JSON.stringify(options.body),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => { throw new Error('Not implemented'); },
    blob: async () => { throw new Error('Not implemented'); },
    clone: () => { throw new Error('Not implemented'); },
  } as unknown as HttpRequest;
}

// Simple mock for InvocationContext
const mockContext = {
  log: () => { },
  error: () => { },
  warn: () => { },
  info: () => { },
  debug: () => { },
  trace: () => { },
} as unknown as InvocationContext;

describe('Ingress API Functions (Unit Tests)', () => {
  const mockMetadata = {
    getJobState: async () => undefined,
    updateStatus: async () => { }
  } as unknown as MetadataService;

  const mockQueue = {
    push: async () => { }
  } as unknown as QueueService<CaptureJob>;

  const mockStorage = {
    generateReadSasUrl: async () => 'http://sas-url'
  } as unknown as StorageService;

  test('capture should return 400 for invalid request', async () => {
    const captureHandler = new CaptureHandler(mockMetadata, mockQueue);
    const req = mockRequest({
      method: 'POST',
      body: { url: 'invalid-url' } // Missing type
    });

    const res = await captureHandler.handle(req, mockContext);
    assert.strictEqual(res.status, 400);
  });

  test('status should return 404 for non-existent job', async () => {
    const statusHandler = new StatusHandler(mockMetadata, mockStorage);
    const req = mockRequest({
      params: { jobId: 'non-existent' }
    });

    const res = await statusHandler.handle(req, mockContext);
    assert.strictEqual(res.status, 404);
  });

  test('status should return 200 for completed job', async () => {
    const completedMetadata = {
      ...mockMetadata,
      getJobState: async () => ({
        status: 'Completed',
        updatedAt: new Date(),
        outputUrl: 'https://storage.com/captures/job1.pdf'
      })
    } as unknown as MetadataService;

    const statusHandler = new StatusHandler(completedMetadata, mockStorage);
    const req = mockRequest({
      params: { jobId: 'job1' }
    });

    const res = await statusHandler.handle(req, mockContext);
    assert.strictEqual(res.status, 200);
    const body = res.jsonBody as any;
    assert.strictEqual(body.status, 'Completed');
    assert.strictEqual(body.downloadUrl, 'http://sas-url');
  });
});
