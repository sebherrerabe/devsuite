import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const bmp = require('bmp-js');
const pngToIco = require('png-to-ico');
const sharp = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');
const faviconPath = join(__dirname, '..', '..', 'web', 'public', 'favicon.svg');
const renderSizes = [16, 32, 48, 256];

async function renderSvgToPng(svgBuffer, size) {
  return sharp(svgBuffer, { density: 512 }).resize(size, size).png().toBuffer();
}

function toBottomUpBmp(encodedBuffer, width, height) {
  const headerSize = 54;
  const rowPaddingBytes = width % 4;
  const rowSize = width * 3 + rowPaddingBytes;
  const pixelDataSize = rowSize * height;

  if (encodedBuffer.length < headerSize + pixelDataSize) {
    throw new Error('Encoded BMP is too small for expected dimensions.');
  }

  const output = Buffer.from(encodedBuffer);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = headerSize + y * rowSize;
    const targetStart = headerSize + (height - 1 - y) * rowSize;
    encodedBuffer.copy(output, targetStart, sourceStart, sourceStart + rowSize);
  }

  output.writeInt32LE(height, 22);
  return output;
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
  await writeFile(
    join(assetsDir, 'installer-header.bmp'),
    toBottomUpBmp(encoded.data, width, height)
  );
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
  await writeFile(
    join(assetsDir, 'installer-sidebar.bmp'),
    toBottomUpBmp(encoded.data, width, height)
  );
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
