import { createAuth } from '../auth';

/**
 * Static auth instance for Better Auth schema generation only.
 * Run: cd convex/betterAuth && npx @better-auth/cli generate -y
 *
 * Do not import this file at runtime—it triggers env var errors in the component.
 * The adapter imports createAuthOptions from ../auth (main app) instead.
 */
export const auth = createAuth({} as any);
