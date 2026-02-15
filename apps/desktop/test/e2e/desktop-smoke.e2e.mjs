/* global beforeEach, browser, describe, it */

import assert from 'node:assert/strict';

const TEST_SCOPE = {
  userId: 'e2e-user',
  companyId: 'e2e-company',
};

function createConnectedSessionState(overrides = {}) {
  return {
    status: 'IDLE',
    sessionId: null,
    effectiveDurationMs: 0,
    remainingTaskCount: 0,
    connectionState: 'connected',
    lastError: null,
    updatedAt: Date.now(),
    ...overrides,
  };
}

async function getPolicyAuditEvents() {
  return await browser.execute(async scope => {
    const desktopPolicy = globalThis.window?.desktopPolicy;
    if (!desktopPolicy) {
      return [];
    }
    return await desktopPolicy.getAuditEvents(scope);
  }, TEST_SCOPE);
}

async function publishSessionState(stateOverrides) {
  await browser.execute(
    async ({ scope, state }) => {
      await globalThis.window.desktopSession.publishState(scope, state);
    },
    {
      scope: TEST_SCOPE,
      state: createConnectedSessionState(stateOverrides),
    }
  );
}

async function getSessionState() {
  return await browser.execute(async scope => {
    return await globalThis.window.desktopSession.getState(scope);
  }, TEST_SCOPE);
}

async function injectProcessEvents(events) {
  await browser.execute(async payload => {
    await globalThis.window.desktopTest.injectProcessEvents(payload);
  }, events);
}

async function injectWebsiteEvents(events) {
  await browser.execute(async payload => {
    await globalThis.window.desktopTest.injectWebsiteEvents(payload);
  }, events);
}

async function resetPolicyState() {
  await browser.execute(async () => {
    await globalThis.window.desktopTest.resetPolicyState();
  });
}

async function waitForDesktopBridge() {
  await browser.waitUntil(async () => {
    return await browser.execute(() => {
      const runtimeWindow = globalThis.window;
      return Boolean(
        runtimeWindow?.desktopFocus &&
        runtimeWindow?.desktopSession &&
        runtimeWindow?.desktopPolicy &&
        runtimeWindow?.desktopTest
      );
    });
  });
}

describe('desktop e2e smoke', () => {
  beforeEach(async () => {
    await waitForDesktopBridge();
    await resetPolicyState();
    await publishSessionState();
  });

  it('boots and loads the deterministic E2E shell page', async () => {
    await browser.waitUntil(async () => {
      const title = await browser.getTitle();
      return title === 'DevSuite Desktop E2E';
    });

    assert.equal(await browser.getTitle(), 'DevSuite Desktop E2E');
  });

  it('loads fixture scope from seeded desktop user data', async () => {
    const scope = await browser.execute(async () => {
      const desktopAuth = globalThis.window?.desktopAuth;
      if (!desktopAuth) {
        return null;
      }
      return await desktopAuth.getScope();
    });

    assert.deepEqual(scope, TEST_SCOPE);
  });

  it('reads fixture focus settings through the desktop bridge', async () => {
    const settings = await browser.execute(async scope => {
      return await globalThis.window.desktopFocus.get(scope);
    }, TEST_SCOPE);

    assert.equal(settings.strictMode, 'prompt_then_close');
    assert.equal(settings.appActionMode, 'warn_then_close');
    assert.equal(settings.websiteActionMode, 'escalate');
    assert.deepEqual(settings.websiteBlockList, [
      'youtube.com',
      'x.com',
      'instagram.com',
    ]);
  });

  it('rejects focus settings reads for mismatched tenant scope', async () => {
    const message = await browser.execute(
      async requestedScope => {
        try {
          await globalThis.window.desktopFocus.get(requestedScope);
          return null;
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
          }
          return String(error);
        }
      },
      {
        userId: TEST_SCOPE.userId,
        companyId: 'mismatch-company',
      }
    );

    assert.equal(typeof message, 'string');
    assert.match(message, /scope mismatch/i);
  });

  it('rejects policy audit reads for mismatched tenant scope', async () => {
    const message = await browser.execute(
      async requestedScope => {
        try {
          await globalThis.window.desktopPolicy.getAuditEvents(requestedScope);
          return null;
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
          }
          return String(error);
        }
      },
      {
        userId: TEST_SCOPE.userId,
        companyId: 'different-company',
      }
    );

    assert.equal(typeof message, 'string');
    assert.match(message, /scope mismatch/i);
  });

  it('rejects process monitor reads for mismatched tenant scope', async () => {
    const message = await browser.execute(
      async requestedScope => {
        try {
          await globalThis.window.desktopProcessMonitor.getEvents(
            requestedScope
          );
          return null;
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
          }
          return String(error);
        }
      },
      {
        userId: 'different-user',
        companyId: TEST_SCOPE.companyId,
      }
    );

    assert.equal(typeof message, 'string');
    assert.match(message, /scope mismatch/i);
  });

  it('rejects session action requests for mismatched tenant scope', async () => {
    const message = await browser.execute(
      async requestedScope => {
        try {
          await globalThis.window.desktopSession.requestAction(
            requestedScope,
            'start'
          );
          return null;
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
          }
          return String(error);
        }
      },
      {
        userId: TEST_SCOPE.userId,
        companyId: 'wrong-company',
      }
    );

    assert.equal(typeof message, 'string');
    assert.match(message, /scope mismatch/i);
  });

  it('rejects session state publish for mismatched tenant scope', async () => {
    const message = await browser.execute(
      async ({ scope, state }) => {
        try {
          await globalThis.window.desktopSession.publishState(scope, state);
          return null;
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
          }
          return String(error);
        }
      },
      {
        scope: {
          userId: TEST_SCOPE.userId,
          companyId: 'wrong-company',
        },
        state: createConnectedSessionState(),
      }
    );

    assert.equal(typeof message, 'string');
    assert.match(message, /scope mismatch/i);
  });

  it('rejects session state reads for mismatched tenant scope', async () => {
    const message = await browser.execute(
      async requestedScope => {
        try {
          await globalThis.window.desktopSession.getState(requestedScope);
          return null;
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
          }
          return String(error);
        }
      },
      {
        userId: TEST_SCOPE.userId,
        companyId: 'another-company',
      }
    );

    assert.equal(typeof message, 'string');
    assert.match(message, /scope mismatch/i);
  });

  it('rejects policy override requests for mismatched tenant scope', async () => {
    const message = await browser.execute(
      async requestedScope => {
        try {
          await globalThis.window.desktopPolicy.applyOverride({
            scope: requestedScope,
            durationMs: 30_000,
            reason: 'e2e_scope_mismatch',
          });
          return null;
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            return String(error.message);
          }
          return String(error);
        }
      },
      {
        userId: 'wrong-user',
        companyId: TEST_SCOPE.companyId,
      }
    );

    assert.equal(typeof message, 'string');
    assert.match(message, /scope mismatch/i);
  });

  it('processes session command controls path (start/pause/resume/end)', async () => {
    await browser.execute(async scope => {
      await globalThis.window.desktopSession.requestAction(scope, 'start');
    }, TEST_SCOPE);
    await browser.waitUntil(
      async () => (await getSessionState()).status === 'RUNNING'
    );

    await browser.execute(async scope => {
      await globalThis.window.desktopSession.requestAction(scope, 'pause');
    }, TEST_SCOPE);
    await browser.waitUntil(
      async () => (await getSessionState()).status === 'PAUSED'
    );

    await browser.execute(async scope => {
      await globalThis.window.desktopSession.requestAction(scope, 'resume');
    }, TEST_SCOPE);
    await browser.waitUntil(
      async () => (await getSessionState()).status === 'RUNNING'
    );

    await browser.execute(async scope => {
      await globalThis.window.desktopSession.requestAction(scope, 'end');
    }, TEST_SCOPE);
    await browser.waitUntil(
      async () => (await getSessionState()).status === 'IDLE'
    );
  });

  it('does not dispatch session actions while connection is syncing', async () => {
    await publishSessionState({
      status: 'IDLE',
      connectionState: 'syncing',
      updatedAt: Date.now(),
    });

    await browser.execute(async scope => {
      await globalThis.window.desktopSession.requestAction(scope, 'start');
    }, TEST_SCOPE);

    await browser.pause(350);
    const state = await getSessionState();
    assert.equal(state.status, 'IDLE');
  });

  it('records IDE prompt audit when watched IDE starts without an active session', async () => {
    await publishSessionState({ status: 'IDLE', sessionId: null });
    const beforeEvents = await getPolicyAuditEvents();

    await injectProcessEvents([
      {
        type: 'process_started',
        executable: 'code.exe',
        pid: 501,
        category: 'ide',
        timestamp: Date.now(),
      },
    ]);

    await browser.waitUntil(async () => {
      const events = await getPolicyAuditEvents();
      return events
        .slice(beforeEvents.length)
        .some(event => event.type === 'ide_prompt_started');
    });
  });

  it('records app warning and close-request audits for warn-then-close policy', async () => {
    await publishSessionState({
      status: 'RUNNING',
      sessionId: 'e2e-session-app-close',
      remainingTaskCount: 2,
    });

    const beforeEvents = await getPolicyAuditEvents();
    await injectProcessEvents([
      {
        type: 'process_started',
        executable: 'whatsapp.exe',
        pid: 700,
        category: 'app_block',
        timestamp: Date.now() - 120_000,
      },
    ]);

    await browser.waitUntil(async () => {
      const events = await getPolicyAuditEvents();
      const recent = events.slice(beforeEvents.length);
      return (
        recent.some(event => event.type === 'app_prompt_started') &&
        recent.some(event => event.type === 'app_close_requested')
      );
    });
  });

  it('records website prompt audit for explicit blocked-domain website events', async () => {
    await publishSessionState({
      status: 'RUNNING',
      sessionId: 'e2e-session-website',
      remainingTaskCount: 1,
    });

    const beforeEvents = await getPolicyAuditEvents();
    await injectWebsiteEvents([
      {
        type: 'website_blocked_started',
        domain: 'youtube.com',
        sourceId: 'e2e-tab-1',
        timestamp: Date.now(),
      },
    ]);

    await browser.waitUntil(async () => {
      const events = await getPolicyAuditEvents();
      return events
        .slice(beforeEvents.length)
        .some(event => event.type === 'website_prompt_started');
    });
  });

  it('emits reminder and website-signal fallback audits from policy evaluation', async () => {
    await publishSessionState({
      status: 'RUNNING',
      sessionId: 'e2e-session-1',
      effectiveDurationMs: 15_000,
      remainingTaskCount: 3,
    });

    await browser.waitUntil(async () => {
      const events = await getPolicyAuditEvents();
      return (
        events.some(event => event.type === 'tasks_reminder_sent') &&
        events.some(event => event.type === 'website_signal_unavailable')
      );
    });

    const events = await getPolicyAuditEvents();
    assert.equal(
      events.some(event => event.type === 'tasks_reminder_sent'),
      true
    );
    assert.equal(
      events.some(event => event.type === 'website_signal_unavailable'),
      true
    );
  });

  it('clears task reminders when remaining task count reaches zero', async () => {
    await publishSessionState({
      status: 'RUNNING',
      sessionId: 'e2e-session-1',
      effectiveDurationMs: 30_000,
      remainingTaskCount: 0,
    });

    await browser.waitUntil(async () => {
      const events = await getPolicyAuditEvents();
      return events.some(event => event.type === 'tasks_reminder_cleared');
    });

    const events = await getPolicyAuditEvents();
    assert.equal(
      events.some(event => event.type === 'tasks_reminder_cleared'),
      true
    );
  });
});
