/**
 * @devsuite/shared - Shared types and utilities for DevSuite
 *
 * This package provides:
 * - Core entity types
 * - Zod schemas for runtime validation
 * - Shared utility types and functions
 */

// Base types and utilities
export * from './base';

// Company and Repository entities
export * from './company';

// Project and Task entities
export * from './project-task';

// Session entities
export * from './session';

// Inbox entities
export * from './inbox';

// PR Review entities
export * from './pr-review';

// Performance signals and invoicing
export * from './performance-invoice';

// Version
export const VERSION = '0.0.0';
