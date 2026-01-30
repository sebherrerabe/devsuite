/**
 * Company and Repository types and Zod schemas
 *
 * Company is the root tenant boundary in DevSuite.
 * Repository belongs to exactly one Company (company scoping invariant).
 */

import { z } from 'zod';
import {
  companyIdSchema,
  repositoryIdSchema,
  softDeletableSchema,
  timestampedSchema,
} from './base';

// ============================================================================
// Repository Provider Enum
// ============================================================================

/**
 * Supported repository providers (external reference only)
 */
export const repositoryProviderValues = [
  'github',
  'gitlab',
  'bitbucket',
  'azure_devops',
  'other',
] as const;

export type RepositoryProvider = (typeof repositoryProviderValues)[number];

export const repositoryProviderSchema = z.enum(repositoryProviderValues);

// ============================================================================
// Company Entity
// ============================================================================

/**
 * Company entity Zod schema (schema-first approach)
 *
 * Company is the root boundary for all tenant-scoped data in DevSuite.
 */
export const companySchema = z
  .object({
    id: companyIdSchema,
    name: z.string().min(1).max(255),
    /**
     * Flexible metadata for client-specific info (e.g., billing ID, notes)
     */
    metadata: z.record(z.unknown()).optional(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

/**
 * Company entity type (inferred from schema)
 */
export type Company = z.infer<typeof companySchema>;

// ============================================================================
// Company Input Schemas
// ============================================================================

/**
 * Schema for creating a new Company
 *
 * - id, timestamps, and deletedAt are generated server-side
 */
export const createCompanyInputSchema = z.object({
  name: z.string().min(1).max(255),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanyInputSchema>;

/**
 * Schema for updating an existing Company
 *
 * - All fields optional (partial update)
 * - id and timestamps cannot be updated directly
 */
export const updateCompanyInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanyInputSchema>;

// ============================================================================
// Repository Entity
// ============================================================================

/**
 * Repository entity Zod schema (schema-first approach)
 *
 * Repository belongs to exactly one Company (company scoping invariant).
 * Stores reference to external repository provider, not mirrored data.
 */
export const repositorySchema = z
  .object({
    id: repositoryIdSchema,
    /**
     * Company this repository belongs to (tenant isolation)
     */
    companyId: companyIdSchema,
    name: z.string().min(1).max(255),
    /**
     * URL to the repository (e.g., https://github.com/org/repo)
     */
    url: z.string().url(),
    /**
     * External provider type (github, gitlab, etc.)
     */
    provider: repositoryProviderSchema,
    /**
     * Flexible metadata (e.g., default branch, visibility, external ID)
     */
    metadata: z.record(z.unknown()).optional(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

/**
 * Repository entity type (inferred from schema)
 */
export type Repository = z.infer<typeof repositorySchema>;

// ============================================================================
// Repository Input Schemas
// ============================================================================

/**
 * Schema for creating a new Repository
 *
 * - id, timestamps, and deletedAt are generated server-side
 * - companyId is required (company scoping invariant)
 */
export const createRepositoryInputSchema = z.object({
  companyId: companyIdSchema,
  name: z.string().min(1).max(255),
  url: z.string().url(),
  provider: repositoryProviderSchema,
  metadata: z.record(z.unknown()).optional(),
});

export type CreateRepositoryInput = z.infer<typeof createRepositoryInputSchema>;

/**
 * Schema for updating an existing Repository
 *
 * - All fields optional (partial update)
 * - id, companyId, and timestamps cannot be updated directly
 * - companyId is immutable to maintain tenant isolation
 */
export const updateRepositoryInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  provider: repositoryProviderSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateRepositoryInput = z.infer<typeof updateRepositoryInputSchema>;
