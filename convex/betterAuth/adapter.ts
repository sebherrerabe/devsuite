import { createApi } from '@convex-dev/better-auth';
import { createAuthOptions } from './auth';
import schema from './schema';

// Type assertion needed for composite TypeScript builds due to @convex-dev/better-auth's complex inferred types
// that reference internal _generated modules
export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = createApi(schema, createAuthOptions) as any;
