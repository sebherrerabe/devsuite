import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DESKTOP_WINDOW_CLOSE_CHANNEL,
  DESKTOP_WINDOW_IS_MAXIMIZED_CHANNEL,
  DESKTOP_WINDOW_MAXIMIZE_CHANNEL,
  DESKTOP_WINDOW_MAXIMIZE_CHANGED_CHANNEL,
  DESKTOP_WINDOW_MINIMIZE_CHANNEL,
  registerDesktopWindowIpcHandlers,
  wireDesktopWindowMaximizeEvents,
} from '../../src/window-controls-ipc.js';

test('desktop window IPC handlers map to BrowserWindow methods', async () => {
  const handlers = new Map<string, (event: unknown) => unknown>();

  const ipcMain = {
    handle: (channel: string, handler: (event: unknown) => unknown) => {
      handlers.set(channel, handler);
    },
  };

  let maximized = false;
  let minimizedCalls = 0;
  let closedCalls = 0;
  let maximizeCalls = 0;
  let unmaximizeCalls = 0;

  const browserWindowModule = {
    fromWebContents: () => ({
      minimize: () => {
        minimizedCalls += 1;
      },
      maximize: () => {
        maximizeCalls += 1;
        maximized = true;
      },
      unmaximize: () => {
        unmaximizeCalls += 1;
        maximized = false;
      },
      close: () => {
        closedCalls += 1;
      },
      isMaximized: () => maximized,
    }),
  };

  registerDesktopWindowIpcHandlers({
    ipcMain: ipcMain as never,
    browserWindowModule,
  });

  await handlers.get(DESKTOP_WINDOW_MINIMIZE_CHANNEL)?.({ sender: {} });
  await handlers.get(DESKTOP_WINDOW_MAXIMIZE_CHANNEL)?.({ sender: {} });
  await handlers.get(DESKTOP_WINDOW_MAXIMIZE_CHANNEL)?.({ sender: {} });
  await handlers.get(DESKTOP_WINDOW_CLOSE_CHANNEL)?.({ sender: {} });

  const isMaximized = await handlers.get(DESKTOP_WINDOW_IS_MAXIMIZED_CHANNEL)?.(
    { sender: {} }
  );

  assert.equal(minimizedCalls, 1);
  assert.equal(maximizeCalls, 1);
  assert.equal(unmaximizeCalls, 1);
  assert.equal(closedCalls, 1);
  assert.equal(isMaximized, false);
});

test('wireDesktopWindowMaximizeEvents broadcasts maximize state changes', () => {
  let onMaximize: (() => void) | null = null;
  let onUnmaximize: (() => void) | null = null;
  const sent: Array<{ channel: string; payload: boolean }> = [];

  const win = {
    on: (event: string, listener: () => void) => {
      if (event === 'maximize') {
        onMaximize = listener;
      }
      if (event === 'unmaximize') {
        onUnmaximize = listener;
      }
    },
    webContents: {
      send: (channel: string, payload: boolean) => {
        sent.push({ channel, payload });
      },
    },
  };

  wireDesktopWindowMaximizeEvents({
    window: win as never,
  });

  onMaximize?.();
  onUnmaximize?.();

  assert.deepEqual(sent, [
    {
      channel: DESKTOP_WINDOW_MAXIMIZE_CHANGED_CHANNEL,
      payload: true,
    },
    {
      channel: DESKTOP_WINDOW_MAXIMIZE_CHANGED_CHANNEL,
      payload: false,
    },
  ]);
});
