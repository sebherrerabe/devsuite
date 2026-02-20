import assert from 'node:assert/strict';
import test from 'node:test';

import { requireOwnedCompanyId } from './helpers.js';

test('requireOwnedCompanyId: allows company owned by authenticated user', async () => {
  const companyId = 'company_1' as unknown as never;
  const resolved = await requireOwnedCompanyId(
    {
      auth: {
        getUserIdentity: async () => ({ subject: 'user_1' }),
      },
      db: {
        get: async () => ({
          _id: companyId,
          userId: 'user_1',
          isDeleted: false,
          deletedAt: null,
        }),
      },
    },
    companyId as never
  );

  assert.equal(resolved, companyId);
});

test('requireOwnedCompanyId: rejects unauthenticated requests', async () => {
  const companyId = 'company_1' as unknown as never;

  await assert.rejects(
    () =>
      requireOwnedCompanyId(
        {
          auth: {
            getUserIdentity: async () => null,
          },
          db: {
            get: async () => null,
          },
        },
        companyId as never
      ),
    /Unauthorized/
  );
});

test('requireOwnedCompanyId: rejects company owned by another user', async () => {
  const companyId = 'company_1' as unknown as never;

  await assert.rejects(
    () =>
      requireOwnedCompanyId(
        {
          auth: {
            getUserIdentity: async () => ({ subject: 'user_1' }),
          },
          db: {
            get: async () => ({
              _id: companyId,
              userId: 'user_2',
              isDeleted: false,
              deletedAt: null,
            }),
          },
        },
        companyId as never
      ),
    /Company not found or access denied/
  );
});

test('requireOwnedCompanyId: rejects deleted company', async () => {
  const companyId = 'company_1' as unknown as never;

  await assert.rejects(
    () =>
      requireOwnedCompanyId(
        {
          auth: {
            getUserIdentity: async () => ({ subject: 'user_1' }),
          },
          db: {
            get: async () => ({
              _id: companyId,
              userId: 'user_1',
              isDeleted: true,
              deletedAt: Date.now(),
            }),
          },
        },
        companyId as never
      ),
    /Company not found/
  );
});
