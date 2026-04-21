import { CaptureJob, CaptureJobSchema } from '@capture-automation-platform/shared-types';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MetadataService, QueueService } from '@capture-automation-platform/azure-adapters';
import { randomUUID } from 'crypto';

export class CaptureHandler {
  private readonly metadata: MetadataService;
  private readonly queue: QueueService<CaptureJob>;

  constructor(metadata: MetadataService, queue: QueueService<CaptureJob>) {
    this.metadata = metadata;
    this.queue = queue;
  }

  public async handle(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url: "${request.url}"`);

    try {
      const body = await request.json() as Record<string, unknown>;

      const validationResult = CaptureJobSchema.safeParse({
        ...body,
        id: randomUUID()
      });

      if (!validationResult.success) {
        return {
          jsonBody: {
            details: validationResult.error.issues,
            error: 'Invalid request'
          },
          status: 400
        };
      }

      const job = validationResult.data;

      await this.metadata.updateStatus(job.id, 'Queued');
      await this.queue.push(job);

      return {
        jsonBody: {
          jobId: job.id,
          status: 'Queued'
        },
        status: 202
      };
    } catch (error: unknown) {
      context.error('Error in capture function:', error);

      return {
        jsonBody: { error: 'Internal Server Error' },
        status: 500
      };
    }
  }
}
