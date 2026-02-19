import assert from 'node:assert/strict';
import test from 'node:test';

import { isElectronDesktopContext } from './desktop-context-detection';

test('isElectronDesktopContext: returns false when window is undefined', () => {
  const g = globalThis as { window?: unknown };
  const orig = g.window;
  delete g.window;
  try {
    assert.equal(isElectronDesktopContext(), false);
  } finally {
    if (orig !== undefined) g.window = orig;
  }
});

test('isElectronDesktopContext: returns false when desktopNotification is absent', () => {
  const g = globalThis as { window?: unknown };
  const orig = g.window;
  g.window = {};
  try {
    assert.equal(isElectronDesktopContext(), false);
  } finally {
    g.window = orig;
  }
});

test('isElectronDesktopContext: returns true when desktopNotification is present (Electron path)', () => {
  const g = globalThis as { window?: unknown };
  const orig = g.window;
  g.window = {
    desktopNotification: {
      emit: async () => ({ delivered: true, throttled: false }),
    },
  };
  try {
    assert.equal(isElectronDesktopContext(), true);
  } finally {
    g.window = orig;
  }
});
