import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MetadataService, StorageService } from '@capture-automation-platform/azure-adapters';

export class DownloadHandler {
  private readonly metadata: MetadataService;
  private readonly storage: StorageService;

  constructor(metadata: MetadataService, storage: StorageService) {
    this.metadata = metadata;
    this.storage = storage;
  }

  public async handle(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const jobId = request.params.jobId;

    if (!jobId) {
      return { status: 400, jsonBody: { error: 'jobId is required' } };
    }

    try {
      const state = await this.metadata.getJobState(jobId);

      if (!state) {
        return { jsonBody: { error: 'Job not found' }, status: 404 };
      }

      if (state.status !== 'Completed' || !state.outputUrl) {
        return {
          jsonBody: {
            error: 'Job not completed',
            status: state.status
          },
          status: 400
        };
      }

      const filename = state.outputUrl.split('/').pop()?.split('?')[0];

      if (!filename) {
        return { jsonBody: { error: 'Invalid output URL' }, status: 500 };
      }

      const sasUrl = await this.storage.generateReadSasUrl(filename, 15);

      return {
        headers: {
          Location: sasUrl
        },
        status: 302
      };
    } catch (error: unknown) {
      context.error(`Error in download function for jobId ${jobId}:`, error);

      return {
        jsonBody: { error: 'Internal Server Error' },
        status: 500
      };
    }
  }
}
