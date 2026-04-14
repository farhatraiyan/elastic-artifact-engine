import { BlobServiceClient } from '@azure/storage-blob';
import { QueueClient } from '@azure/storage-queue';
import { TableClient } from '@azure/data-tables';
import { fileURLToPath } from 'url';
export async function setup() {
    const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
    const BLOB_CONTAINER_NAME = process.env.AZURE_STORAGE_BLOB_CONTAINER_NAME || 'captures';
    const QUEUE_NAME = process.env.AZURE_STORAGE_QUEUE_NAME || 'jobs';
    const TABLE_NAME = process.env.AZURE_STORAGE_TABLE_NAME || 'metadata';
    console.log('🛠️  Setting up storage resources...');
    const setupBlob = async () => {
        try {
            const blobService = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
            await blobService.getContainerClient(BLOB_CONTAINER_NAME).createIfNotExists();
            console.log(`✅  Blob container "${BLOB_CONTAINER_NAME}" is ready.`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`❌  Failed to create blob container:`, msg);
            throw err;
        }
    };
    const setupQueue = async () => {
        try {
            const queueClient = new QueueClient(CONNECTION_STRING, QUEUE_NAME);
            await queueClient.createIfNotExists();
            console.log(`✅  Queue "${QUEUE_NAME}" is ready.`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`❌  Failed to create queue:`, msg);
            throw err;
        }
    };
    const setupTable = async () => {
        try {
            const tableClient = TableClient.fromConnectionString(CONNECTION_STRING, TABLE_NAME);
            await tableClient.createTable();
            console.log(`✅  Table "${TABLE_NAME}" is ready.`);
        }
        catch (err) {
            if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 409) {
                console.log(`✅  Table "${TABLE_NAME}" already exists.`);
            }
            else {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`❌  Failed to create table:`, msg);
                throw err;
            }
        }
    };
    await Promise.all([setupBlob(), setupQueue(), setupTable()]);
}
// Run immediately if this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    setup().catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('💥 Setup failed:', msg);
        process.exit(1);
    });
}
//# sourceMappingURL=setup-azurite.js.map