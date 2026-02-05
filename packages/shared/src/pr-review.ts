/**
 * PR Review types and Zod schemas
 *
 * PRReview stores durable artifacts from manual PR reviews.
 * Content is markdown captured by the user.
 * PRReview is company-scoped via companyId + repositoryId.
 */

import { z } from 'zod';
import {
  companyIdSchema,
  prReviewIdSchema,
  repositoryIdSchema,
  taskIdSchema,
  softDeletableSchema,
  timestampedSchema,
} from './base';

// ============================================================================
// PR Review Metadata
// ============================================================================

/**
 * Common risk area identifiers for PR reviews
 */
export const prReviewRiskAreaValues = [
  'security',
  'performance',
  'data_integrity',
  'breaking_change',
  'test_coverage',
  'code_complexity',
  'dependency',
  'configuration',
  'other',
] as const;

export type PRReviewRiskArea = (typeof prReviewRiskAreaValues)[number];

export const prReviewRiskAreaSchema = z.enum(prReviewRiskAreaValues);

/**
 * Red flag severity levels
 */
export const redFlagSeverityValues = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type RedFlagSeverity = (typeof redFlagSeverityValues)[number];

export const redFlagSeveritySchema = z.enum(redFlagSeverityValues);

/**
 * Individual red flag in a PR review
 */
export const prReviewRedFlagSchema = z.object({
  /**
   * Category of the red flag
   */
  area: prReviewRiskAreaSchema,
  /**
   * Severity level
   */
  severity: redFlagSeveritySchema,
  /**
   * Human-readable description of the issue
   */
  description: z.string().min(1),
  /**
   * File path where the issue was found (if applicable)
   */
  filePath: z.string().optional(),
  /**
   * Line number or range (if applicable)
   */
  lineReference: z.string().optional(),
});

export type PRReviewRedFlag = z.infer<typeof prReviewRedFlagSchema>;

/**
 * PR Review metadata schema (extensible)
 *
 * Contains structured data extracted during review analysis.
 * Uses z.passthrough() to allow additional fields for forward compatibility.
 */
export const prReviewMetadataSchema = z
  .object({
    /**
     * Risk areas identified in the PR
     */
    riskAreas: z.array(prReviewRiskAreaSchema).optional(),
    /**
     * Specific red flags with details
     */
    redFlags: z.array(prReviewRedFlagSchema).optional(),
    /**
     * Overall risk score (0-100, where higher = more risky)
     */
    riskScore: z.number().int().min(0).max(100).optional(),
    /**
     * Summary of positive aspects
     */
    highlights: z.array(z.string()).optional(),
    /**
     * Suggested improvements
     */
    suggestions: z.array(z.string()).optional(),
    /**
     * Files analyzed
     */
    filesAnalyzed: z.array(z.string()).optional(),
    /**
     * Number of lines added
     */
    linesAdded: z.number().int().nonnegative().optional(),
    /**
     * Number of lines removed
     */
    linesRemoved: z.number().int().nonnegative().optional(),
    /**
     * Agent or tool that generated this review
     */
    generatedBy: z.string().optional(),
    /**
     * Model used for generation (if AI-generated)
     */
    model: z.string().optional(),
  })
  .passthrough();

export type PRReviewMetadata = z.infer<typeof prReviewMetadataSchema>;

// ============================================================================
// PR Review Entity
// ============================================================================

/**
 * PR Review entity Zod schema (schema-first approach)
 *
 * PRReview is a durable artifact storing PR review notes.
 * Company scoped via companyId (direct reference for query efficiency).
 * Also references repositoryId for the specific repo context.
 */
export const prReviewSchema = z
  .object({
    id: prReviewIdSchema,
    /**
     * Company this review belongs to (tenant isolation)
     */
    companyId: companyIdSchema,
    /**
     * Repository this PR belongs to
     */
    repositoryId: repositoryIdSchema,
    /**
     * Optional task this review is associated with
     */
    taskId: taskIdSchema.nullable().optional(),
    /**
     * URL to the PR (e.g., https://github.com/org/repo/pull/123)
     */
    prUrl: z.string().min(1),
    /**
     * Base branch for the PR (target branch)
     */
    baseBranch: z.string().min(1),
    /**
     * Head branch for the PR (source branch)
     */
    headBranch: z.string().min(1),
    /**
     * Optional review title (for display/search)
     */
    title: z.string().max(500).optional(),
    /**
     * Review content (markdown)
     */
    contentMarkdown: z.string(),
    /**
     * Structured metadata from review analysis
     */
    metadata: prReviewMetadataSchema.optional(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

/**
 * PR Review entity type (inferred from schema)
 */
export type PRReview = z.infer<typeof prReviewSchema>;

// ============================================================================
// PR Review Input Schemas
// ============================================================================

/**
 * Schema for creating a new PR Review
 *
 * - id, timestamps, and deletedAt are generated server-side
 * - companyId and repositoryId are required (company scoping invariant)
 */
export const createPRReviewInputSchema = z.object({
  companyId: companyIdSchema,
  repositoryId: repositoryIdSchema,
  taskId: taskIdSchema.nullable().optional(),
  prUrl: z.string().min(1),
  baseBranch: z.string().min(1),
  headBranch: z.string().min(1),
  title: z.string().max(500).optional(),
  contentMarkdown: z.string().optional(),
  metadata: prReviewMetadataSchema.optional(),
});

export type CreatePRReviewInput = z.infer<typeof createPRReviewInputSchema>;

/**
 * Schema for updating an existing PR Review
 *
 * - All fields optional (partial update)
 * - id, companyId, repositoryId, and timestamps cannot be updated directly
 * - companyId and repositoryId are immutable to maintain data integrity
 */
export const updatePRReviewInputSchema = z.object({
  repositoryId: repositoryIdSchema.optional(),
  taskId: taskIdSchema.nullable().optional(),
  prUrl: z.string().min(1).optional(),
  baseBranch: z.string().min(1).optional(),
  headBranch: z.string().min(1).optional(),
  title: z.string().max(500).optional(),
  contentMarkdown: z.string().optional(),
  metadata: prReviewMetadataSchema.optional(),
});

export type UpdatePRReviewInput = z.infer<typeof updatePRReviewInputSchema>;
