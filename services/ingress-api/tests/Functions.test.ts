import assert from 'node:assert';
import { test, describe } from 'node:test';

import { RenderJob } from '@elastic-artifact-engine/shared-types';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { MetadataService, QueueService, StorageService } from '@elastic-artifact-engine/azure-adapters';

import { RenderHandler } from '../src/functions/RenderHandler.js';
import { DownloadHandler } from '../src/functions/DownloadHandler.js';
import { StatusHandler } from '../src/functions/StatusHandler.js';

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
  } as unknown as QueueService<RenderJob>;

  const mockStorage = {
    generateReadSasUrl: async () => 'http://sas-url'
  } as unknown as StorageService;

  test('render should return 400 for invalid request', async () => {
    const renderHandler = new RenderHandler(mockMetadata, mockQueue);
    const req = mockRequest({
      method: 'POST',
      body: { url: 'invalid-url' }
    });

    const res = await renderHandler.handle(req, mockContext);
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
        outputUrl: 'https://storage.com/artifacts/job1.pdf'
      })
    } as unknown as MetadataService;

    const statusHandler = new StatusHandler(completedMetadata, mockStorage);
    const req = mockRequest({
      params: { jobId: 'job1' }
    });

    const res = await statusHandler.handle(req, mockContext);
    assert.strictEqual(res.status, 200);
    const body = res.jsonBody as Record<string, unknown>;
    assert.strictEqual(body.status, 'Completed');
    assert.strictEqual(body.downloadUrl, 'http://sas-url');
  });

  test('download should return 400 for missing jobId', async () => {
    const downloadHandler = new DownloadHandler(mockMetadata, mockStorage);
    const req = mockRequest({ params: {} });

    const res = await downloadHandler.handle(req, mockContext);
    assert.strictEqual(res.status, 400);
  });

  test('download should return 404 for non-existent job', async () => {
    const downloadHandler = new DownloadHandler(mockMetadata, mockStorage);
    const req = mockRequest({
      params: { jobId: 'non-existent' }
    });

    const res = await downloadHandler.handle(req, mockContext);
    assert.strictEqual(res.status, 404);
  });

  test('download should return 400 if job is not completed', async () => {
    const processingMetadata = {
      ...mockMetadata,
      getJobState: async () => ({
        status: 'Processing',
        updatedAt: new Date()
      })
    } as unknown as MetadataService;

    const downloadHandler = new DownloadHandler(processingMetadata, mockStorage);
    const req = mockRequest({
      params: { jobId: 'job1' }
    });

    const res = await downloadHandler.handle(req, mockContext);
    assert.strictEqual(res.status, 400);
  });

  test('download should return 302 redirect for completed job', async () => {
    const completedMetadata = {
      ...mockMetadata,
      getJobState: async () => ({
        status: 'Completed',
        updatedAt: new Date(),
        outputUrl: 'https://storage.com/artifacts/job1.pdf'
      })
    } as unknown as MetadataService;

    const downloadHandler = new DownloadHandler(completedMetadata, mockStorage);
    const req = mockRequest({
      params: { jobId: 'job1' }
    });

    const res = await downloadHandler.handle(req, mockContext);
    assert.strictEqual(res.status, 302);
    // @ts-expect-error - headers is loosely typed in the mocked response
    assert.strictEqual(res.headers?.Location, 'http://sas-url');
  });
});
