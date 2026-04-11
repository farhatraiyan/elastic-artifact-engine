import assert from 'node:assert';
import { test, describe, before, after } from 'node:test';

import { CaptureJob } from '@render-engine/shared-types';

import { PlaywrightAdapter } from '../src/adapters/PlaywrightAdapter.js';

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

  test('should capture a PNG from a data URL', async () => {
    const job: CaptureJob = {
      id: 'test-png',
      url: 'data:text/html,<h1>Test PNG</h1>',
      type: 'png',
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
      type: 'png',
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

  test('should capture Markdown from a data URL', async () => {
    const job: CaptureJob = {
      id: 'test-md',
      url: 'data:text/html,<h1>Test Markdown</h1><p>This is a paragraph.</p>',
      type: 'md',
      options: { width: 1280, height: 800, raw: true },
      retryCount: 0
    };

    const buffer = await adapter.capture(job);
    assert.ok(buffer.length > 0);
    const content = buffer.toString('utf8');
    assert.ok(content.includes('# Test Markdown'));
    assert.ok(content.includes('This is a paragraph.'));
  });

  test('should capture Reader Markdown by default', async () => {
    const job: CaptureJob = {
      id: 'test-reader-md',
      url: 'data:text/html,<html><body><nav>Menu</nav><main><h1>Article Title</h1><p>Main content.</p></main><footer>Footer</footer></body></html>',
      type: 'md',
      options: { width: 1280, height: 800 },
      retryCount: 0
    };

    const buffer = await adapter.capture(job);
    assert.ok(buffer.length > 0);
    const content = buffer.toString('utf8');
    assert.ok(content.includes('# Article Title'));
    assert.ok(content.includes('Main content.'));
    assert.strictEqual(content.includes('Menu'), false);
    assert.strictEqual(content.includes('Footer'), false);
  });
});
