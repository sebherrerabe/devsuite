/**
 * Foundation helper functions for DevSuite Convex functions
 *
 * These helpers enforce DevSuite invariants:
 * - Company scoping enforcement
 * - Soft delete patterns
 * - Assertion helpers for common validation
 * - Pagination patterns for realtime subscriptions
 * - Type alignment between Convex IDs and shared branded IDs
 */

import type { Id, TableNames } from '../_generated/dataModel';
import type { PaginationOptions } from 'convex/server';
import type {
  CompanyId,
  RepositoryId,
  ProjectId,
  TaskId,
  SessionId,
  PRReviewId,
  RateCardId,
  InvoiceId,
  PerformanceSignalId,
} from '@devsuite/shared';

// ============================================================================
// Company Scoping Helpers
// ============================================================================

/**
 * Require a companyId parameter for company-scoped operations.
 *
 * This helper enforces that companyId is explicitly provided as a parameter.
 * We do NOT assume auth provides company context yet (that will come later).
 *
 * @param companyId - The company ID from function args
 * @returns The company ID, or throws if null/undefined
 */
export function requireCompanyId(
  companyId: Id<'companies'> | null | undefined
): Id<'companies'> {
  if (!companyId) {
    throw new Error('Operation requires companyId parameter');
  }
  return companyId;
}

/**
 * Assert that a record belongs to the specified company.
 *
 * @param record - The record to check
 * @param companyId - The expected company ID
 * @param tableName - Name of the table (for error messages)
 * @throws Error if companyId doesn't match
 */
export function assertCompanyMatch<T extends { companyId: Id<'companies'> }>(
  record: T | null,
  companyId: Id<'companies'>,
  tableName: string
): asserts record is T {
  if (!record) {
    throw new Error(`${tableName} not found`);
  }
  if (record.companyId !== companyId) {
    throw new Error(`${tableName} does not belong to company`);
  }
}

// ============================================================================
// Soft Delete Helpers
// ============================================================================

/**
 * Check if a record is deleted (has deletedAt timestamp).
 *
 * @param record - Record with optional deletedAt field
 * @returns true if deleted, false if active
 */
export function isDeleted<T extends { deletedAt: number | null | undefined }>(
  record: T
): boolean {
  return record.deletedAt !== null && record.deletedAt !== undefined;
}

/**
 * Assert that a record is not deleted.
 *
 * @param record - The record to check
 * @param tableName - Name of the table (for error messages)
 * @throws Error if record is deleted
 */
export function assertNotDeleted<
  T extends { deletedAt: number | null | undefined },
>(record: T | null, tableName: string): asserts record is T {
  if (!record) {
    throw new Error(`${tableName} not found`);
  }
  if (isDeleted(record)) {
    throw new Error(`${tableName} is deleted`);
  }
}

/**
 * Create a patch object for soft delete.
 *
 * @param timestamp - Optional timestamp (defaults to Date.now())
 * @returns Patch object with deletedAt and updatedAt
 */
export function createSoftDeletePatch(timestamp?: number) {
  const now = timestamp ?? Date.now();
  return {
    deletedAt: now,
    updatedAt: now,
  };
}

/**
 * Create a patch object for restoring a soft-deleted record.
 *
 * @param timestamp - Optional timestamp (defaults to Date.now())
 * @returns Patch object with deletedAt set to null and updatedAt
 */
export function createRestorePatch(timestamp?: number) {
  const now = timestamp ?? Date.now();
  return {
    deletedAt: null,
    updatedAt: now,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a record exists.
 *
 * @param record - The record to check
 * @param tableName - Name of the table (for error messages)
 * @throws Error if record is null/undefined
 */
export function assertFound<T>(
  record: T | null | undefined,
  tableName: string
): asserts record is T {
  if (!record) {
    throw new Error(`${tableName} not found`);
  }
}

/**
 * Assert that a record exists, is not deleted, and belongs to the company.
 *
 * This is a convenience helper that combines multiple assertions.
 *
 * @param record - The record to check
 * @param companyId - The expected company ID
 * @param tableName - Name of the table (for error messages)
 * @throws Error if any assertion fails
 */
export function assertCompanyScoped<
  T extends {
    companyId: Id<'companies'>;
    deletedAt: number | null | undefined;
  },
>(
  record: T | null | undefined,
  companyId: Id<'companies'>,
  tableName: string
): asserts record is T {
  assertFound(record, tableName);
  assertCompanyMatch(record, companyId, tableName);
  assertNotDeleted(record, tableName);
}

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Pagination request parameters
 */
export type PaginationParams = {
  /**
   * Number of items per page
   * @default 20
   */
  limit?: number;
  /**
   * Pagination cursor (opaque string for cursor-based pagination)
   * If not provided, starts from the beginning
   */
  cursor?: string;
};

/**
 * Paginated response with cursor-based pagination
 */
export type PaginatedResponse<T> = {
  items: T[];
  /**
   * Cursor for the next page. If undefined, there are no more items.
   */
  nextCursor: string | undefined;
  /**
   * Whether there are more items available
   */
  hasMore: boolean;
};

/**
 * Default limit for pagination
 */
const DEFAULT_PAGINATION_LIMIT = 20;

/**
 * Maximum limit for pagination
 */
const MAX_PAGINATION_LIMIT = 100;

/**
 * Normalize pagination parameters.
 *
 * @param params - Raw pagination params
 * @returns Normalized params with defaults applied
 */
export function normalizePaginationParams(params: PaginationParams): {
  limit: number;
  cursor: string | undefined;
} {
  const limit = Math.min(
    params.limit ?? DEFAULT_PAGINATION_LIMIT,
    MAX_PAGINATION_LIMIT
  );
  return {
    limit,
    cursor: params.cursor,
  };
}

/**
 * Create a pagination cursor from a record ID.
 *
 * For simple cases, we can use the record ID as the cursor.
 * For more complex cases (e.g., sorting by multiple fields), you may need
 * a more sophisticated cursor encoding.
 *
 * @param id - Record ID to use as cursor
 * @returns Cursor string
 */
export function createCursor<TableName extends TableNames>(
  id: Id<TableName>
): string {
  return id as string;
}

/**
 * Parse a cursor string back to a record ID.
 *
 * @param cursor - Cursor string
 * @returns Record ID
 */
export function parseCursor<TableName extends TableNames>(
  cursor: string
): Id<TableName> {
  return cursor as Id<TableName>;
}

/**
 * Convert DevSuite pagination params to Convex PaginationOptions.
 *
 * Note: For function args, use `paginationOptsValidator` directly:
 * ```typescript
 * import { paginationOptsValidator } from 'convex/server';
 * export const list = query({
 *   args: { paginationOpts: paginationOptsValidator },
 *   handler: async (ctx, args) => {
 *     return await ctx.db.query('table').paginate(args.paginationOpts);
 *   },
 * });
 * ```
 *
 * This helper is for cases where you need to convert from DevSuite's
 * `PaginationParams` format to `PaginationOptions`.
 *
 * @param params - DevSuite pagination params
 * @returns Convex PaginationOptions
 */
export function toPaginationOptions(
  params: PaginationParams
): PaginationOptions {
  const normalized = normalizePaginationParams(params);
  return {
    numItems: normalized.limit,
    cursor: normalized.cursor ?? null,
  };
}

/**
 * Convert Convex pagination result to DevSuite PaginatedResponse format.
 *
 * This helper standardizes the response shape to match `@devsuite/shared` types.
 *
 * @param result - Result from Convex `.paginate()` call
 * @returns Standardized paginated response
 */
export function toPaginatedResponse<T>(result: {
  page: T[];
  isDone: boolean;
  continueCursor: string | null;
}): PaginatedResponse<T> {
  return {
    items: result.page,
    nextCursor: result.continueCursor ?? undefined,
    hasMore: !result.isDone,
  };
}

/**
 * Helper to create a query that filters out deleted records.
 *
 * This is a convenience wrapper for the common pattern of filtering
 * by `deletedAt === null` in paginated queries.
 *
 * @example
 * ```typescript
 * const query = ctx.db.query('repositories')
 *   .withIndex('by_companyId', q => q.eq('companyId', companyId));
 * const paginated = await filterNotDeleted(query)
 *   .paginate(validatePaginationOpts(args));
 * ```
 */
type FilterPredicateBuilder = {
  field: (fieldName: 'deletedAt') => unknown;
  eq: (left: unknown, right: null) => unknown;
};

export function filterNotDeleted<
  Q extends {
    filter: (predicate: (q: FilterPredicateBuilder) => unknown) => unknown;
  },
>(query: Q): ReturnType<Q['filter']> {
  return query.filter(q => q.eq(q.field('deletedAt'), null)) as ReturnType<
    Q['filter']
  >;
}

/**
 * Paginate a company-scoped query using the `by_companyId_deletedAt` index.
 *
 * This is the standard pattern for paginating company-scoped entities
 * while excluding deleted records. Uses Convex's built-in pagination.
 *
 * @param ctx - Query context
 * @param tableName - Name of the table to query
 * @param companyId - Company ID to filter by
 * @param paginationOpts - Pagination options (validated)
 * @returns Paginated response with items, nextCursor, and hasMore
 *
 * @example
 * ```typescript
 * import { paginationOptsValidator } from 'convex/server';
 * export const list = query({
 *   args: {
 *     companyId: v.id('companies'),
 *     paginationOpts: paginationOptsValidator,
 *   },
 *   handler: async (ctx, args) => {
 *     const companyId = requireCompanyId(args.companyId);
 *     return await paginateByCompanyIdDeletedAt(
 *       ctx,
 *       'repositories',
 *       companyId,
 *       args.paginationOpts
 *     );
 *   },
 * });
 * ```
 */
type IndexEqBuilder = {
  eq: (fieldName: string, value: unknown) => IndexEqBuilder;
};
type PaginateResult<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string | null;
};
type ByCompanyIdDeletedAtQueryable<T> = {
  withIndex: (
    indexName: 'by_companyId_deletedAt',
    fn: (q: IndexEqBuilder) => unknown
  ) => { paginate: (opts: PaginationOptions) => Promise<PaginateResult<T>> };
};

export async function paginateByCompanyIdDeletedAt<
  T extends {
    _id: Id<TableNames>;
    companyId: Id<'companies'>;
    deletedAt: number | null;
  },
>(
  ctx: { db: { query: (table: string) => ByCompanyIdDeletedAtQueryable<T> } },
  tableName: string,
  companyId: Id<'companies'>,
  paginationOpts: PaginationOptions
): Promise<PaginatedResponse<T>> {
  const query = ctx.db
    .query(tableName)
    .withIndex('by_companyId_deletedAt', q =>
      q.eq('companyId', companyId).eq('deletedAt', null)
    );

  const result = await query.paginate(paginationOpts);
  return toPaginatedResponse(result);
}

// ============================================================================
// Type Alignment Helpers (Convex ID <-> Shared Branded ID)
// ============================================================================

/**
 * Convert Convex ID to shared branded ID type.
 *
 * Convex uses `Id<'tableName'>` types, while `@devsuite/shared` uses
 * branded string types (e.g., `CompanyId`, `RepositoryId`).
 *
 * At runtime, both are strings, so this is a type-only conversion.
 * Use this when returning Convex documents to code expecting shared types.
 *
 * @param id - Convex ID
 * @returns Branded ID compatible with shared types
 *
 * @example
 * ```typescript
 * const company: CompanyDoc = await ctx.db.get(companyId);
 * return {
 *   id: toSharedId(company._id), // Converts Id<'companies'> to CompanyId
 *   name: company.name,
 *   // ...
 * };
 * ```
 */
export function toSharedId<T extends Id<TableNames>>(
  id: T
): T extends Id<'companies'>
  ? CompanyId
  : T extends Id<'repositories'>
    ? RepositoryId
    : T extends Id<'projects'>
      ? ProjectId
      : T extends Id<'tasks'>
        ? TaskId
        : T extends Id<'sessions'>
          ? SessionId
          : T extends Id<'prReviews'>
            ? PRReviewId
            : T extends Id<'rateCards'>
              ? RateCardId
              : T extends Id<'invoices'>
                ? InvoiceId
                : T extends Id<'performanceSignals'>
                  ? PerformanceSignalId
                  : string {
  return id as unknown as T extends Id<'companies'>
    ? CompanyId
    : T extends Id<'repositories'>
      ? RepositoryId
      : T extends Id<'projects'>
        ? ProjectId
        : T extends Id<'tasks'>
          ? TaskId
          : T extends Id<'sessions'>
            ? SessionId
            : T extends Id<'prReviews'>
              ? PRReviewId
              : T extends Id<'rateCards'>
                ? RateCardId
                : T extends Id<'invoices'>
                  ? InvoiceId
                  : T extends Id<'performanceSignals'>
                    ? PerformanceSignalId
                    : string;
}

/**
 * Convert shared branded ID to Convex ID type.
 *
 * Use this when accepting shared branded IDs as function arguments
 * and need to use them with Convex database operations.
 *
 * @param id - Branded ID from shared types
 * @returns Convex ID (type assertion)
 *
 * @example
 * ```typescript
 * export const get = query({
 *   args: { id: v.string() }, // Accept string, validate as shared type
 *   handler: async (ctx, args) => {
 *     const convexId = fromSharedId<Id<'companies'>>(args.id);
 *     return await ctx.db.get(convexId);
 *   },
 * });
 * ```
 */
export function fromSharedId<TId extends Id<TableNames>>(id: string): TId {
  return id as TId;
}

/**
 * Convert a Convex document to a shape compatible with shared types.
 *
 * This helper:
 * - Converts `_id` to `id` (shared types use `id`, not `_id`)
 * - Converts Convex IDs to branded IDs
 * - Preserves all other fields as-is
 *
 * Use this when returning Convex documents from queries/mutations
 * that will be consumed by code expecting shared type shapes.
 *
 * @param doc - Convex document with `_id` field
 * @returns Object with `id` field compatible with shared types
 *
 * @example
 * ```typescript
 * export const get = query({
 *   args: { id: v.id('companies') },
 *   handler: async (ctx, args) => {
 *     const company = await ctx.db.get(args.id);
 *     if (!company) throw new Error('Not found');
 *     return toSharedShape(company); // { id: CompanyId, name: string, ... }
 *   },
 * });
 * ```
 */
export function toSharedShape<
  T extends { _id: Id<TableNames> } & Record<string, unknown>,
>(doc: T): Omit<T, '_id'> & { id: ReturnType<typeof toSharedId<T['_id']>> } {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: toSharedId(_id),
  } as unknown as Omit<T, '_id'> & {
    id: ReturnType<typeof toSharedId<T['_id']>>;
  };
}
