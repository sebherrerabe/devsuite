#!/usr/bin/env node
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const requiredAssets = [
  'assets/icon.ico',
  'assets/icon.png',
  'assets/installer-header.bmp',
  'assets/installer-sidebar.bmp',
];

async function verifyAsset(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  const metadata = await stat(absolutePath);
  if (!metadata.isFile()) {
    throw new Error(`${relativePath} is not a file.`);
  }
  if (metadata.size <= 0) {
    throw new Error(`${relativePath} is empty.`);
  }
}

async function main() {
  for (const asset of requiredAssets) {
    await verifyAsset(asset);
  }

  console.log(
    `[desktop] verified build assets (${requiredAssets.length} files)`
  );
}

main().catch(error => {
  console.error('[desktop] missing/invalid build asset:', error.message);
  process.exitCode = 1;
});
