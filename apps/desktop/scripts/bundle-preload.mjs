/**
 * Bundle the preload script into a single CommonJS file.
 *
 * Electron's sandboxed preload environment provides a polyfilled `require` that
 * can only load a handful of built-in modules (`electron`, `events`, `timers`,
 * `url`).  It cannot resolve local file imports.  The ESM `import` statement is
 * not supported at all in sandboxed preloads (regardless of package.json type).
 *
 * To work around this, we use esbuild to bundle every local import into one
 * self-contained CJS file and mark `electron` as external so the sandboxed
 * `require('electron')` shim is used at runtime.
 */

import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

await build({
  entryPoints: [join(projectRoot, 'src', 'preload.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  outfile: join(projectRoot, 'dist', 'preload.js'),
  external: ['electron'],
  // Silence warnings about `process` / `__dirname` since Electron's sandboxed
  // preload polyfills them.
  logLevel: 'warning',
});
