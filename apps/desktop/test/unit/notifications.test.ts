import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseDesktopNotificationActionEvent,
  parseDesktopNotificationRequest,
  shouldThrottleDesktopNotification,
} from '../../src/notifications.js';

test('parseDesktopNotificationRequest accepts valid payloads', () => {
  const parsed = parseDesktopNotificationRequest({
    scope: {
      userId: ' user-1 ',
      companyId: ' company-1 ',
    },
    kind: 'session_started',
    title: 'Session started',
    body: 'Focus session is running.',
    action: 'open_sessions',
    route: '/sessions',
    throttleMs: 12_000,
  });

  assert.deepEqual(parsed, {
    scope: {
      userId: 'user-1',
      companyId: 'company-1',
    },
    kind: 'session_started',
    title: 'Session started',
    body: 'Focus session is running.',
    action: 'open_sessions',
    route: '/sessions',
    throttleKey: 'user-1:company-1:session_started:open_sessions',
    throttleMs: 12_000,
  });
});

test('parseDesktopNotificationRequest applies defaults', () => {
  const parsed = parseDesktopNotificationRequest({
    scope: {
      userId: 'user-1',
      companyId: 'company-1',
    },
    kind: 'session_ended',
    title: 'Done',
    body: 'Session ended.',
    action: 'open_app',
  });

  assert.equal(parsed.route, null);
  assert.equal(parsed.throttleMs, 30_000);
  assert.equal(parsed.throttleKey, 'user-1:company-1:session_ended:open_app');
});

test('parseDesktopNotificationRequest accepts new activity tracking notification kinds', () => {
  const kinds: import('../../src/notifications.js').DesktopNotificationKind[] =
    [
      'inactivity_paused',
      'inactivity_resumed',
      'auto_session_started',
      'auto_session_review',
    ];

  for (const kind of kinds) {
    const parsed = parseDesktopNotificationRequest({
      scope: { userId: 'user-1', companyId: 'company-1' },
      kind,
      title: 'Title',
      body: 'Body',
      action: 'open_app',
      throttleKey: `user-1:company-1:${kind}`,
    });

    assert.equal(parsed.kind, kind);
    assert.equal(parsed.throttleKey, `user-1:company-1:${kind}`);
  }
});

test('parseDesktopNotificationRequest rejects invalid payloads', () => {
  assert.throws(
    () => parseDesktopNotificationRequest(null),
    /Desktop notification payload must be an object/
  );
  assert.throws(
    () =>
      parseDesktopNotificationRequest({
        scope: { userId: 'u', companyId: 'c' },
        kind: 'unknown',
        title: 'x',
        body: 'x',
        action: 'open_app',
      }),
    /notification kind is invalid/
  );
  assert.throws(
    () =>
      parseDesktopNotificationRequest({
        scope: { userId: 'u', companyId: 'c' },
        kind: 'session_started',
        title: 'x',
        body: 'x',
        action: 'open_app',
        route: 'sessions',
      }),
    /route must start with "\/"/
  );
});

test('parseDesktopNotificationActionEvent validates payload', () => {
  const parsed = parseDesktopNotificationActionEvent({
    scope: {
      userId: 'user-1',
      companyId: 'company-1',
    },
    action: 'start_session',
    route: '/sessions',
    requestedAt: 1739555000000,
  });

  assert.deepEqual(parsed, {
    scope: {
      userId: 'user-1',
      companyId: 'company-1',
    },
    action: 'start_session',
    route: '/sessions',
    requestedAt: 1739555000000,
  });
});

test('shouldThrottleDesktopNotification enforces cooldown windows', () => {
  assert.equal(shouldThrottleDesktopNotification(null, 10_000, 100), false);
  assert.equal(
    shouldThrottleDesktopNotification(95_000, 10_000, 100_000),
    true
  );
  assert.equal(
    shouldThrottleDesktopNotification(90_000, 10_000, 100_000),
    false
  );
});
