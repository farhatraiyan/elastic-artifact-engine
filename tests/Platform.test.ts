import assert from 'node:assert';
import { test, describe } from 'node:test';
import { setTimeout } from 'node:timers/promises';

describe('System Integration (E2E)', { timeout: 60000 }, () => {
  const API_URL = 'http://localhost:7071/api';

  test('End-to-End: Capture -> Process -> Status -> Download', async () => {
    console.log('Submitting capture request...');
    const captureRes = await fetch(`${API_URL}/capture`, {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://example.com',
        type: 'pdf'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    assert.strictEqual(captureRes.status, 202, 'Should return 202 Accepted');
    const body = await captureRes.json() as any;
    const jobId = body.jobId;
    assert.ok(jobId, 'Should return a jobId');

    console.log(`Polling status for job ${jobId}...`);
    let status = 'Queued';
    let downloadUrl = '';
    const maxAttempts = 30;
    
    for (let i = 0; i < maxAttempts; i++) {
      await setTimeout(2000);
      const statusRes = await fetch(`${API_URL}/status/${jobId}`);
      assert.strictEqual(statusRes.status, 200);
      
      const statusBody = await statusRes.json() as any;
      status = statusBody.status;
      console.log(`   Attempt ${i + 1}: ${status}`);
      
      if (status === 'Completed') {
        downloadUrl = statusBody.downloadUrl;
        break;
      }
      
      if (status === 'Failed') {
        throw new Error(`Job failed: ${statusBody.error}`);
      }
    }

    assert.strictEqual(status, 'Completed', 'Job should eventually complete');
    assert.ok(downloadUrl, 'Should provide a download URL');

    console.log('Verifying download redirect and file retrieval...');
    const downloadRedirectRes = await fetch(`${API_URL}/download/${jobId}`, {
      redirect: 'manual'
    });

    assert.strictEqual(downloadRedirectRes.status, 302, 'API should return a 302 Redirect');
    
    const location = downloadRedirectRes.headers.get('location');
    assert.ok(location, 'Should provide a location header to the SAS URL');

    const blobRes = await fetch(location);
    assert.strictEqual(blobRes.status, 200, 'SAS URL should be accessible');
    
    const blob = await blobRes.blob();
    assert.ok(blob.size > 0, 'Downloaded file should not be empty');
    assert.strictEqual(blob.type, 'application/pdf', 'Should be a PDF');
  });
});
