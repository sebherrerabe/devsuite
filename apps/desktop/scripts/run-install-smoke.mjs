import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.log(
    '[desktop:install-smoke] Skipping installer smoke test on non-Windows host.'
  );
  process.exit(0);
}

const currentFile = fileURLToPath(import.meta.url);
const scriptDir = dirname(currentFile);
const smokeScriptPath = join(scriptDir, 'install-smoke.ps1');

const child = spawn(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    smokeScriptPath,
  ],
  {
    stdio: 'inherit',
    env: process.env,
  }
);

child.on('exit', code => {
  process.exit(code ?? 1);
});

child.on('error', error => {
  console.error('[desktop:install-smoke] Failed to run smoke script.', error);
  process.exit(1);
});
