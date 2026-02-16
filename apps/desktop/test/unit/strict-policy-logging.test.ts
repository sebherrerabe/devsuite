import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  DesktopFocusSettings,
  DesktopSettingsScope,
} from '../../src/focus-settings.js';
import {
  createDefaultStrictPolicyState,
  evaluateStrictPolicy,
  type StrictPolicyAction,
} from '../../src/strict-policy-engine.js';
import { executeStrictPolicyActions } from '../../src/strict-policy-actions.js';
import type {
  RuntimeLogSubsystem,
  RuntimeLogWriter,
} from '../../src/runtime-logger.js';

interface LoggedEvent {
  level: 'debug' | 'info' | 'warn' | 'error';
  subsystem: RuntimeLogSubsystem;
  message: string;
}

function createLogger(): {
  logger: RuntimeLogWriter;
  events: LoggedEvent[];
} {
  const events: LoggedEvent[] = [];

  const capture = (
    level: LoggedEvent['level'],
    subsystem: RuntimeLogSubsystem,
    message: string
  ) => {
    events.push({
      level,
      subsystem,
      message,
    });
  };

  return {
    events,
    logger: {
      debug: (subsystem, message) => capture('debug', subsystem, message),
      info: (subsystem, message) => capture('info', subsystem, message),
      warn: (subsystem, message) => capture('warn', subsystem, message),
      error: (subsystem, message) => capture('error', subsystem, message),
    },
  };
}

function createSettings(
  overrides: Partial<DesktopFocusSettings> = {}
): DesktopFocusSettings {
  return {
    ideWatchList: ['code.exe'],
    appBlockList: ['whatsapp.exe'],
    websiteBlockList: ['youtube.com'],
    strictMode: 'prompt_only',
    appActionMode: 'warn',
    websiteActionMode: 'warn_only',
    graceSeconds: 10,
    reminderIntervalSeconds: 30,
    ...overrides,
  };
}

function createScope(): DesktopSettingsScope {
  return {
    userId: 'user-1',
    companyId: 'company-1',
  };
}

test('evaluateStrictPolicy logs app_block rule evaluation with action result', () => {
  const { logger, events } = createLogger();

  evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    {
      scope: createScope(),
      settings: createSettings(),
      sessionState: {
        status: 'RUNNING',
        sessionId: 's-1',
        effectiveDurationMs: 100,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1000,
      },
      processEvents: [
        {
          type: 'process_started',
          executable: 'whatsapp.exe',
          pid: 10,
          category: 'app_block',
          timestamp: 1000,
        },
      ],
      websiteEvents: [],
      websiteSignalAvailable: true,
      remainingTaskCount: null,
      nowMs: 1000,
    },
    logger
  );

  assert.equal(
    events.some(
      event =>
        event.level === 'debug' &&
        event.subsystem === 'strict-policy' &&
        event.message.includes('app_block rule evaluated:') &&
        event.message.includes('result=action')
    ),
    true
  );
  assert.equal(
    events.some(
      event =>
        event.level === 'info' &&
        event.message.includes('app entry created: whatsapp.exe:10')
    ),
    true
  );
});

test('evaluateStrictPolicy logs app_block skip when session is idle', () => {
  const { logger, events } = createLogger();

  evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    {
      scope: createScope(),
      settings: createSettings(),
      sessionState: {
        status: 'IDLE',
        sessionId: null,
        effectiveDurationMs: 0,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1000,
      },
      processEvents: [
        {
          type: 'process_started',
          executable: 'whatsapp.exe',
          pid: 20,
          category: 'app_block',
          timestamp: 1000,
        },
      ],
      websiteEvents: [],
      websiteSignalAvailable: true,
      remainingTaskCount: null,
      nowMs: 1000,
    },
    logger
  );

  assert.equal(
    events.some(
      event =>
        event.level === 'debug' &&
        event.message.includes('app_block rule evaluated:') &&
        event.message.includes('result=skip')
    ),
    true
  );
});

test('evaluateStrictPolicy logs website rule evaluation', () => {
  const { logger, events } = createLogger();

  evaluateStrictPolicy(
    createDefaultStrictPolicyState(),
    {
      scope: createScope(),
      settings: createSettings(),
      sessionState: {
        status: 'RUNNING',
        sessionId: 's-2',
        effectiveDurationMs: 500,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1000,
      },
      processEvents: [],
      websiteEvents: [
        {
          type: 'website_blocked_started',
          domain: 'youtube.com',
          sourceId: 'source-1',
          timestamp: 1000,
        },
      ],
      websiteSignalAvailable: true,
      remainingTaskCount: null,
      nowMs: 1000,
    },
    logger
  );

  assert.equal(
    events.some(
      event =>
        event.level === 'debug' &&
        event.subsystem === 'strict-policy' &&
        event.message.includes('website rule evaluated: domain=youtube.com') &&
        event.message.includes('result=action')
    ),
    true
  );
});

test('executeStrictPolicyActions logs taskkill success and failures', async () => {
  const { logger, events } = createLogger();
  const scope = createScope();

  const actions: StrictPolicyAction[] = [
    {
      type: 'close_process',
      executable: 'whatsapp.exe',
      pid: 404,
      reason: 'distractor_app',
    },
  ];

  await executeStrictPolicyActions({
    scope,
    actions,
    dependencies: {
      emitNotification: async () => undefined,
      showSessionWidget: async () => undefined,
      logger,
      platform: 'win32',
      taskkill: async () => ({ exitCode: 0 }),
    },
  });

  assert.equal(
    events.some(
      event =>
        event.level === 'warn' &&
        event.message.includes('Issuing taskkill: PID=404')
    ),
    true
  );
  assert.equal(
    events.some(
      event =>
        event.level === 'info' &&
        event.message.includes('taskkill result: PID=404, exitCode=0')
    ),
    true
  );

  const failureEvents = createLogger();
  await executeStrictPolicyActions({
    scope,
    actions,
    dependencies: {
      emitNotification: async () => undefined,
      showSessionWidget: async () => undefined,
      logger: failureEvents.logger,
      platform: 'win32',
      taskkill: async () => {
        throw new Error('mock failure');
      },
    },
  });

  assert.equal(
    failureEvents.events.some(
      event =>
        event.level === 'error' &&
        event.message.includes('taskkill failed: PID=404, error=mock failure')
    ),
    true
  );
});
