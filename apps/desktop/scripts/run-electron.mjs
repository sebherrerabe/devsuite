import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const electronModule = await import('electron');
const electronBinary = electronModule.default;
const currentFile = fileURLToPath(import.meta.url);
const scriptDir = dirname(currentFile);
const appEntry = join(scriptDir, '..', 'dist', 'main.js');

const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

const electronProcess = spawn(electronBinary, [appEntry], {
  stdio: 'inherit',
  env: childEnv,
});

electronProcess.on('exit', code => {
  process.exit(code ?? 0);
});

electronProcess.on('error', error => {
  console.error('[desktop] Failed to start Electron process.', error);
  process.exit(1);
});
