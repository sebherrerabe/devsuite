import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyStrictPolicyOverride,
  createDefaultStrictPolicyState,
  evaluateStrictPolicy,
} from '../../src/strict-policy-engine.js';
import type { DesktopFocusSettings } from '../../src/focus-settings.js';

function createSettings(
  overrides: Partial<DesktopFocusSettings> = {}
): DesktopFocusSettings {
  return {
    devCoreList: ['code.exe'],
    ideWatchList: ['code.exe'],
    devSupportList: ['wt.exe'],
    devSiteList: ['chat.openai.com'],
    appBlockList: ['whatsapp.exe'],
    websiteBlockList: [],
    strictMode: 'prompt_only',
    appActionMode: 'warn',
    websiteActionMode: 'warn_only',
    graceSeconds: 10,
    reminderIntervalSeconds: 30,
    inactivityThresholdSeconds: 300,
    autoInactivityPause: true,
    autoSession: false,
    autoSessionWarmupSeconds: 120,
    ...overrides,
  };
}

function createInput(overrides: {
  nowMs: number;
  sessionStatus?: 'IDLE' | 'RUNNING' | 'PAUSED';
  settings?: DesktopFocusSettings;
  processEvents?: Array<{
    type: 'process_started' | 'process_stopped';
    executable: string;
    pid: number;
    category: 'ide' | 'dev_support' | 'app_block';
    timestamp: number;
  }>;
  websiteEvents?: Array<{
    type: 'website_blocked_started' | 'website_blocked_stopped';
    domain: string;
    sourceId: string;
    timestamp: number;
  }>;
  websiteSignalAvailable?: boolean;
  remainingTaskCount?: number | null;
}) {
  return {
    scope: {
      userId: 'user-1',
      companyId: 'company-1',
    },
    settings: overrides.settings ?? createSettings(),
    sessionState: {
      status: overrides.sessionStatus ?? 'IDLE',
      sessionId: null,
      effectiveDurationMs: 0,
      connectionState: 'connected' as const,
      lastError: null,
      updatedAt: overrides.nowMs,
    },
    processEvents: overrides.processEvents ?? [],
    websiteEvents: overrides.websiteEvents ?? [],
    websiteSignalAvailable: overrides.websiteSignalAvailable ?? false,
    remainingTaskCount: overrides.remainingTaskCount ?? null,
    nowMs: overrides.nowMs,
  };
}

test('engine prompts immediately when IDE starts with no active session', () => {
  const state = createDefaultStrictPolicyState();
  const result = evaluateStrictPolicy(
    state,
    createInput({
      nowMs: 1_000,
      processEvents: [
        {
          type: 'process_started',
          executable: 'code.exe',
          pid: 10,
          category: 'ide',
          timestamp: 1_000,
        },
      ],
    })
  );

  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0]?.type, 'notify');
  assert.equal(result.actions[0]?.kind, 'ide_session_required');
  assert.equal(Object.keys(result.nextState.ideEntries).length, 1);
  assert.equal(
    result.auditEvents.some(event => event.type === 'ide_prompt_started'),
    true
  );
});

test('engine escalates reminders after grace window without closing IDEs', () => {
  const settings = createSettings({
    strictMode: 'prompt_then_close',
    graceSeconds: 10,
    reminderIntervalSeconds: 5,
  });

  const initial = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 1_000,
      settings,
      processEvents: [
        {
          type: 'process_started',
          executable: 'code.exe',
          pid: 10,
          category: 'ide',
          timestamp: 1_000,
        },
      ],
    })
  );

  const later = evaluateStrictPolicy(
    initial.nextState,
    createInput({
      nowMs: 16_500,
      settings,
      processEvents: [],
    })
  );

  assert.equal(
    later.actions.some(
      action =>
        action.type === 'notify' && action.kind === 'ide_session_required'
    ),
    true
  );
  assert.equal(
    later.actions.some(action => action.type === 'close_process'),
    false
  );
  assert.equal(
    later.auditEvents.some(event => event.type === 'ide_close_requested'),
    false
  );
});

test('policy override suppresses enforcement during override window', () => {
  const settings = createSettings({
    strictMode: 'prompt_then_close',
    graceSeconds: 1,
    reminderIntervalSeconds: 1,
  });
  const initial = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 1_000,
      settings,
      processEvents: [
        {
          type: 'process_started',
          executable: 'code.exe',
          pid: 10,
          category: 'ide',
          timestamp: 1_000,
        },
      ],
    })
  );
  const overridden = applyStrictPolicyOverride(initial.nextState, {
    nowMs: 2_000,
    durationMs: 60_000,
    reason: 'user_snooze',
  });
  const duringOverride = evaluateStrictPolicy(
    overridden.nextState,
    createInput({
      nowMs: 10_000,
      settings,
      processEvents: [],
    })
  );

  assert.equal(duringOverride.actions.length, 0);
  assert.equal(overridden.auditEvent.type, 'override_applied');
});

test('distractor apps are only enforced while a session is running', () => {
  const state = createDefaultStrictPolicyState();
  const whileIdle = evaluateStrictPolicy(
    state,
    createInput({
      nowMs: 2_000,
      sessionStatus: 'IDLE',
      processEvents: [
        {
          type: 'process_started',
          executable: 'whatsapp.exe',
          pid: 22,
          category: 'app_block',
          timestamp: 2_000,
        },
      ],
    })
  );

  assert.equal(whileIdle.actions.length, 0);

  const whilePaused = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 2_500,
      sessionStatus: 'PAUSED',
      processEvents: [
        {
          type: 'process_started',
          executable: 'whatsapp.exe',
          pid: 23,
          category: 'app_block',
          timestamp: 2_500,
        },
      ],
    })
  );

  assert.equal(whilePaused.actions.length, 0);
  assert.deepEqual(Object.keys(whilePaused.nextState.appEntries), []);

  const whileRunning = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 3_000,
      sessionStatus: 'RUNNING',
      processEvents: [
        {
          type: 'process_started',
          executable: 'whatsapp.exe',
          pid: 22,
          category: 'app_block',
          timestamp: 3_000,
        },
      ],
    })
  );

  assert.equal(
    whileRunning.actions.some(
      action =>
        action.type === 'notify' && action.kind === 'distractor_app_detected'
    ),
    true
  );
});

test('dev_support process events do not trigger strict policy enforcement', () => {
  const result = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 2_500,
      sessionStatus: 'RUNNING',
      processEvents: [
        {
          type: 'process_started',
          executable: 'wt.exe',
          pid: 999,
          category: 'dev_support',
          timestamp: 2_500,
        },
      ],
    })
  );

  assert.equal(result.actions.length, 0);
  assert.equal(result.auditEvents.length, 0);
});

test('fail-safe strips close-process actions when action volume spikes', () => {
  const settings = createSettings({
    strictMode: 'prompt_then_close',
    appActionMode: 'warn_then_close',
    graceSeconds: 0,
    reminderIntervalSeconds: 1,
  });

  let state = createDefaultStrictPolicyState();
  const processEvents = Array.from({ length: 40 }, (_, index) => ({
    type: 'process_started' as const,
    executable: `code${index}.exe`,
    pid: 1000 + index,
    category: 'ide' as const,
    timestamp: 1_000,
  }));

  const initialBurst = evaluateStrictPolicy(
    state,
    createInput({
      nowMs: 1_000,
      settings: {
        ...settings,
        ideWatchList: processEvents.map(event => event.executable),
      },
      processEvents,
    })
  );
  state = initialBurst.nextState;

  const stressed = evaluateStrictPolicy(
    state,
    createInput({
      nowMs: 2_000,
      settings: {
        ...settings,
        ideWatchList: processEvents.map(event => event.executable),
      },
      processEvents: [],
    })
  );

  assert.equal(stressed.nextState.failSafeActive, true);
  assert.equal(
    stressed.actions.some(action => action.type === 'close_process'),
    false
  );
  assert.equal(
    initialBurst.auditEvents.some(
      event => event.type === 'fail_safe_engaged'
    ) || stressed.auditEvents.some(event => event.type === 'fail_safe_engaged'),
    true
  );
});

test('website block list triggers prompt and escalation reminders while session is active', () => {
  const settings = createSettings({
    websiteBlockList: ['youtube.com'],
    websiteActionMode: 'escalate',
    reminderIntervalSeconds: 5,
  });
  const initial = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 1_000,
      sessionStatus: 'RUNNING',
      settings,
      websiteSignalAvailable: true,
      websiteEvents: [
        {
          type: 'website_blocked_started',
          domain: 'youtube.com',
          sourceId: 'main-window',
          timestamp: 1_000,
        },
      ],
    })
  );

  assert.equal(
    initial.actions.some(
      action =>
        action.type === 'notify' && action.kind === 'website_blocked_detected'
    ),
    true
  );
  assert.equal(
    initial.auditEvents.some(event => event.type === 'website_prompt_started'),
    true
  );

  const later = evaluateStrictPolicy(
    initial.nextState,
    createInput({
      nowMs: 7_500,
      sessionStatus: 'RUNNING',
      settings,
      websiteSignalAvailable: true,
    })
  );

  assert.equal(
    later.actions.some(
      action =>
        action.type === 'notify' && action.kind === 'website_blocked_detected'
    ),
    true
  );
  assert.equal(
    later.auditEvents.some(event => event.type === 'website_reminder_sent'),
    true
  );
});

test('website block list is not enforced while a session is paused', () => {
  const settings = createSettings({
    websiteBlockList: ['youtube.com'],
    websiteActionMode: 'escalate',
    reminderIntervalSeconds: 5,
  });

  const paused = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 1_000,
      sessionStatus: 'PAUSED',
      settings,
      websiteSignalAvailable: true,
      websiteEvents: [
        {
          type: 'website_blocked_started',
          domain: 'youtube.com',
          sourceId: 'main-window',
          timestamp: 1_000,
        },
      ],
    })
  );

  assert.equal(paused.actions.length, 0);
  assert.deepEqual(Object.keys(paused.nextState.websiteEntries), []);
  assert.equal(
    paused.auditEvents.some(event => event.type === 'website_prompt_started'),
    false
  );
});

test('website policy logs safe fallback when URL signal is unavailable', () => {
  const settings = createSettings({
    websiteBlockList: ['x.com'],
    reminderIntervalSeconds: 5,
  });
  const result = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 10_000,
      sessionStatus: 'RUNNING',
      settings,
      websiteSignalAvailable: false,
    })
  );

  assert.equal(
    result.auditEvents.some(
      event => event.type === 'website_signal_unavailable'
    ),
    true
  );
  assert.equal(
    result.actions.some(action => action.type === 'close_process'),
    false
  );
});

test('website policy does not log fallback while session is paused', () => {
  const settings = createSettings({
    websiteBlockList: ['x.com'],
    reminderIntervalSeconds: 5,
  });
  const result = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 10_000,
      sessionStatus: 'PAUSED',
      settings,
      websiteSignalAvailable: false,
    })
  );

  assert.equal(
    result.auditEvents.some(
      event => event.type === 'website_signal_unavailable'
    ),
    false
  );
});

test('remaining task reminders escalate and stop when backlog clears', () => {
  const settings = createSettings({
    reminderIntervalSeconds: 5,
  });
  const initial = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 20_000,
      sessionStatus: 'RUNNING',
      settings,
      remainingTaskCount: 3,
    })
  );

  assert.equal(
    initial.actions.some(
      action =>
        action.type === 'notify' && action.kind === 'tasks_remaining_reminder'
    ),
    true
  );
  assert.equal(
    initial.auditEvents.some(event => event.type === 'tasks_reminder_sent'),
    true
  );

  const reminderTwo = evaluateStrictPolicy(
    initial.nextState,
    createInput({
      nowMs: 26_000,
      sessionStatus: 'RUNNING',
      settings,
      remainingTaskCount: 3,
    })
  );
  const reminderThree = evaluateStrictPolicy(
    reminderTwo.nextState,
    createInput({
      nowMs: 32_500,
      sessionStatus: 'RUNNING',
      settings,
      remainingTaskCount: 3,
    })
  );

  assert.equal(
    reminderThree.auditEvents.some(
      event => event.type === 'tasks_escalation_sent'
    ),
    true
  );

  const cleared = evaluateStrictPolicy(
    reminderThree.nextState,
    createInput({
      nowMs: 40_000,
      sessionStatus: 'RUNNING',
      settings,
      remainingTaskCount: 0,
    })
  );
  assert.equal(
    cleared.auditEvents.some(event => event.type === 'tasks_reminder_cleared'),
    true
  );
});

test('strict policy state can resume after restart without duplicate immediate prompts', () => {
  const settings = createSettings({
    strictMode: 'prompt_then_close',
    reminderIntervalSeconds: 30,
    graceSeconds: 60,
  });

  const initial = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 1_000,
      settings,
      processEvents: [
        {
          type: 'process_started',
          executable: 'code.exe',
          pid: 333,
          category: 'ide',
          timestamp: 1_000,
        },
      ],
    })
  );

  const resumedAfterRestart = evaluateStrictPolicy(
    initial.nextState,
    createInput({
      nowMs: 10_000,
      settings,
      processEvents: [],
    })
  );

  assert.equal(
    resumedAfterRestart.actions.some(
      action =>
        action.type === 'notify' && action.kind === 'ide_session_required'
    ),
    false
  );
  assert.equal(
    resumedAfterRestart.actions.some(action => action.type === 'close_process'),
    false
  );
});

test('fail-safe can recover after action volume drops', () => {
  const settings = createSettings({
    strictMode: 'prompt_then_close',
    reminderIntervalSeconds: 1,
    graceSeconds: 0,
  });

  const noisyState = {
    ...createDefaultStrictPolicyState(),
    failSafeActive: true,
    recentActionTimestamps: [1_995, 1_996, 1_997],
  };
  const recovered = evaluateStrictPolicy(
    noisyState,
    createInput({
      nowMs: 2_000,
      settings,
      processEvents: [],
      sessionStatus: 'IDLE',
    })
  );

  assert.equal(recovered.nextState.failSafeActive, false);
  assert.equal(
    recovered.auditEvents.some(event => event.type === 'fail_safe_recovered'),
    true
  );
});

test('distractor close-process requests emit matching audit events', () => {
  const settings = createSettings({
    strictMode: 'prompt_then_close',
    appActionMode: 'warn_then_close',
    reminderIntervalSeconds: 1,
    graceSeconds: 0,
  });

  const appClose = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 5_000,
      settings,
      sessionStatus: 'RUNNING',
      processEvents: [
        {
          type: 'process_started',
          executable: 'whatsapp.exe',
          pid: 44,
          category: 'app_block',
          timestamp: 1_000,
        },
      ],
    })
  );

  assert.equal(
    appClose.actions.some(
      action =>
        action.type === 'close_process' && action.reason === 'distractor_app'
    ),
    true
  );
  assert.equal(
    appClose.auditEvents.some(event => event.type === 'app_close_requested'),
    true
  );
});

test('pausing clears distractor entries and resume restarts grace timing', () => {
  const settings = createSettings({
    strictMode: 'prompt_then_close',
    appActionMode: 'warn_then_close',
    websiteBlockList: ['youtube.com'],
    websiteActionMode: 'escalate',
    reminderIntervalSeconds: 5,
    graceSeconds: 10,
  });

  const running = evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    createInput({
      nowMs: 1_000,
      sessionStatus: 'RUNNING',
      settings,
      processEvents: [
        {
          type: 'process_started',
          executable: 'whatsapp.exe',
          pid: 44,
          category: 'app_block',
          timestamp: 1_000,
        },
      ],
      websiteSignalAvailable: true,
      websiteEvents: [
        {
          type: 'website_blocked_started',
          domain: 'youtube.com',
          sourceId: 'tab-1',
          timestamp: 1_000,
        },
      ],
    })
  );

  const paused = evaluateStrictPolicy(
    running.nextState,
    createInput({
      nowMs: 7_000,
      sessionStatus: 'PAUSED',
      settings,
      websiteSignalAvailable: false,
    })
  );

  assert.deepEqual(Object.keys(paused.nextState.appEntries), []);
  assert.deepEqual(Object.keys(paused.nextState.websiteEntries), []);
  assert.equal(
    paused.auditEvents.some(event => event.type === 'app_entry_cleared'),
    true
  );
  assert.equal(
    paused.auditEvents.some(event => event.type === 'website_entry_cleared'),
    true
  );
  assert.equal(
    paused.auditEvents.some(
      event => event.type === 'website_signal_unavailable'
    ),
    false
  );

  const resumed = evaluateStrictPolicy(
    paused.nextState,
    createInput({
      nowMs: 8_000,
      sessionStatus: 'RUNNING',
      settings,
      processEvents: [
        {
          type: 'process_started',
          executable: 'whatsapp.exe',
          pid: 44,
          category: 'app_block',
          timestamp: 8_000,
        },
      ],
      websiteSignalAvailable: true,
      websiteEvents: [
        {
          type: 'website_blocked_started',
          domain: 'youtube.com',
          sourceId: 'tab-1',
          timestamp: 8_000,
        },
      ],
    })
  );

  assert.equal(
    resumed.actions.some(
      action =>
        action.type === 'notify' && action.kind === 'distractor_app_detected'
    ),
    true
  );
  assert.equal(
    resumed.actions.some(
      action =>
        action.type === 'notify' && action.kind === 'website_blocked_detected'
    ),
    true
  );
  assert.equal(
    resumed.actions.some(action => action.type === 'close_process'),
    false
  );

  const beforeGrace = evaluateStrictPolicy(
    resumed.nextState,
    createInput({
      nowMs: 17_500,
      sessionStatus: 'RUNNING',
      settings,
      websiteSignalAvailable: true,
    })
  );
  assert.equal(
    beforeGrace.actions.some(action => action.type === 'close_process'),
    false
  );

  const afterGrace = evaluateStrictPolicy(
    resumed.nextState,
    createInput({
      nowMs: 18_500,
      sessionStatus: 'RUNNING',
      settings,
      websiteSignalAvailable: true,
    })
  );
  assert.equal(
    afterGrace.actions.some(action => action.type === 'close_process'),
    true
  );
});
