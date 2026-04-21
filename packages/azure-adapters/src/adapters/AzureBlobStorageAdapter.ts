import {
  BlobServiceClient,
  ContainerClient,
  BlobSASPermissions,
  SASProtocol,
  generateBlobSASQueryParameters
} from '@azure/storage-blob';
import type { TokenCredential } from '@azure/core-auth';

import { StorageService } from '../core/interfaces.js';

export class AzureBlobStorageAdapter implements StorageService {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private containerName: string;
  // When true, the service client is backed by a TokenCredential and
  // generateReadSasUrl must use User Delegation SAS (account-key SAS is unavailable).
  private usingIdentity: boolean;

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'md': return 'text/markdown';
      case 'pdf': return 'application/pdf';
      case 'png': return 'image/png';
      default: return 'application/octet-stream';
    }
  }

  private constructor(blobServiceClient: BlobServiceClient, containerName: string, usingIdentity: boolean) {
    this.blobServiceClient = blobServiceClient;
    this.containerName = containerName;
    this.containerClient = blobServiceClient.getContainerClient(containerName);
    this.usingIdentity = usingIdentity;
  }

  static fromConnectionString(connectionString: string, containerName: string): AzureBlobStorageAdapter {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    return new AzureBlobStorageAdapter(blobServiceClient, containerName, false);
  }

  static fromCredential(accountUrl: string, credential: TokenCredential, containerName: string): AzureBlobStorageAdapter {
    const blobServiceClient = new BlobServiceClient(accountUrl, credential);
    return new AzureBlobStorageAdapter(blobServiceClient, containerName, true);
  }

  async generateReadSasUrl(filename: string, expiryMinutes: number): Promise<string> {
    const blobClient = this.containerClient.getBlobClient(filename);
    const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

    if (!this.usingIdentity) {
      return blobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn
      });
    }

    const startsOn = new Date();
    const userDelegationKey = await this.blobServiceClient.getUserDelegationKey(startsOn, expiresOn);

    const sasToken = generateBlobSASQueryParameters({
      containerName: this.containerName,
      blobName: filename,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https
    }, userDelegationKey, this.blobServiceClient.accountName).toString();

    return `${blobClient.url}?${sasToken}`;
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
