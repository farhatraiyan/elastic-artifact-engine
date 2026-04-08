import { TableClient } from '@azure/data-tables';
import { MetadataService } from '../core/interfaces.js';
import { JobStatus } from '@render-engine/shared-types';

export class AzureTableMetadataAdapter implements MetadataService {
  private tableClient: TableClient;

  constructor(connectionString: string, tableName: string) {
    this.tableClient = TableClient.fromConnectionString(connectionString, tableName);
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
