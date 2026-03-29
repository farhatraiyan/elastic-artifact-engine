import { z } from 'zod';

export const CAPTURE_TYPES = ['pdf', 'screenshot'] as const;

export const CaptureJobSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  type: z.enum(CAPTURE_TYPES),
  options: z.object({
    width: z.number().int().positive().optional().default(1280),
    height: z.number().int().positive().optional().default(800),
    waitForTimeout: z.number().int().nonnegative().optional(),
    injectCss: z.string().optional(),
  }).optional(),
  retryCount: z.number().int().nonnegative().optional().default(0),
});

export type CaptureJob = z.infer<typeof CaptureJobSchema>;

export type CaptureType = (typeof CAPTURE_TYPES)[number];

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
