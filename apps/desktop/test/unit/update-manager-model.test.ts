import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_DESKTOP_AUTO_UPDATE_PREFERENCES,
  coerceReleaseNotesText,
  deriveDesktopUpdaterState,
  parseDesktopAutoUpdatePreferences,
  shouldPerformUpdateCheck,
} from '../../src/update-manager-model.js';

test('parseDesktopAutoUpdatePreferences falls back for malformed values', () => {
  assert.deepEqual(parseDesktopAutoUpdatePreferences(undefined), {
    ...DEFAULT_DESKTOP_AUTO_UPDATE_PREFERENCES,
  });

  assert.deepEqual(
    parseDesktopAutoUpdatePreferences({
      consent: 'invalid',
      consentUpdatedAt: 'nope',
      dismissedReadyVersion: '  ',
    }),
    {
      ...DEFAULT_DESKTOP_AUTO_UPDATE_PREFERENCES,
    }
  );
});

test('deriveDesktopUpdaterState exposes awaiting_consent only for the idle unset baseline', () => {
  assert.deepEqual(
    deriveDesktopUpdaterState({
      currentVersion: '0.5.0',
      consent: 'unset',
      lifecycleStatus: 'idle',
      sessionStatus: 'IDLE',
      lastCheckedAt: null,
      availableVersion: null,
      downloadedVersion: null,
      releaseNotes: null,
      error: null,
    }),
    {
      status: 'awaiting_consent',
      currentVersion: '0.5.0',
      consent: 'unset',
      lastCheckedAt: null,
      availableVersion: null,
      downloadedVersion: null,
      releaseNotes: null,
      error: null,
      deferredUntilSessionEnd: false,
    }
  );

  assert.deepEqual(
    deriveDesktopUpdaterState({
      currentVersion: '0.5.0',
      consent: 'unset',
      lifecycleStatus: 'available',
      sessionStatus: 'IDLE',
      lastCheckedAt: 100,
      availableVersion: '0.6.0',
      downloadedVersion: null,
      releaseNotes: 'Bug fixes',
      error: null,
    }),
    {
      status: 'available',
      currentVersion: '0.5.0',
      consent: 'unset',
      lastCheckedAt: 100,
      availableVersion: '0.6.0',
      downloadedVersion: null,
      releaseNotes: 'Bug fixes',
      error: null,
      deferredUntilSessionEnd: false,
    }
  );
});

test('deriveDesktopUpdaterState defers downloaded prompts while the session is running', () => {
  assert.equal(
    deriveDesktopUpdaterState({
      currentVersion: '0.5.0',
      consent: 'enabled',
      lifecycleStatus: 'downloaded',
      sessionStatus: 'RUNNING',
      lastCheckedAt: 100,
      availableVersion: '0.6.0',
      downloadedVersion: '0.6.0',
      releaseNotes: 'Ready',
      error: null,
    }).deferredUntilSessionEnd,
    true
  );

  assert.equal(
    deriveDesktopUpdaterState({
      currentVersion: '0.5.0',
      consent: 'enabled',
      lifecycleStatus: 'downloaded',
      sessionStatus: 'PAUSED',
      lastCheckedAt: 100,
      availableVersion: '0.6.0',
      downloadedVersion: '0.6.0',
      releaseNotes: 'Ready',
      error: null,
    }).deferredUntilSessionEnd,
    false
  );
});

test('coerceReleaseNotesText normalizes string and array payloads', () => {
  assert.equal(coerceReleaseNotesText('  Notes here  '), 'Notes here');
  assert.equal(
    coerceReleaseNotesText([
      { note: 'First section' },
      { note: 'Second section' },
      { ignored: true },
    ]),
    'First section\n\nSecond section'
  );
  assert.equal(coerceReleaseNotesText([{ ignored: true }]), null);
});

test('shouldPerformUpdateCheck respects consent and minimum interval', () => {
  assert.equal(
    shouldPerformUpdateCheck({
      consent: 'disabled',
      lastCheckedAt: null,
      minimumIntervalMs: 1_000,
      nowMs: 5_000,
    }),
    false
  );

  assert.equal(
    shouldPerformUpdateCheck({
      consent: 'enabled',
      lastCheckedAt: null,
      minimumIntervalMs: 1_000,
      nowMs: 5_000,
    }),
    true
  );

  assert.equal(
    shouldPerformUpdateCheck({
      consent: 'enabled',
      lastCheckedAt: 4_500,
      minimumIntervalMs: 1_000,
      nowMs: 5_000,
    }),
    false
  );

  assert.equal(
    shouldPerformUpdateCheck({
      consent: 'enabled',
      lastCheckedAt: 3_000,
      minimumIntervalMs: 1_000,
      nowMs: 5_000,
    }),
    true
  );
});
