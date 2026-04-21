import { JobStatus, JobState } from '@capture-automation-platform/shared-types';
import { RestError, TableClient } from '@azure/data-tables';
import type { TokenCredential } from '@azure/core-auth';

import { MetadataService } from '../core/interfaces.js';

export class AzureTableMetadataAdapter implements MetadataService {
  private tableClient: TableClient;

  private constructor(tableClient: TableClient) {
    this.tableClient = tableClient;
  }

  static fromConnectionString(connectionString: string, tableName: string): AzureTableMetadataAdapter {
    return new AzureTableMetadataAdapter(TableClient.fromConnectionString(connectionString, tableName));
  }

  static fromCredential(accountUrl: string, credential: TokenCredential, tableName: string): AzureTableMetadataAdapter {
    return new AzureTableMetadataAdapter(new TableClient(accountUrl, tableName, credential));
  }

  async getJobState(jobId: string): Promise<JobState | undefined> {
    try {
      const entity = await this.tableClient.getEntity<{
        status: JobStatus;
        outputUrl?: string;
        error?: string;
        updatedAt: string;
      }>('Jobs', jobId);

      return {
        error: entity.error,
        outputUrl: entity.outputUrl,
        status: entity.status,
        updatedAt: new Date(entity.updatedAt)
      };
    } catch (error: unknown) {
      if (error instanceof RestError && error.statusCode === 404) return;

      throw error;
    }
  }

  async updateStatus(jobId: string, status: JobStatus, outputUrl?: string, error?: string): Promise<void> {
    const entity = {
      error,
      outputUrl,
      partitionKey: 'Jobs',
      rowKey: jobId,
      status,
      updatedAt: new Date()
    };

    await this.tableClient.upsertEntity(entity, 'Merge');
  }
}
