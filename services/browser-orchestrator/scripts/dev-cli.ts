import { CaptureJob, CaptureType, JobStatus, JobState } from '@capture-automation-platform/shared-types';

import { BlobServiceClient } from '@azure/storage-blob';
import { QueueClient } from '@azure/storage-queue';
import { TableClient } from '@azure/data-tables';
import { setTimeout } from 'timers/promises';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';

  const BLOB_CONTAINER_NAME = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'captures';
  const QUEUE_NAME = process.env.AZURE_STORAGE_QUEUE_NAME || 'jobs';
  const TABLE_NAME = process.env.AZURE_STORAGE_TABLE_NAME || 'metadata';
  const OUTPUT_DIR = './scripts/output';

  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: npx tsx scripts/dev-cli.ts <url> [type] [--raw]');
    process.exit(1);
  }

  const url = args[0];
  const type = (args.find(a => ['pdf', 'png', 'md'].includes(a)) as CaptureType) || 'pdf';
  const isRaw = args.includes('--raw');
  const jobId = `job-${Date.now()}`;

  console.log(`\n🚀 Initialising capture for: ${url}`);
  console.log(`   Job ID: ${jobId}`);
  console.log(`   Type:   ${type} ${isRaw ? '(Raw)' : ''}`);

  // 1. Initialise Clients
  const blobContainerClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING).getContainerClient(BLOB_CONTAINER_NAME);
  const queueClient = new QueueClient(CONNECTION_STRING, QUEUE_NAME);
  const tableClient = TableClient.fromConnectionString(CONNECTION_STRING, TABLE_NAME);

  // 2. Ensure resources exist (Shared with worker setup)
  if (CONNECTION_STRING.includes('UseDevelopmentStorage=true')) {
    const { setup } = await import('./setup-azurite.js');

    await setup();
  } else {
    // Production/Azure: Require resources to pre-exist for safety
    console.log('🌐 Using Azure Storage (Cloud)...');
  }

  // 3. Create Table Record and Push to Queue
  console.log('📝 Creating table record and 📨 Pushing to queue...');

  const job: CaptureJob = {
    id: jobId,
    options: { width: 1280, height: 800, raw: isRaw },
    retryCount: 0,
    type,
    url
  };

  await Promise.all([
    queueClient.sendMessage(JSON.stringify(job)),
    tableClient.createEntity({
      partitionKey: 'Jobs',
      rowKey: jobId,
      status: 'Queued' as JobStatus,
      type,
      updatedAt: new Date(),
      url
    })
  ]);

  // 5. Polling for Completion
  console.log('⏳ Waiting for worker...');

  let entity: JobState | undefined;
  let status: JobStatus = 'Queued';

  while (status !== 'Completed' && status !== 'Failed') {
    await setTimeout(2000);

    entity = (await tableClient.getEntity('Jobs', jobId)) as unknown as JobState;
    status = entity.status;
    process.stdout.write(`\r   Status: ${status}   `);
  }

  console.log('\n');

  if (status === 'Failed') {
    console.error(`❌ Job failed: ${entity?.error || 'Unknown error'}`);
    process.exit(1);
  }

  // 5. Download Result
  console.log('✅ Job completed! Downloading result...');

  const filename = `${jobId}.${type}`;
  const blobClient = blobContainerClient.getBlobClient(filename);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const downloadPath = path.join(OUTPUT_DIR, filename);

  await blobClient.downloadToFile(downloadPath);
  console.log(`📂 Saved to: ${downloadPath}`);
}

main().catch(err => {
  console.error('💥 CLI Error:', err.message);
  process.exit(1);
});
