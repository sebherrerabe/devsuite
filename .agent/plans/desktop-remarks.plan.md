---
name: Desktop UX + Enforcement Remediation Plan
overview: 'Address desktop/web UX regressions and enforcement reliability in 7 phases: (0) log-backed triage baseline, (1) desktop settings information architecture + modern inputs, (2) session widget reliability and UX polish, (3) website/app blocking reliability fixes (hosts + process policy), (4) notification click routing matrix for desktop and web, (5) task details panel rerender/scroll preservation, (6) background app branding/icon verification and packaging hardening, then (7) end-to-end regression verification. Use existing AppData logs as evidence and keep changes tenant-safe.'
todos:
  - id: p0-log-triage-baseline
    content: '[Phase 0] Capture AppData evidence baseline from desktop-runtime.log and debug.log; map each remark to reproducible signal and affected code path.'
    status: completed
  - id: p1-settings-ia-split
    content: '[Phase 1] Move desktop-only controls out of Profile into a dedicated Desktop settings tab/page; hide desktop controls in web-only runtime.'
    status: pending
  - id: p1-modern-desktop-form
    content: '[Phase 1] Redesign desktop settings inputs to modern interaction patterns (chips, command pickers, segmented controls, improved numeric controls) while keeping existing saved shape.'
    status: pending
  - id: p2-widget-stays-open
    content: '[Phase 2] Fix companion behavior so start session does not close the widget when connection briefly transitions; widget remains transparent/static until explicit user close.'
    status: pending
  - id: p2-widget-timer-sync
    content: '[Phase 2] Stabilize widget timer updates and remove jitter/resets; add drift detection telemetry and tests.'
    status: pending
  - id: p2-widget-layout-and-content
    content: '[Phase 2] Resolve control overflow, resize constraints, and replace connection/session debug strings with useful session context.'
    status: pending
  - id: p3-hosts-elevation-fix
    content: '[Phase 3] Repair Windows elevated hosts write command path so website blocks are actually enforced (youtube/x in Edge included).'
    status: pending
  - id: p3-app-block-reliability
    content: '[Phase 3] Restore reliable distractor app enforcement for whatsapp.root.exe with clear notifications and taskkill behavior during active sessions.'
    status: pending
  - id: p3-policy-dedupe
    content: '[Phase 3] Dedupe strict-policy notifications/actions by executable/session tick to prevent burst spam and repeated companion opens.'
    status: pending
  - id: p4-notification-routing-matrix
    content: '[Phase 4] Define and implement a single routing matrix for every notification type/source (desktop strict-policy + inbox web/push) to land users on relevant in-app targets.'
    status: pending
  - id: p4-notification-routing-tests
    content: '[Phase 4] Add unit/integration coverage for notification action parsing, route resolution, and desktop/web click behavior.'
    status: pending
  - id: p5-task-panel-scroll-preservation
    content: '[Phase 5] Prevent task detail panel full remount and preserve scroll position when switching task details (web + desktop shell).'
    status: pending
  - id: p6-background-logo-hardening
    content: '[Phase 6] Verify and harden background-process branding/icon behavior for packaged Windows app and startup mode.'
    status: pending
  - id: p7-regression-suite
    content: '[Phase 7] Run lint/typecheck + desktop unit/e2e smoke checks covering widget, blocking, notification routing, and task panel behavior.'
    status: pending
isProject: false
---

# Desktop UX + Enforcement Remediation Plan

## Evidence Baseline (AppData Logs)

Source logs:

- `C:\Users\sebas\AppData\Roaming\DevSuite\logs\desktop-runtime.log`
- `C:\Users\sebas\AppData\Roaming\devsuite-desktop\debug.log`

Validated signals to drive this plan:

1. Website blocking failure is reproducible in current runtime:

- `desktop-runtime.log` around `2026-02-17T20:55:15Z` shows hosts block attempt for `youtube.com,x.com`, then elevated command failure.
- Failure includes malformed elevated command execution (`Start-Process ...` argument parsing), causing fallback to notification-only mode.

1. Notification burst behavior exists and is excessive:

- `desktop-runtime.log` contains `458` `Sending notification` entries.
- Same throttle key repeated dozens of times in a single second (for example `...:ide:cursor.exe:initial` repeated >30x).

1. Session widget close behavior conflicts with expected UX:

- `apps/desktop/src/main.ts:1472` closes widget whenever `connectionState !== 'connected'` during published state updates.
- This is consistent with start/transition moments where brief `syncing` states occur.

1. Widget metadata still shows technical debug strings:

- `apps/desktop/src/session-widget-html.ts:195` and `apps/desktop/src/session-widget-html.ts:279` render `connection=` and `session=` strings.

1. Blocking/closure behavior has mixed historical evidence:

- Earlier entries show successful `taskkill` on `whatsapp.root.exe`.
- More recent entries show many IDE-related kills and notification bursts, indicating policy noise/deduping problems and need to verify active-session gates.

1. Current web settings placement confirms desktop controls in Profile:

- `apps/web/src/routes/_app.settings.profile.tsx` currently hosts desktop focus/runtime controls.
- `apps/web/src/routes/_app.settings.tsx` has no dedicated Desktop tab.

1. Task detail remount risk is present:

- `apps/web/src/components/task-detail.tsx:158` sets `key={task._id}` on `TaskDetailContent`, forcing remount and resetting local scroll/UI state on task switch.

## Scope Mapping to User Remarks

1. Desktop options visible in Profile/web UI + old-fashioned inputs.
2. Missing logo for background app process.
3. Session widget timer sync issues + control overflow.
4. Session widget disappears after Start Session; should remain visible until closed.
5. Remove low-value `connection/session` debug text, show better session context.
6. Blocked websites (example: YouTube in Edge) still accessible.
7. `whatsapp.root.exe` no longer closes reliably during active session.
8. Notification clicks should route to relevant app destination for all types (desktop + web).
9. Task detail switching should not reset panel scroll by remounting.

## Phase Plan

## Phase 1: Desktop Settings IA + Modern Inputs

Files in scope:

- `apps/web/src/routes/_app.settings.tsx`
- `apps/web/src/routes/_app.settings.index.tsx`
- `apps/web/src/routes/_app.settings.profile.tsx`
- `apps/web/src/routes/_app.settings.desktop.tsx` (new)
- `apps/web/src/routeTree.gen.ts` (generated)

Work:

- Create dedicated `/settings/desktop` route and nav item.
- Keep Profile focused on user/account preferences only.
- Gate desktop-only controls behind runtime capability checks and avoid showing enforcement controls in pure web runtime.
- Modernize form controls:
  - executable lists as chips + command-style picker
  - segmented controls for strict/app/website action modes
  - compact number inputs with suffix/helper text
  - clearer field grouping and sticky save bar

Acceptance:

- Desktop settings no longer appear in Profile.
- Web-only runtime does not expose desktop enforcement controls.
- Existing persisted settings shape remains backward-compatible.

## Phase 2: Session Widget Reliability + UX

Files in scope:

- `apps/desktop/src/main.ts`
- `apps/desktop/src/session-widget-html.ts`
- `apps/desktop/src/widget-window.ts`
- `apps/desktop/test/unit/widget-html.test.ts`
- `apps/desktop/test/unit/session-bridge-logging.test.ts`

Work:

- Remove/replace close-on-syncing behavior in `desktop-session:publish-state` path.
- Keep widget open across start/pause/resume state transitions; user closes explicitly.
- Rework widget content priorities:
  - replace `connection/session` debug strings with actionable items (active task count, focus mode, last sync age)
  - add layout constraints to prevent action button overflow
  - tune window size and responsive button modes for running state
- Harden timer rendering path:
  - ensure monotonic display with bounded drift correction
  - maintain smooth transitions on publish bursts or delayed sync

Acceptance:

- Start Session no longer hides companion widget.
- Controls never overflow in RUNNING state at standard DPI scales.
- Timer advances continuously without visible 2-3-4-second loop artifacts.

## Phase 3: Enforcement Reliability (Websites + Apps)

Files in scope:

- `apps/desktop/src/hosts-manager.ts`
- `apps/desktop/src/main.ts`
- `apps/desktop/src/strict-policy-engine.ts`
- `apps/desktop/src/strict-policy-actions.ts`
- `apps/desktop/src/process-monitor.ts`
- `apps/desktop/test/unit/hosts-manager.test.ts`
- `apps/desktop/test/unit/strict-policy-*.test.ts`

Work:

- Fix elevated hosts write command composition on Windows:
  - robust quoting/argument handling
  - explicit elevated script wrapper with exit-code propagation
  - maintain fallback path and clear telemetry
- Ensure website block lifecycle applies and reverts cleanly across session start/end.
- Verify app block enforcement for `whatsapp.root.exe` under active session conditions.
- Reduce strict-policy action spam:
  - dedupe notifications/close actions by executable + window
  - avoid repeated initial notifications for process fan-out events
  - prevent repeated companion opens when notification emission is throttled

Acceptance:

- Active session with blocked domains denies navigation in Edge/Chromium via hosts policy.
- `whatsapp.root.exe` receives expected detect -> notify -> close behavior during active session.
- Notification/action burst volume drops to expected levels without loss of enforcement.

## Phase 4: Notification Click Routing Matrix (Web + Desktop)

Files in scope:

- `apps/desktop/src/notifications.ts`
- `apps/desktop/src/main.ts`
- `apps/web/src/lib/desktop-session-bridge.tsx`
- `apps/web/src/lib/inbox-desktop-notifications-context.tsx`
- `apps/web/public/inbox-push-sw.js`
- `apps/web/src/routes/_app.inbox.tsx`
- `convex/inboxItems.ts`

Work:

- Define one route-resolution matrix per notification class:
  - strict-policy desktop notifications
  - session lifecycle notifications
  - inbox notifications (github/notion/internal + type)
- Implement shared route resolver + fallback rules.
- Ensure click behavior navigates in-app when destination is internal.
- Keep external URLs external only when entity link is truly off-site.
- Add read/ack behavior where applicable when user is routed.

Acceptance:

- Clicking any notification lands user in the most relevant app surface.
- Desktop and browser push/in-app notification routing are consistent.

## Phase 5: Task Detail Panel Rerender + Scroll Preservation

Files in scope:

- `apps/web/src/components/task-detail.tsx`
- `apps/web/src/routes/_app.projects.$projectId.tasks.tsx`
- `apps/web/src/components/project-task-lists-panel.tsx`

Work:

- Remove forced remount pattern (`key={task._id}`) and make task form state controlled by task-id change effects.
- Preserve detail panel scroll state between task switches.
- Keep list panel scroll stable while changing selected task.
- Optional memoization boundaries to avoid unnecessary subtree churn.

Acceptance:

- Switching between tasks does not reset panel scroll unexpectedly.
- Behavior is identical in browser and desktop shell.

## Phase 6: Background Process Branding/Icon Hardening

Files in scope:

- `apps/desktop/src/main.ts`
- `apps/desktop/electron-builder.config.cjs`
- `apps/desktop/scripts/generate-icons.mjs` (if needed)
- installer/build verification scripts

Work:

- Verify icon behavior in packaged runtime (Task Manager background processes, tray, taskbar, notifications).
- Ensure runtime startup paths (open-at-login, hidden launch) still resolve branded executable/icon.
- Add build-time verification step to fail packaging if icon resources are missing.

Acceptance:

- Packaged DevSuite process shows branded icon in background apps contexts where Windows supports it.

## Phase 7: Regression Verification + Rollout

Validation commands:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @devsuite/desktop test:unit`
- `pnpm --filter @devsuite/desktop test:e2e` (where stable in environment)

Manual checks:

- Desktop settings IA and modern form behavior
- Widget persistent visibility + timer + overflow
- YouTube/blocked-site enforcement in Edge during active session
- WhatsApp close behavior during active session
- Notification clicks for strict-policy and inbox routes
- Task detail scroll preservation on repeated switches
- Background icon verification in installed app mode

## Risks / Dependencies

- Hosts-file elevation paths are sensitive to Windows policy/UAC settings.
- Notification routing touches both desktop IPC and web push behavior; regressions can fragment UX if not centralized.
- Removing task detail remount requires careful state sync to avoid stale form values.

## Delivery Strategy

1. Land Phases 1-2 first (high-visibility UX).
2. Land Phase 3 with strict log assertions and before/after evidence.
3. Land Phase 4 matrix and tests.
4. Land Phase 5 and Phase 6 hardening.
5. Run full regression phase before release.
