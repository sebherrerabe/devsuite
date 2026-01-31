/**
 * Compile-time-only type alignment checks.
 *
 * This file exists to ensure Convex IDs and `@devsuite/shared` branded IDs stay aligned.
 * It should never be imported at runtime; it simply needs to compile under `pnpm -C convex typecheck`.
 */

import type { CompanyId, ProjectId } from '@devsuite/shared';
import type { Doc, Id } from '../_generated/dataModel';
import { toSharedId, toSharedShape } from './helpers';

/**
 * IMPORTANT:
 * Convex will analyze/bundle every module in `convex/` during push.
 * That means **top-level runtime code must not reference declared-only symbols**.
 *
 * We keep these checks in a `if (false)` block:
 * - TypeScript still typechecks the assignments
 * - JavaScript never executes the code at runtime (so Convex push is safe)
 */
// eslint-disable-next-line no-constant-condition
if (false) {
  const companyId = null as unknown as Id<'companies'>;
  const _sharedCompanyId: CompanyId = toSharedId(companyId);
  void _sharedCompanyId;

  const projectId = null as unknown as Id<'projects'>;
  const _sharedProjectId: ProjectId = toSharedId(projectId);
  void _sharedProjectId;

  const companyDoc = null as unknown as Doc<'companies'>;
  const sharedCompany = toSharedShape(companyDoc);
  const _sharedCompanyShapeId: CompanyId = sharedCompany.id;
  void _sharedCompanyShapeId;
}

export {};
