import { cp, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistPath = resolve(__dirname, '..', '..', 'web', 'dist');
const rendererPath = resolve(__dirname, '..', 'renderer');

async function ensureWebDistExists() {
  try {
    const stats = await stat(webDistPath);
    if (!stats.isDirectory()) {
      throw new Error('not a directory');
    }
  } catch {
    throw new Error(
      `[copy-renderer] Missing web build output at "${webDistPath}". Run "pnpm --filter @devsuite/web build" first.`
    );
  }
}

async function main() {
  await ensureWebDistExists();
  await cp(webDistPath, rendererPath, { recursive: true, force: true });
  console.log(`[copy-renderer] Copied "${webDistPath}" -> "${rendererPath}".`);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
