import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import bmp from 'bmp-js';
import sharp from 'sharp';

import { generateIcons } from '../../scripts/generate-icons.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsDir = join(__dirname, '..', '..', 'assets');

async function readDimensions(filePath: string) {
  const metadata = await sharp(filePath).metadata();
  return { width: metadata.width, height: metadata.height };
}

async function readBmpDimensions(filePath: string) {
  const buffer = await readFile(filePath);
  const decoded = bmp.decode(buffer);
  return { width: decoded.width, height: decoded.height };
}

test('generateIcons writes desktop icon and installer bitmap assets', async () => {
  await generateIcons();

  const iconPngPath = join(assetsDir, 'icon.png');
  const iconIcoPath = join(assetsDir, 'icon.ico');
  const headerPath = join(assetsDir, 'installer-header.bmp');
  const sidebarPath = join(assetsDir, 'installer-sidebar.bmp');

  const iconPng = await readDimensions(iconPngPath);
  assert.equal(iconPng.width, 256);
  assert.equal(iconPng.height, 256);

  const header = await readBmpDimensions(headerPath);
  assert.equal(header.width, 150);
  assert.equal(header.height, 57);

  const sidebar = await readBmpDimensions(sidebarPath);
  assert.equal(sidebar.width, 164);
  assert.equal(sidebar.height, 314);

  const iconIco = await stat(iconIcoPath);
  assert.ok(iconIco.isFile());
  assert.ok(iconIco.size > 0);
});
