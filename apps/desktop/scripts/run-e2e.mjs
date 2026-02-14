import { spawn } from 'node:child_process';
import process from 'node:process';

const allowNonWindows = process.env.DEVSUITE_E2E_ALLOW_NON_WINDOWS === '1';

if (process.platform !== 'win32' && !allowNonWindows) {
  console.log(
    '[desktop:e2e] Skipping WebdriverIO desktop E2E on non-Windows host. Set DEVSUITE_E2E_ALLOW_NON_WINDOWS=1 to force.'
  );
  process.exit(0);
}

const child = spawn('pnpm', ['exec', 'wdio', 'run', './wdio.e2e.conf.mjs'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', code => {
  process.exit(code ?? 1);
});

child.on('error', error => {
  console.error('[desktop:e2e] Failed to start WebdriverIO runner.', error);
  process.exit(1);
});
