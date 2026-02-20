import type { DesktopSessionState } from './session-control.js';

export const TIMER_JUMP_THRESHOLD_MS = 2_000;
export const TIMER_SMOOTHING_DURATION_MS = 1_000;
export const TIMER_SMOOTHING_ALPHA = 0.15;

export interface TimerSmoothingState {
  displayedMs: number;
  targetMs: number;
  smoothingUntilMs: number;
}

export function calculateWidgetEffectiveDuration(params: {
  state: DesktopSessionState;
  nowMs: number;
}): number {
  const base = Number.isFinite(params.state.effectiveDurationMs)
    ? Math.max(0, Math.trunc(params.state.effectiveDurationMs))
    : 0;

  if (params.state.status !== 'RUNNING') {
    return base;
  }

  if (params.state.connectionState !== 'connected') {
    return base;
  }

  if (params.state.recordingIDE) {
    return base;
  }

  const publishedAt = params.state.publishedAt ?? params.state.updatedAt;
  return base + Math.max(0, params.nowMs - publishedAt);
}

export function smoothWidgetTimerTick(params: {
  state: TimerSmoothingState;
  rawMs: number;
  nowMs: number;
}): TimerSmoothingState {
  const jump = Math.abs(params.rawMs - params.state.displayedMs);
  let nextDisplayedMs = params.state.displayedMs;
  let nextTargetMs = params.state.targetMs;
  let nextSmoothingUntilMs = params.state.smoothingUntilMs;

  if (
    jump > TIMER_JUMP_THRESHOLD_MS &&
    nextSmoothingUntilMs > 0 &&
    params.nowMs < nextSmoothingUntilMs + 2_000
  ) {
    nextTargetMs = params.rawMs;
  } else if (jump > TIMER_JUMP_THRESHOLD_MS) {
    nextTargetMs = params.rawMs;
    nextSmoothingUntilMs = params.nowMs + TIMER_SMOOTHING_DURATION_MS;
  } else {
    nextDisplayedMs = params.rawMs;
    nextTargetMs = params.rawMs;
  }

  if (params.nowMs < nextSmoothingUntilMs) {
    nextDisplayedMs += (nextTargetMs - nextDisplayedMs) * TIMER_SMOOTHING_ALPHA;
  } else {
    nextDisplayedMs = nextTargetMs;
  }

  return {
    displayedMs: Math.max(0, nextDisplayedMs),
    targetMs: Math.max(0, nextTargetMs),
    smoothingUntilMs: Math.max(0, nextSmoothingUntilMs),
  };
}
