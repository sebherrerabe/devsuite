import assert from 'node:assert/strict';
import test from 'node:test';

import { syncUserNotifications } from './notification-sync.js';

const SYNC_SINCE_OVERLAP_MS = 60_000;
type SyncOptions = Parameters<typeof syncUserNotifications>[0];
type TestConnectionManager = Pick<
  SyncOptions['connectionManager'],
  'getAuthenticatedToken'
>;
type TestBackendClient = Pick<
  SyncOptions['backendClient'],
  | 'listCompanyRoutes'
  | 'getNotificationSyncCursor'
  | 'ingestNotifications'
  | 'recordSyncTelemetry'
>;

function createTestDeps() {
  const recordedTelemetry: Array<
    Parameters<TestBackendClient['recordSyncTelemetry']>[1]
  > = [];

  const connectionManager: TestConnectionManager = {
    async getAuthenticatedToken() {
      return {
        token: 'test-token',
        githubUser: 'sebherrerabe',
      };
    },
  };

  const backendClient: TestBackendClient = {
    async listCompanyRoutes() {
      return [
        {
          companyId: 'company-1',
          companyName: 'Glimpact',
          githubOrgLogins: ['glimpact'],
        },
      ];
    },
    async getNotificationSyncCursor() {
      return {
        lastSuccessAt: null,
        lastSuccessGithubUpdatedAt: null,
      };
    },
    async ingestNotifications(
      _userId: Parameters<TestBackendClient['ingestNotifications']>[0],
      notifications: Parameters<TestBackendClient['ingestNotifications']>[1]
    ) {
      return {
        companiesConsidered: 1,
        notificationsReceived: notifications.length,
        notificationsRouted: notifications.length,
        notificationsUnmatched: 0,
        deliveriesCreated: notifications.length,
        deliveriesUpdated: 0,
        deliveriesSkippedStale: 0,
      };
    },
    async recordSyncTelemetry(
      _userId: Parameters<TestBackendClient['recordSyncTelemetry']>[0],
      telemetry: Parameters<TestBackendClient['recordSyncTelemetry']>[1]
    ) {
      recordedTelemetry.push(telemetry);
    },
  };

  return {
    connectionManager,
    backendClient,
    recordedTelemetry,
  };
}

test('syncUserNotifications: uses GitHub-updated cursor when present', async () => {
  const deps = createTestDeps();
  const cursorMs = Date.parse('2026-02-26T12:00:00.000Z');
  const expectedSince = cursorMs - SYNC_SINCE_OVERLAP_MS;
  let seenSince: number | null = null;

  deps.backendClient.getNotificationSyncCursor = async () => ({
    lastSuccessAt: cursorMs - 10 * 60_000,
    lastSuccessGithubUpdatedAt: cursorMs,
  });

  await syncUserNotifications({
    connectionManager:
      deps.connectionManager as SyncOptions['connectionManager'],
    backendClient: deps.backendClient as SyncOptions['backendClient'],
    userId: 'user-cursor',
    batchSize: 50,
    fetchNotificationsImpl: async params => {
      seenSince = params.since ?? null;
      return [
        {
          threadId: 'thread-1',
          reason: 'mention',
          title: 'Mentioned in PR',
          url: null,
          repoFullName: 'glimpact/devsuite',
          orgLogin: 'glimpact',
          subjectType: 'PullRequest',
          updatedAt: cursorMs + 1_000,
          unread: true,
          apiUrl: null,
        },
      ];
    },
  });

  assert.equal(seenSince, expectedSince);
  assert.equal(deps.recordedTelemetry.length, 1);
  assert.equal(
    deps.recordedTelemetry[0]?.maxProcessedGithubUpdatedAt,
    cursorMs + 1_000
  );
});

test('syncUserNotifications: dedupes concurrent runs per user', async () => {
  const deps = createTestDeps();
  let fetchCalls = 0;
  let releaseFetch!: () => void;
  const gate = new Promise<void>(resolve => {
    releaseFetch = () => resolve();
  });

  const runSync = () =>
    syncUserNotifications({
      connectionManager:
        deps.connectionManager as SyncOptions['connectionManager'],
      backendClient: deps.backendClient as SyncOptions['backendClient'],
      userId: 'user-lock',
      batchSize: 50,
      fetchNotificationsImpl: async () => {
        fetchCalls += 1;
        await gate;
        return [];
      },
    });

  const first = runSync();
  const second = runSync();
  releaseFetch();

  await Promise.all([first, second]);
  assert.equal(fetchCalls, 1);
  assert.equal(deps.recordedTelemetry.length, 1);
});
