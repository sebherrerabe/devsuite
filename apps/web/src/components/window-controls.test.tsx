import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { WindowControls } from './window-controls';
import {
  getMaximizeButtonAriaLabel,
  resolveDesktopWindowApi,
  triggerWindowAction,
} from './window-controls-helpers';

function setRuntimeWindow(value: Window & typeof globalThis): void {
  Object.defineProperty(globalThis, 'window', {
    value,
    configurable: true,
    writable: true,
  });
}

function clearRuntimeWindow(): void {
  Reflect.deleteProperty(globalThis, 'window');
}

test('WindowControls renders minimize/maximize/close buttons when desktop API exists', () => {
  const previousWindow = globalThis.window;
  const runtimeWindow = {
    desktopWindow: {
      minimize: async () => undefined,
      maximize: async () => undefined,
      close: async () => undefined,
      isMaximized: async () => false,
      onMaximizeChange: () => () => undefined,
    },
  } as unknown as Window & typeof globalThis;
  setRuntimeWindow(runtimeWindow);

  try {
    const html = renderToStaticMarkup(React.createElement(WindowControls));
    assert.match(html, /aria-label="Minimize window"/);
    assert.match(html, /aria-label="Maximize window"/);
    assert.match(html, /aria-label="Close window"/);
  } finally {
    if (previousWindow === undefined) {
      clearRuntimeWindow();
    } else {
      setRuntimeWindow(previousWindow);
    }
  }
});

test('WindowControls does not render in web-only mode', () => {
  const previousWindow = globalThis.window;
  clearRuntimeWindow();

  try {
    const html = renderToStaticMarkup(React.createElement(WindowControls));
    assert.equal(html, '');
  } finally {
    if (previousWindow !== undefined) {
      setRuntimeWindow(previousWindow);
    }
  }
});

test('resolveDesktopWindowApi and triggerWindowAction invoke desktop window controls', async () => {
  let minimized = false;
  const runtimeWindow = {
    desktopWindow: {
      minimize: async () => {
        minimized = true;
      },
      maximize: async () => undefined,
      close: async () => undefined,
      isMaximized: async () => false,
      onMaximizeChange: () => () => undefined,
    },
  } as unknown as Window & typeof globalThis;

  const api = resolveDesktopWindowApi(runtimeWindow);
  assert.ok(api);

  await triggerWindowAction({
    api,
    action: 'minimize',
  });

  assert.equal(minimized, true);
});

test('maximize button label toggles for maximize and restore states', () => {
  assert.equal(getMaximizeButtonAriaLabel(false), 'Maximize window');
  assert.equal(getMaximizeButtonAriaLabel(true), 'Restore window');
});
