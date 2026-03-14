import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { RuntimeLogger } from '../../src/runtime-logger.js';

test('runtime logger writes formatted lines', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'runtime-logger-'));
  const logger = new RuntimeLogger({
    logDirPath: baseDir,
  });

  logger.info('process-monitor', 'process monitor initialized');
  await logger.flush();

  const content = await readFile(join(baseDir, 'desktop-runtime.log'), 'utf8');

  assert.match(
    content,
    /^\[[^\]]+\] \[INFO\] \[process-monitor\] process monitor initialized\n$/
  );
});

test('runtime logger rotates files when size threshold is exceeded', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'runtime-logger-rotation-'));
  const logPath = join(baseDir, 'desktop-runtime.log');

  await writeFile(logPath, 'x'.repeat(120), 'utf8');

  const logger = new RuntimeLogger({
    logFilePath: logPath,
    maxFileBytes: 100,
  });

  logger.warn('widget', 'rotated write');
  await logger.flush();

  const rotatedContent = await readFile(`${logPath}.1`, 'utf8');
  const currentContent = await readFile(logPath, 'utf8');

  assert.equal(rotatedContent, 'x'.repeat(120));
  assert.match(currentContent, /\[WARN\] \[widget\] rotated write/);
});

test('runtime logger tolerates append failures without throwing', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'runtime-logger-errors-'));
  const logger = new RuntimeLogger({
    logDirPath: baseDir,
    fsOps: {
      appendFile: async () => {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      },
    },
  });

  logger.error('hosts-manager', 'cannot write logs');

  await assert.doesNotReject(async () => {
    await logger.flush();
  });
});

test('runtime logger queues writes until app is ready', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'runtime-logger-ready-'));
  let ready = false;

  let resolveReady: (() => void) | null = null;
  const whenReadyPromise = new Promise<void>(resolve => {
    resolveReady = resolve;
  });

  const logger = new RuntimeLogger({
    getApp: () => ({
      isReady: () => ready,
      getPath: () => userDataPath,
      whenReady: () => whenReadyPromise,
    }),
  });

  logger.debug('session-sync', 'queued-before-ready');
  await logger.flush();

  await assert.rejects(
    readFile(join(userDataPath, 'logs', 'desktop-runtime.log'), 'utf8')
  );

  ready = true;
  resolveReady?.();

  await logger.flush();

  const content = await readFile(
    join(userDataPath, 'logs', 'desktop-runtime.log'),
    'utf8'
  );
  assert.match(content, /queued-before-ready/);
});

test('runtime logger clearPersistedLogs removes current and rotated files', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'runtime-logger-clear-'));
  const logPath = join(baseDir, 'desktop-runtime.log');
  const rotatedPath = `${logPath}.1`;
  const logger = new RuntimeLogger({
    logFilePath: logPath,
  });

  logger.info('session-sync', 'sensitive scoped entry');
  await logger.flush();
  await writeFile(rotatedPath, 'older sensitive entry\n', 'utf8');

  await logger.clearPersistedLogs();

  await assert.rejects(readFile(logPath, 'utf8'));
  await assert.rejects(readFile(rotatedPath, 'utf8'));
});
