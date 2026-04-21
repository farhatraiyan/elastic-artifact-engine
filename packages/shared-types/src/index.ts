import { z } from 'zod';

export const RENDER_TYPES = ['md', 'pdf', 'png'] as const;

export const RenderJobSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  type: z.enum(RENDER_TYPES),
  options: z.object({
    width: z.number().int().positive().optional().default(1280),
    height: z.number().int().positive().optional().default(800),
    waitForTimeout: z.number().int().nonnegative().optional(),
    injectCss: z.string().optional(),
    raw: z.boolean().optional(),
  }).optional(),
  retryCount: z.number().int().nonnegative().optional().default(0),
});

export type RenderJob = z.infer<typeof RenderJobSchema>;

export type RenderType = (typeof RENDER_TYPES)[number];

export type JobState = {
  status: JobStatus;
  outputUrl?: string;
  error?: string;
  updatedAt: Date;
};

export type JobStatus = 'Queued' | 'Processing' | 'Completed' | 'Failed';

export type QueueMessage<T = unknown> = {
  id: string;
  body: T;
  popReceipt?: string;
};
