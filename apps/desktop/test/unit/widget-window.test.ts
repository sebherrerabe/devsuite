import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBottomRightWidgetPosition,
  getSessionWidgetWindowOptions,
} from '../../src/widget-window.js';

test('getSessionWidgetWindowOptions configures frameless transparent overlay widget', () => {
  const options = getSessionWidgetWindowOptions({
    iconPath: 'icon.png',
    preloadPath: 'preload.js',
    partition: 'persist:devsuite',
    additionalArguments: ['--x'],
  });

  assert.equal(options.frame, false);
  assert.equal(options.transparent, true);
  assert.equal(options.alwaysOnTop, true);
  assert.equal(options.skipTaskbar, true);
  assert.equal(options.backgroundColor, '#00000000');
  assert.equal(options.width, 320);
  assert.equal(options.height, 220);
});

test('getBottomRightWidgetPosition computes expected bottom-right placement', () => {
  const position = getBottomRightWidgetPosition({
    workAreaSize: { width: 1920, height: 1080 },
    windowSize: [320, 220],
  });

  assert.deepEqual(position, {
    x: 1584,
    y: 844,
  });
});
