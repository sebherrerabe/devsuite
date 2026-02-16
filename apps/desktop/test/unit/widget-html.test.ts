import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionWidgetHtml } from '../../src/session-widget-html.js';

test('createSessionWidgetHtml returns expected CSS tokens and markup skeleton', () => {
  const html = createSessionWidgetHtml();

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /--primary:\s*#22d3ee/i);
  assert.match(html, /--card:\s*#111827/i);
  assert.match(html, /id="statusBadge"/);
  assert.match(html, /class="close-btn"/);
});

test('widget html includes contextual button rendering logic', () => {
  const html = createSessionWidgetHtml();

  assert.match(html, /function renderButtons\(state\)/);
  assert.match(html, /state\.status === 'IDLE'/);
  assert.match(html, /state\.status === 'RUNNING'/);
  assert.match(html, /state\.status === 'PAUSED'/);
  assert.match(
    html,
    /endButton\.style\.display = state\.status === 'IDLE' \? 'none' : 'inline-flex'/
  );
});

test('widget html includes badge rendering classes for each status', () => {
  const html = createSessionWidgetHtml();

  assert.match(html, /function renderBadge\(status\)/);
  assert.match(html, /badge--running/);
  assert.match(html, /badge--paused/);
  assert.match(html, /badge--idle/);
});
