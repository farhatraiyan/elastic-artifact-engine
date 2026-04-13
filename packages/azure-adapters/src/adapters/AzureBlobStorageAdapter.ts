import { BlobServiceClient, ContainerClient, BlobSASPermissions } from '@azure/storage-blob';

import { StorageService } from '../core/interfaces.js';

export class AzureBlobStorageAdapter implements StorageService {
  private containerClient: ContainerClient;

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'md': return 'text/markdown';
      case 'pdf': return 'application/pdf';
      case 'png': return 'image/png';
      default: return 'application/octet-stream';
    }
  }

  constructor(connectionString: string, containerName: string) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = blobServiceClient.getContainerClient(containerName);
  }

  async generateReadSasUrl(filename: string, expiryMinutes: number): Promise<string> {
    const blobClient = this.containerClient.getBlobClient(filename);

    const sasUrl = await blobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(new Date().valueOf() + expiryMinutes * 60 * 1000)
    });

    return sasUrl;
  }

  async save(filename: string, data: Buffer): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(filename);

    await blockBlobClient.uploadData(data, {
      blobHTTPHeaders: {
        blobContentType: this.getContentType(filename)
      }
    });

    return blockBlobClient.url;
  }
}
