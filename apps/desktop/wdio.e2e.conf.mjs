import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = dirname(currentFile);
const fixtureDir = join(projectRoot, 'test', 'fixtures');
const userDataDir = join(projectRoot, '.tmp', 'wdio-user-data');
const appEntryPointPath = join(projectRoot, 'dist', 'main.js');

const fixtureFiles = [
  'desktop-session-scope.json',
  'desktop-focus-settings.json',
];

const bootstrapHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevSuite Desktop E2E</title>
  </head>
  <body>
    <main id="ready">Desktop E2E Runtime</main>
    <script>
      (function setupE2ESessionBridge() {
        const scope = { userId: 'e2e-user', companyId: 'e2e-company' };
        const state = {
          status: 'IDLE',
          sessionId: null,
          effectiveDurationMs: 0,
          remainingTaskCount: 0,
          connectionState: 'connected',
          lastError: null,
          updatedAt: Date.now(),
        };
        let sessionCounter = 1;

        async function publishState() {
          if (!window.desktopSession) {
            return;
          }

          state.updatedAt = Date.now();
          await window.desktopSession.publishState(scope, state);
        }

        function handleCommand(command) {
          if (!command || !command.action) {
            return;
          }

          if (command.action === 'start' && state.status === 'IDLE') {
            state.status = 'RUNNING';
            state.sessionId = 'e2e-session-' + sessionCounter;
            sessionCounter += 1;
            return;
          }

          if (command.action === 'pause' && state.status === 'RUNNING') {
            state.status = 'PAUSED';
            return;
          }

          if (command.action === 'resume' && state.status === 'PAUSED') {
            state.status = 'RUNNING';
            return;
          }

          if (command.action === 'end' && state.status !== 'IDLE') {
            state.status = 'IDLE';
            state.sessionId = null;
            state.remainingTaskCount = 0;
          }
        }

        window.addEventListener('DOMContentLoaded', function onReady() {
          if (!window.desktopSession) {
            return;
          }

          window.desktopSession.onCommand(async command => {
            if (
              !command ||
              !command.scope ||
              command.scope.userId !== scope.userId ||
              command.scope.companyId !== scope.companyId
            ) {
              return;
            }

            handleCommand(command);
            await publishState();
          });

          void publishState();
        });
      })();
    </script>
  </body>
</html>`;

process.env.DEVSUITE_DESKTOP_USER_DATA_PATH = userDataDir;
process.env.DEVSUITE_WEB_URL = `data:text/html;charset=utf-8,${encodeURIComponent(
  bootstrapHtml
)}#devsuite-e2e`;
process.env.DEVSUITE_DESKTOP_DISABLE_GPU = '1';
process.env.DEVSUITE_DESKTOP_ENABLE_TEST_IPC = '1';

async function seedFixtureUserData() {
  await rm(userDataDir, { recursive: true, force: true });
  await mkdir(userDataDir, { recursive: true });

  for (const fixtureFile of fixtureFiles) {
    await copyFile(
      join(fixtureDir, fixtureFile),
      join(userDataDir, fixtureFile)
    );
  }
}

export const config = {
  runner: 'local',
  specs: ['./test/e2e/**/*.e2e.mjs'],
  maxInstances: 1,
  logLevel: 'info',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 90_000,
  },
  autoXvfb: true,
  services: ['electron'],
  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        // Use appEntryPoint (not appBinaryPath) so the service launches the
        // locally-installed Electron binary with our main.js as the entry
        // point.  appBinaryPath is for packaged apps where the binary already
        // contains the app code.
        appEntryPoint: appEntryPointPath,
        appArgs: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        // Give the CDP bridge enough time to connect on cold Windows startup.
        // Default is 10 000 ms which is too tight for first-run or CI.
        cdpBridgeTimeout: 30_000,
      },
    },
  ],
  onPrepare: async function () {
    await seedFixtureUserData();
  },
};
