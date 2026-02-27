import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const desktopDir = join(__dirname, '..', '..');
const assetsDir = join(desktopDir, 'assets');

/** Read PNG dimensions from IHDR chunk (bytes 16-23). */
async function readPngDimensions(filePath: string) {
  const buf = await readFile(filePath);
  if (buf.length < 24) throw new Error('PNG too small');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

/** Read BMP dimensions from DIB header (bytes 18-25). */
async function readBmpDimensions(filePath: string) {
  const buf = await readFile(filePath);
  if (buf.length < 26) throw new Error('BMP too small');
  const width = buf.readInt32LE(18);
  const rawHeight = buf.readInt32LE(22);
  const height = Math.abs(rawHeight);
  return { width, height, rawHeight };
}

test('generateIcons writes desktop icon and installer bitmap assets', async () => {
  await execFileAsync('node', ['scripts/generate-icons.mjs'], {
    cwd: desktopDir,
  });

  const iconPngPath = join(assetsDir, 'icon.png');
  const iconIcoPath = join(assetsDir, 'icon.ico');
  const headerPath = join(assetsDir, 'installer-header.bmp');
  const sidebarPath = join(assetsDir, 'installer-sidebar.bmp');

  const iconPng = await readPngDimensions(iconPngPath);
  assert.equal(iconPng.width, 256);
  assert.equal(iconPng.height, 256);

  const header = await readBmpDimensions(headerPath);
  assert.equal(header.width, 150);
  assert.equal(header.height, 57);
  assert.ok(header.rawHeight > 0);

  const sidebar = await readBmpDimensions(sidebarPath);
  assert.equal(sidebar.width, 164);
  assert.equal(sidebar.height, 314);
  assert.ok(sidebar.rawHeight > 0);

  const iconIco = await stat(iconIcoPath);
  assert.ok(iconIco.isFile());
  assert.ok(iconIco.size > 0);
});
