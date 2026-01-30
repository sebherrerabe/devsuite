/**
 * Performance signals and invoicing types for DevSuite
 *
 * Performance signals are raw data points (not judgements).
 * Invoicing is derivative - based on sessions and rate cards.
 */

import { z } from 'zod';
import {
  type CompanyId,
  type SessionId,
  type TaskId,
  type ProjectId,
  type Timestamp,
  type SoftDeletable,
  companyIdSchema,
  sessionIdSchema,
  timestampSchema,
  softDeletableSchema,
  idSchema,
} from './base';

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Branded string type for PerformanceSignal IDs
 */
export type PerformanceSignalId = string & { __brand: 'PerformanceSignalId' };

/**
 * Branded string type for Invoice IDs
 */
export type InvoiceId = string & { __brand: 'InvoiceId' };

/**
 * Branded string type for RateCard IDs
 */
export type RateCardId = string & { __brand: 'RateCardId' };

// ============================================================================
// ID Schemas
// ============================================================================

/**
 * Zod schema for PerformanceSignalId
 */
export const performanceSignalIdSchema = idSchema.transform(
  val => val as PerformanceSignalId
);

/**
 * Zod schema for InvoiceId
 */
export const invoiceIdSchema = idSchema.transform(val => val as InvoiceId);

/**
 * Zod schema for RateCardId
 */
export const rateCardIdSchema = idSchema.transform(val => val as RateCardId);

// ============================================================================
// Performance Signal Types
// ============================================================================

/**
 * Types of performance signals that can be recorded.
 * These are raw metrics, not judgements or evaluations.
 */
export const performanceSignalTypeValues = [
  'time_per_task',
  'context_switches',
  'session_duration',
  'tasks_completed',
  'focus_time',
  'break_time',
  'code_changes',
  'pr_reviews_completed',
] as const;

export type PerformanceSignalType =
  (typeof performanceSignalTypeValues)[number];

/**
 * Zod schema for PerformanceSignalType
 */
export const performanceSignalTypeSchema = z.enum(performanceSignalTypeValues);

// ============================================================================
// Performance Signal Entity
// ============================================================================

/**
 * A performance signal representing a raw metric data point.
 * Signals are immutable-ish: createdAt is required, updatedAt is optional,
 * deletedAt follows soft-delete pattern.
 *
 * The entityId and entityType allow signals to be associated with
 * different entity types (task, session, project, etc.).
 */
export type PerformanceSignal = {
  /** Unique identifier */
  id: PerformanceSignalId;
  /** Company this signal belongs to (tenant isolation) */
  companyId: CompanyId;
  /** Type of signal */
  type: PerformanceSignalType;
  /** Numeric value of the signal (interpretation depends on type) */
  value: number;
  /** Type of entity this signal relates to */
  entityType: 'task' | 'session' | 'project';
  /** ID of the related entity */
  entityId: TaskId | SessionId | ProjectId;
  /** When this measurement was taken (Unix ms) */
  timestamp: Timestamp;
  /** When the signal was created (Unix ms) */
  createdAt: Timestamp;
  /** When the signal was last updated (Unix ms). Optional for immutable signals. */
  updatedAt?: Timestamp;
} & SoftDeletable;

/**
 * Zod schema for PerformanceSignal entity
 */
export const performanceSignalSchema = z
  .object({
    id: performanceSignalIdSchema,
    companyId: companyIdSchema,
    type: performanceSignalTypeSchema,
    value: z.number(),
    entityType: z.enum(['task', 'session', 'project']),
    entityId: idSchema, // Generic ID since it can be TaskId | SessionId | ProjectId
    timestamp: timestampSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
  })
  .merge(softDeletableSchema);

// ============================================================================
// Performance Signal Input Types
// ============================================================================

/**
 * Input for creating a new performance signal
 */
export type CreatePerformanceSignalInput = {
  /** Company this signal belongs to */
  companyId: CompanyId;
  /** Type of signal */
  type: PerformanceSignalType;
  /** Numeric value */
  value: number;
  /** Type of entity this signal relates to */
  entityType: 'task' | 'session' | 'project';
  /** ID of the related entity */
  entityId: TaskId | SessionId | ProjectId;
  /** When this measurement was taken */
  timestamp: Timestamp;
};

/**
 * Zod schema for creating a performance signal
 */
export const createPerformanceSignalInputSchema = z.object({
  companyId: companyIdSchema,
  type: performanceSignalTypeSchema,
  value: z.number(),
  entityType: z.enum(['task', 'session', 'project']),
  entityId: idSchema,
  timestamp: timestampSchema,
});

// ============================================================================
// Rate Card Entity
// ============================================================================

/**
 * A rate card defining billing configuration for a company.
 * Rate cards determine how sessions are billed.
 */
export type RateCard = {
  /** Unique identifier */
  id: RateCardId;
  /** Company this rate card belongs to (tenant isolation) */
  companyId: CompanyId;
  /** Human-readable name for this rate card */
  name: string;
  /** Hourly rate in cents (to avoid floating point issues) */
  hourlyRateCents: number;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Optional description */
  description: string | null;
  /** Whether this is the default rate card for the company */
  isDefault: boolean;
  /** When the rate card was created (Unix ms) */
  createdAt: Timestamp;
  /** When the rate card was last updated (Unix ms) */
  updatedAt: Timestamp;
} & SoftDeletable;

/**
 * Zod schema for RateCard entity
 */
export const rateCardSchema = z
  .object({
    id: rateCardIdSchema,
    companyId: companyIdSchema,
    name: z.string().min(1).max(200),
    hourlyRateCents: z.number().int().nonnegative(),
    currency: z.string().length(3), // ISO 4217
    description: z.string().max(1000).nullable(),
    isDefault: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .merge(softDeletableSchema);

// ============================================================================
// Rate Card Input Types
// ============================================================================

/**
 * Input for creating a new rate card
 */
export type CreateRateCardInput = {
  /** Company this rate card belongs to */
  companyId: CompanyId;
  /** Human-readable name */
  name: string;
  /** Hourly rate in cents */
  hourlyRateCents: number;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Optional description */
  description?: string | null;
  /** Whether this is the default rate card */
  isDefault?: boolean;
};

/**
 * Zod schema for creating a rate card
 */
export const createRateCardInputSchema = z.object({
  companyId: companyIdSchema,
  name: z.string().min(1).max(200),
  hourlyRateCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  description: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Input for updating an existing rate card
 */
export type UpdateRateCardInput = {
  /** Updated name */
  name?: string;
  /** Updated hourly rate in cents */
  hourlyRateCents?: number;
  /** Updated currency */
  currency?: string;
  /** Updated description */
  description?: string | null;
  /** Updated default status */
  isDefault?: boolean;
};

/**
 * Zod schema for updating a rate card
 */
export const updateRateCardInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  hourlyRateCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  description: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
});

// ============================================================================
// Invoice Status
// ============================================================================

/**
 * Invoice status values
 */
export const invoiceStatusValues = ['draft', 'sent', 'paid', 'voided'] as const;

export type InvoiceStatus = (typeof invoiceStatusValues)[number];

/**
 * Zod schema for InvoiceStatus
 */
export const invoiceStatusSchema = z.enum(invoiceStatusValues);

// ============================================================================
// Invoice Entity
// ============================================================================

/**
 * An invoice representing billable work for a period.
 * Invoices are derivative - generated from sessions and rate cards.
 */
export type Invoice = {
  /** Unique identifier */
  id: InvoiceId;
  /** Company this invoice belongs to (tenant isolation) */
  companyId: CompanyId;
  /** Start of the billing period (Unix ms) */
  periodStart: Timestamp;
  /** End of the billing period (Unix ms) */
  periodEnd: Timestamp;
  /** Session IDs included in this invoice */
  sessionIds: SessionId[];
  /** Rate card used for billing */
  rateCardId: RateCardId;
  /** Total billable minutes */
  totalMinutes: number;
  /** Total amount in cents */
  totalCents: number;
  /** Currency code (copied from rate card for historical accuracy) */
  currency: string;
  /** Invoice status */
  status: InvoiceStatus;
  /** Optional notes */
  notes: string | null;
  /** Optional invoice number (for external reference) */
  invoiceNumber: string | null;
  /** When the invoice was created (Unix ms) */
  createdAt: Timestamp;
  /** When the invoice was last updated (Unix ms) */
  updatedAt: Timestamp;
} & SoftDeletable;

/**
 * Zod schema for Invoice entity
 */
export const invoiceSchema = z
  .object({
    id: invoiceIdSchema,
    companyId: companyIdSchema,
    periodStart: timestampSchema,
    periodEnd: timestampSchema,
    sessionIds: z.array(sessionIdSchema),
    rateCardId: rateCardIdSchema,
    totalMinutes: z.number().int().nonnegative(),
    totalCents: z.number().int().nonnegative(),
    currency: z.string().length(3),
    status: invoiceStatusSchema,
    notes: z.string().max(5000).nullable(),
    invoiceNumber: z.string().max(100).nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .merge(softDeletableSchema);

// ============================================================================
// Invoice Input Types
// ============================================================================

/**
 * Input for creating a new invoice
 */
export type CreateInvoiceInput = {
  /** Company this invoice belongs to */
  companyId: CompanyId;
  /** Start of the billing period */
  periodStart: Timestamp;
  /** End of the billing period */
  periodEnd: Timestamp;
  /** Session IDs to include */
  sessionIds: SessionId[];
  /** Rate card to use for billing */
  rateCardId: RateCardId;
  /** Total billable minutes (calculated from sessions) */
  totalMinutes: number;
  /** Total amount in cents (calculated from minutes and rate) */
  totalCents: number;
  /** Currency code */
  currency: string;
  /** Initial status (defaults to draft) */
  status?: InvoiceStatus;
  /** Optional notes */
  notes?: string | null;
  /** Optional invoice number */
  invoiceNumber?: string | null;
};

/**
 * Zod schema for creating an invoice
 */
export const createInvoiceInputSchema = z.object({
  companyId: companyIdSchema,
  periodStart: timestampSchema,
  periodEnd: timestampSchema,
  sessionIds: z.array(sessionIdSchema),
  rateCardId: rateCardIdSchema,
  totalMinutes: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: invoiceStatusSchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
  invoiceNumber: z.string().max(100).nullable().optional(),
});

/**
 * Input for updating an existing invoice
 */
export type UpdateInvoiceInput = {
  /** Updated session IDs (only for draft invoices) */
  sessionIds?: SessionId[];
  /** Updated rate card (only for draft invoices) */
  rateCardId?: RateCardId;
  /** Updated total minutes (recalculated) */
  totalMinutes?: number;
  /** Updated total cents (recalculated) */
  totalCents?: number;
  /** Updated status */
  status?: InvoiceStatus;
  /** Updated notes */
  notes?: string | null;
  /** Updated invoice number */
  invoiceNumber?: string | null;
};

/**
 * Zod schema for updating an invoice
 */
export const updateInvoiceInputSchema = z.object({
  sessionIds: z.array(sessionIdSchema).optional(),
  rateCardId: rateCardIdSchema.optional(),
  totalMinutes: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().optional(),
  status: invoiceStatusSchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
  invoiceNumber: z.string().max(100).nullable().optional(),
});
