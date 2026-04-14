import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MetadataService, StorageService } from '@capture-automation-platform/azure-adapters';

export class StatusHandler {
  private readonly metadata: MetadataService;
  private readonly storage: StorageService;

  constructor(metadata: MetadataService, storage: StorageService) {
    this.metadata = metadata;
    this.storage = storage;
  }

  public async handle(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const jobId = request.params.jobId;

    if (!jobId) {
      return { jsonBody: { error: 'jobId is required' }, status: 400 };
    }

    try {
      const state = await this.metadata.getJobState(jobId);

      if (!state) {
        return { jsonBody: { error: 'Job not found' }, status: 404 };
      }

      const response: Record<string, unknown> = {
        jobId,
        status: state.status,
        updatedAt: state.updatedAt
      };

      if (state.status === 'Completed' && state.outputUrl) {
        // If it's a full URL, we extract the filename
        const filename = state.outputUrl.split('/').pop()?.split('?')[0];

        if (filename) {
          // Generate SAS token for direct download (15 mins)
          response.downloadUrl = await this.storage.generateReadSasUrl(filename, 15);
        }
      }

      if (state.error) {
        response.error = state.error;
      }

      return {
        jsonBody: response,
        status: 200
      };
    } catch (error: unknown) {
      context.error(`Error in status function for jobId ${jobId}:`, error);

      return {
        jsonBody: { error: 'Internal Server Error' },
        status: 500
      };
    }
  }
}
