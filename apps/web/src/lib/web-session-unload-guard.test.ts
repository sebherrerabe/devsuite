import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPauseOnUnloadUrl,
  shouldPauseSessionOnUnload,
} from './web-session-unload-guard-utils';

test('buildPauseOnUnloadUrl resolves against the Convex site url', () => {
  assert.equal(
    buildPauseOnUnloadUrl('https://example.convex.site'),
    'https://example.convex.site/web/session/pause-on-unload'
  );
});

test('shouldPauseSessionOnUnload only enables browser unload pause for running web sessions', () => {
  assert.equal(
    shouldPauseSessionOnUnload({
      isDesktopRuntime: false,
      isSessionsEnabled: true,
      companyId: 'company-1',
      siteUrl: 'https://example.convex.site',
      activeSession: {
        _id: 'session-1',
        status: 'RUNNING',
      },
    }),
    true
  );

  assert.equal(
    shouldPauseSessionOnUnload({
      isDesktopRuntime: true,
      isSessionsEnabled: true,
      companyId: 'company-1',
      siteUrl: 'https://example.convex.site',
      activeSession: {
        _id: 'session-1',
        status: 'RUNNING',
      },
    }),
    false
  );

  assert.equal(
    shouldPauseSessionOnUnload({
      isDesktopRuntime: false,
      isSessionsEnabled: true,
      companyId: 'company-1',
      siteUrl: 'https://example.convex.site',
      activeSession: {
        _id: 'session-1',
        status: 'PAUSED',
      },
    }),
    false
  );
});
