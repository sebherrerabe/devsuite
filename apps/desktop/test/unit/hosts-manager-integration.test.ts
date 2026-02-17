import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { blockDomains, reconcileDomains } from '../../src/hosts-manager.js';

test('blockDomains triggers DNS flush command when applied', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'hosts-manager-int-'));
  const hostsPath = join(tempDir, 'hosts');
  await writeFile(hostsPath, '127.0.0.1 localhost\n', 'utf8');

  const commands: Array<{ command: string; args: string[] }> = [];

  const result = await blockDomains(['youtube.com'], {
    hostsPath,
    platform: 'win32',
    execFile: (async (command, args) => {
      commands.push({
        command,
        args: args as string[],
      });
      return {
        stdout: '',
        stderr: '',
      };
    }) as Parameters<typeof blockDomains>[1]['execFile'],
  });

  assert.equal(result.applied, true);
  assert.equal(
    commands.some(
      entry => entry.command === 'ipconfig' && entry.args[0] === '/flushdns'
    ),
    true
  );

  const contents = await readFile(hostsPath, 'utf8');
  assert.equal(contents.includes('youtube.com'), true);
});

test('reconcileDomains no-ops when domain sets are unchanged', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'hosts-manager-reconcile-'));
  const hostsPath = join(tempDir, 'hosts');
  await writeFile(hostsPath, '127.0.0.1 localhost\n', 'utf8');

  const result = await reconcileDomains({
    currentDomains: ['youtube.com'],
    newDomains: ['YouTube.com'],
    options: {
      hostsPath,
      platform: 'linux',
    },
  });

  assert.equal(result.applied, false);
});

test('reconcileDomains removes managed hosts block when new domain list is empty', async () => {
  const tempDir = await mkdtemp(
    join(tmpdir(), 'hosts-manager-reconcile-empty-')
  );
  const hostsPath = join(tempDir, 'hosts');
  await writeFile(
    hostsPath,
    [
      '127.0.0.1 localhost',
      '# BEGIN DEVSUITE BLOCK',
      '127.0.0.1 youtube.com',
      '127.0.0.1 www.youtube.com',
      '# END DEVSUITE BLOCK',
      '',
    ].join('\n'),
    'utf8'
  );

  const result = await reconcileDomains({
    currentDomains: ['youtube.com'],
    newDomains: [],
    options: {
      hostsPath,
      platform: 'linux',
    },
  });

  assert.equal(result.applied, true);
  const contents = await readFile(hostsPath, 'utf8');
  assert.equal(contents.includes('# BEGIN DEVSUITE BLOCK'), false);
  assert.equal(contents.includes('youtube.com'), false);
  assert.equal(contents.includes('127.0.0.1 localhost'), true);
});
