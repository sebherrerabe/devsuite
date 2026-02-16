import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WindowsProcessMonitor,
  listWindowsProcesses,
  listWindowsProcessesVerbose,
} from '../../src/process-monitor.js';
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

test('pollOnce logs full error context on failures', async () => {
  const { logger, events } = createLogger();
  const monitor = new WindowsProcessMonitor({
    onEvents: async () => undefined,
    listProcesses: async () => {
      throw Object.assign(new Error('tasklist failed'), {
        code: 'EACCES',
        stderr: 'access denied',
      });
    },
    logger,
  });

  await (monitor as unknown as { pollOnce: () => Promise<void> }).pollOnce();

  const errorLog = events.find(
    event =>
      event.level === 'error' &&
      event.subsystem === 'process-monitor' &&
      event.message.includes('pollOnce failed:')
  );

  assert.ok(errorLog);
  assert.match(errorLog.message, /code=EACCES/);
  assert.match(errorLog.message, /stderr=access denied/);
});

test('listWindowsProcesses logs permission hints for EPERM/EACCES errors', async () => {
  const { logger, events } = createLogger();

  await assert.rejects(
    listWindowsProcesses({
      executor: (async () => {
        throw Object.assign(new Error('denied'), {
          code: 'EPERM',
          stderr: 'Access is denied.',
        });
      }) as Parameters<typeof listWindowsProcesses>[0]['executor'],
      logger,
    })
  );

  assert.equal(
    events.some(
      event =>
        event.level === 'warn' &&
        event.message.includes('EPERM/EACCES') &&
        event.subsystem === 'process-monitor'
    ),
    true
  );
});

test('listWindowsProcessesVerbose logs timeout failures distinctly', async () => {
  const { logger, events } = createLogger();

  await assert.rejects(
    listWindowsProcessesVerbose({
      executor: (async () => {
        throw Object.assign(new Error('Command timed out after 8000ms'), {
          code: 'ETIMEDOUT',
          stderr: '',
        });
      }) as Parameters<typeof listWindowsProcessesVerbose>[0]['executor'],
      logger,
    })
  );

  assert.equal(
    events.some(
      event =>
        event.level === 'warn' &&
        event.subsystem === 'process-monitor' &&
        event.message.includes('timed out after 8000ms')
    ),
    true
  );
});

test('setConfig logs normalized process monitor configuration', () => {
  const { logger, events } = createLogger();
  const monitor = new WindowsProcessMonitor({
    onEvents: async () => undefined,
    listProcesses: async () => [],
    logger,
  });

  monitor.setConfig({
    ideExecutables: [' Code.exe '],
    appExecutables: [' Slack.exe '],
    pollIntervalMs: 4500,
  });

  const infoLog = events.find(
    event =>
      event.level === 'info' &&
      event.subsystem === 'process-monitor' &&
      event.message.includes('config updated:')
  );

  assert.ok(infoLog);
  assert.match(infoLog.message, /ideExecutables=code\.exe/);
  assert.match(infoLog.message, /appExecutables=slack\.exe/);
  assert.match(infoLog.message, /pollIntervalMs=4500/);

  monitor.stop();
});
