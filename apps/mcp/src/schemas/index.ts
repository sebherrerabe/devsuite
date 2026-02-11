import { z } from 'zod';

export const authTokenSchema = z.string().min(1).describe('MCP auth token');
export const userIdSchema = z
  .string()
  .trim()
  .min(1)
  .describe('DevSuite user id tied to gh-service connection');

export const PrBundleInputSchema = z.object({
  authToken: authTokenSchema,
  userId: userIdSchema,
  prUrl: z.string().url().describe('GitHub PR URL'),
  outputRoot: z.string().optional().describe('Override output directory'),
  includeChecks: z
    .boolean()
    .default(false)
    .describe('Include CI check results'),
});

export const WriteReviewInputSchema = z.object({
  authToken: authTokenSchema,
  reviewPath: z.string().describe('Path to PR bundle directory'),
  content: z.string().describe('Markdown content for review.md'),
});

export const PrListInputSchema = z.object({
  authToken: authTokenSchema,
  userId: userIdSchema,
  repo: z.string().min(1).describe('GitHub repo in owner/name format'),
  state: z.enum(['open', 'closed', 'merged', 'all']).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
