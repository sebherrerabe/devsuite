import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  BEGIN_MARKER,
  END_MARKER,
  blockDomains,
  cleanupStaleBlocks,
  normalizeHostsDomains,
  stripDevSuiteHostsBlock,
  unblockAll,
} from '../../src/hosts-manager.js';

test('normalizeHostsDomains deduplicates and lowercases', () => {
  assert.deepEqual(
    normalizeHostsDomains([
      ' YouTube.com ',
      'www.youtube.com',
      'https://X.com/home',
      '',
    ]),
    ['youtube.com', 'x.com']
  );
});

test('blockDomains writes managed entries between markers', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'hosts-manager-'));
  const hostsPath = join(tempDir, 'hosts');

  await writeFile(hostsPath, '127.0.0.1 localhost\n', 'utf8');

  const result = await blockDomains(['youtube.com', 'X.com'], {
    hostsPath,
    platform: 'linux',
  });

  assert.equal(result.applied, true);
  const contents = await readFile(hostsPath, 'utf8');
  assert.match(contents, /127\.0\.0\.1 localhost/);
  assert.match(contents, new RegExp(BEGIN_MARKER));
  assert.match(contents, /127\.0\.0\.1 youtube\.com/);
  assert.match(contents, /127\.0\.0\.1 www\.youtube\.com/);
  assert.match(contents, /127\.0\.0\.1 x\.com/);
  assert.match(contents, new RegExp(END_MARKER));
});

test('blockDomains replaces existing managed block', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'hosts-manager-replace-'));
  const hostsPath = join(tempDir, 'hosts');

  await writeFile(
    hostsPath,
    [
      '127.0.0.1 localhost',
      BEGIN_MARKER,
      '127.0.0.1 old.com',
      '127.0.0.1 www.old.com',
      END_MARKER,
      '',
    ].join('\n'),
    'utf8'
  );

  await blockDomains(['new.com'], {
    hostsPath,
    platform: 'linux',
  });

  const contents = await readFile(hostsPath, 'utf8');
  assert.equal(contents.includes('old.com'), false);
  assert.equal(contents.includes('new.com'), true);
});

test('unblockAll removes only managed section', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'hosts-manager-unblock-'));
  const hostsPath = join(tempDir, 'hosts');

  await writeFile(
    hostsPath,
    [
      '127.0.0.1 localhost',
      BEGIN_MARKER,
      '127.0.0.1 youtube.com',
      END_MARKER,
      '10.0.0.10 intranet.local',
      '',
    ].join('\n'),
    'utf8'
  );

  const result = await unblockAll({
    hostsPath,
    platform: 'linux',
  });

  assert.equal(result.applied, true);
  const contents = await readFile(hostsPath, 'utf8');
  assert.equal(contents.includes(BEGIN_MARKER), false);
  assert.equal(contents.includes(END_MARKER), false);
  assert.equal(contents.includes('127.0.0.1 localhost'), true);
  assert.equal(contents.includes('10.0.0.10 intranet.local'), true);
});

test('cleanupStaleBlocks removes stale managed section', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'hosts-manager-cleanup-'));
  const hostsPath = join(tempDir, 'hosts');

  await writeFile(
    hostsPath,
    [BEGIN_MARKER, '127.0.0.1 youtube.com', END_MARKER, ''].join('\n'),
    'utf8'
  );

  const result = await cleanupStaleBlocks({
    hostsPath,
    platform: 'linux',
  });

  assert.equal(result.applied, true);
  const contents = await readFile(hostsPath, 'utf8');
  assert.equal(contents.includes(BEGIN_MARKER), false);
});

test('stripDevSuiteHostsBlock is a no-op without markers', () => {
  const content = '127.0.0.1 localhost\n';
  assert.equal(stripDevSuiteHostsBlock(content), content);
});

test('blockDomains prefers installer helper when direct hosts write is denied', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'hosts-manager-helper-'));
  const hostsPath = join(tempDir, 'hosts');
  const helperDir = join(tempDir, 'DevSuite', 'hosts-helper');
  const requestPath = join(helperDir, 'request.json');
  const resultPath = join(helperDir, 'result.json');
  await mkdir(helperDir, { recursive: true });
  await writeFile(hostsPath, '127.0.0.1 localhost\n', 'utf8');

  const execCalls: string[][] = [];
  const writeFileMock = async (
    filePath: Parameters<typeof writeFile>[0],
    data: Parameters<typeof writeFile>[1],
    options?: Parameters<typeof writeFile>[2]
  ) => {
    if (filePath === hostsPath) {
      const deniedError = new Error('denied') as Error & { code?: string };
      deniedError.code = 'EPERM';
      throw deniedError;
    }

    return writeFile(filePath, data, options as never);
  };
  const execFileMock = async (
    file: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string }> => {
    execCalls.push([file, ...args]);
    if (file === 'schtasks' && args[0] === '/Run') {
      const request = JSON.parse(await readFile(requestPath, 'utf8')) as {
        requestId: string;
        encodedContents: string;
      };
      const helperContents = Buffer.from(
        request.encodedContents,
        'base64'
      ).toString('utf8');
      await writeFile(hostsPath, helperContents, 'utf8');
      await writeFile(
        resultPath,
        JSON.stringify({
          requestId: request.requestId,
          ok: true,
          error: null,
        }),
        'utf8'
      );
    }

    return {
      stdout: '',
      stderr: '',
    };
  };

  const result = await blockDomains(['youtube.com'], {
    hostsPath,
    platform: 'win32',
    programDataPath: tempDir,
    writeFile: writeFileMock as typeof writeFile,
    execFile: execFileMock as never,
  });

  assert.equal(result.applied, true);
  const contents = await readFile(hostsPath, 'utf8');
  assert.equal(contents.includes('youtube.com'), true);
  assert.equal(
    execCalls.some(call => call[0] === 'schtasks' && call[1] === '/Run'),
    true
  );
});

test('blockDomains fails gracefully when helper is unavailable', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'hosts-manager-helper-miss-'));
  const hostsPath = join(tempDir, 'hosts');
  await writeFile(hostsPath, '127.0.0.1 localhost\n', 'utf8');

  const execCalls: string[][] = [];
  const writeFileMock = async (
    filePath: Parameters<typeof writeFile>[0],
    data: Parameters<typeof writeFile>[1],
    options?: Parameters<typeof writeFile>[2]
  ) => {
    if (filePath === hostsPath) {
      const deniedError = new Error('denied') as Error & { code?: string };
      deniedError.code = 'EACCES';
      throw deniedError;
    }

    return writeFile(filePath, data, options as never);
  };
  const execFileMock = async (
    file: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string }> => {
    execCalls.push([file, ...args]);
    if (file === 'schtasks' && args[0] === '/Query') {
      throw new Error('task not found');
    }

    return {
      stdout: '',
      stderr: '',
    };
  };

  const result = await blockDomains(['youtube.com'], {
    hostsPath,
    platform: 'win32',
    programDataPath: tempDir,
    writeFile: writeFileMock as typeof writeFile,
    execFile: execFileMock as never,
  });

  assert.equal(result.applied, false);
  assert.equal(
    execCalls.some(call => call[0] === 'powershell'),
    false
  );
});
