import { z } from 'zod';

export const appModuleValues = [
  'projects',
  'sessions',
  'performance',
  'pr_reviews',
  'invoicing',
] as const;

export type AppModule = (typeof appModuleValues)[number];

export const appModuleSchema = z.enum(appModuleValues);

export type ModuleFlags = Record<AppModule, boolean>;
export type ModuleFlagOverrides = Partial<Record<AppModule, boolean>>;

export const moduleFlagsSchema = z.object({
  projects: z.boolean(),
  sessions: z.boolean(),
  performance: z.boolean(),
  pr_reviews: z.boolean(),
  invoicing: z.boolean(),
});

export const moduleFlagOverridesSchema = z.object({
  projects: z.boolean().optional(),
  sessions: z.boolean().optional(),
  performance: z.boolean().optional(),
  pr_reviews: z.boolean().optional(),
  invoicing: z.boolean().optional(),
});

export const DEFAULT_MODULE_FLAGS: ModuleFlags = {
  projects: true,
  sessions: true,
  performance: true,
  pr_reviews: true,
  invoicing: true,
};

export function normalizeModuleFlags(
  value: unknown,
  defaults: ModuleFlags = DEFAULT_MODULE_FLAGS
): ModuleFlags {
  const parsed = moduleFlagOverridesSchema.safeParse(value);
  if (!parsed.success) {
    return { ...defaults };
  }
  const overrides = parsed.data;
  return {
    projects: overrides.projects ?? defaults.projects,
    sessions: overrides.sessions ?? defaults.sessions,
    performance: overrides.performance ?? defaults.performance,
    pr_reviews: overrides.pr_reviews ?? defaults.pr_reviews,
    invoicing: overrides.invoicing ?? defaults.invoicing,
  };
}

export function normalizeModuleFlagOverrides(
  value: unknown
): ModuleFlagOverrides {
  const parsed = moduleFlagOverridesSchema.safeParse(value);
  if (!parsed.success) {
    return {};
  }
  const overrides = parsed.data;
  const normalized: ModuleFlagOverrides = {};
  if (overrides.projects !== undefined) {
    normalized.projects = overrides.projects;
  }
  if (overrides.sessions !== undefined) {
    normalized.sessions = overrides.sessions;
  }
  if (overrides.performance !== undefined) {
    normalized.performance = overrides.performance;
  }
  if (overrides.pr_reviews !== undefined) {
    normalized.pr_reviews = overrides.pr_reviews;
  }
  if (overrides.invoicing !== undefined) {
    normalized.invoicing = overrides.invoicing;
  }
  return normalized;
}

export function resolveEffectiveModuleFlags(
  companyDefaults: ModuleFlags,
  userOverrides: ModuleFlagOverrides
): ModuleFlags {
  const merged: ModuleFlags = {
    projects: userOverrides.projects ?? companyDefaults.projects,
    sessions: userOverrides.sessions ?? companyDefaults.sessions,
    performance: userOverrides.performance ?? companyDefaults.performance,
    pr_reviews: userOverrides.pr_reviews ?? companyDefaults.pr_reviews,
    invoicing: userOverrides.invoicing ?? companyDefaults.invoicing,
  };

  if (!merged.projects) {
    merged.sessions = false;
    merged.performance = false;
    merged.invoicing = false;
  }

  if (!merged.sessions) {
    merged.invoicing = false;
  }

  return merged;
}
