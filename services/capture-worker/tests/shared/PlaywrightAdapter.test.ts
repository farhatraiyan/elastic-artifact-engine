import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { PlaywrightAdapter } from '../../src/adapters/PlaywrightAdapter.js';
import { CaptureJob } from '@render-engine/shared-types';

describe('PlaywrightAdapter', () => {
  let adapter: PlaywrightAdapter;

  before(async () => {
    adapter = new PlaywrightAdapter();
    await adapter.init();
  });

  after(async () => {
    await adapter.close();
  });

  test('should capture a PDF from a data URL', async () => {
    const job: CaptureJob = {
      id: 'test-pdf',
      url: 'data:text/html,<h1>Test PDF</h1>',
      type: 'pdf',
      options: { width: 1280, height: 800 },
      retryCount: 0
    };

    const buffer = await adapter.capture(job);
    assert.ok(buffer.length > 0);
    // PDF header check
    assert.strictEqual(buffer.subarray(0, 4).toString(), '%PDF');
  });

  test('should capture a Screenshot from a data URL', async () => {
    const job: CaptureJob = {
      id: 'test-screenshot',
      url: 'data:text/html,<h1>Test Screenshot</h1>',
      type: 'screenshot',
      options: { width: 1280, height: 800 },
      retryCount: 0
    };

    const buffer = await adapter.capture(job);
    assert.ok(buffer.length > 0);
    // PNG header check
    assert.strictEqual(buffer[0], 0x89);
    assert.strictEqual(buffer.subarray(1, 4).toString(), 'PNG');
  });

  test('should inject custom CSS and capture', async () => {
    const job: CaptureJob = {
      id: 'test-css',
      url: 'data:text/html,<h1 id="target">Check My Color</h1>',
      type: 'screenshot',
      options: {
        width: 1280,
        height: 800,
        injectCss: '#target { color: red; background: yellow; }'
      },
      retryCount: 0
    };

    const buffer = await adapter.capture(job);
    assert.ok(buffer.length > 0);
  });
});
