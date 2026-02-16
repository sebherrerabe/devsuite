import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import bmp from 'bmp-js';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');
const faviconPath = join(__dirname, '..', '..', 'web', 'public', 'favicon.svg');
const renderSizes = [16, 32, 48, 256];

async function renderSvgToPng(svgBuffer, size) {
  return sharp(svgBuffer, { density: 512 }).resize(size, size).png().toBuffer();
}

async function createHeaderBmp(svgBuffer) {
  const width = 150;
  const height = 57;
  const logoSize = 40;
  const logo = await renderSvgToPng(svgBuffer, logoSize);
  const left = Math.round((width - logoSize) / 2);
  const top = Math.round((height - logoSize) / 2);

  const { data } = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#101823',
    },
  })
    .composite([{ input: logo, left, top }])
    .raw()
    .toBuffer({ resolveWithObject: true });

  const encoded = bmp.encode({ data, width, height });
  await writeFile(join(assetsDir, 'installer-header.bmp'), encoded.data);
}

async function createSidebarBmp(svgBuffer) {
  const width = 164;
  const height = 314;
  const logoSize = 64;
  const logo = await renderSvgToPng(svgBuffer, logoSize);
  const left = Math.round((width - logoSize) / 2);
  const top = 20;

  const { data } = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#101823',
    },
  })
    .composite([{ input: logo, left, top }])
    .raw()
    .toBuffer({ resolveWithObject: true });

  const encoded = bmp.encode({ data, width, height });
  await writeFile(join(assetsDir, 'installer-sidebar.bmp'), encoded.data);
}

export async function generateIcons() {
  const svgBuffer = await readFile(faviconPath);
  await mkdir(assetsDir, { recursive: true });

  const pngBuffers = await Promise.all(
    renderSizes.map(size => renderSvgToPng(svgBuffer, size))
  );

  const iconPng = pngBuffers[renderSizes.indexOf(256)];
  if (!iconPng) {
    throw new Error('Missing 256px icon render.');
  }

  await writeFile(join(assetsDir, 'icon.png'), iconPng);

  const icoBuffer = await pngToIco(pngBuffers);
  await writeFile(join(assetsDir, 'icon.ico'), icoBuffer);

  await createHeaderBmp(svgBuffer);
  await createSidebarBmp(svgBuffer);
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  generateIcons().catch(error => {
    console.error('[generate-icons] Failed to generate desktop assets.');
    console.error(error);
    process.exitCode = 1;
  });
}
