import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
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
