export function createSessionWidgetHtml() {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevSuite Session Widget</title>
    <style>
      :root {
        --bg: #0f172a;
        --card: #111827;
        --primary: #22d3ee;
        --primary-foreground: #0a0a0a;
        --foreground: #fafafa;
        --muted-foreground: #64748b;
        --border: #1e293b;
        --destructive: #7f1d1d;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }

      body {
        color: var(--foreground);
        font-family: "Segoe UI", sans-serif;
      }

      .shell {
        width: 100%;
        height: 100%;
        padding: 8px;
        box-sizing: border-box;
      }

      .card {
        position: relative;
        height: 100%;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--card);
        opacity: 0.92;
        box-sizing: border-box;
        padding: 14px;
        -webkit-app-region: drag;
      }

      .close-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 20px;
        height: 20px;
        border: none;
        background: transparent;
        color: var(--muted-foreground);
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.2s;
        cursor: pointer;
        -webkit-app-region: no-drag;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--foreground);
      }

      .card:hover .close-btn {
        opacity: 1;
      }

      .status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .status {
        font-size: 13px;
      }

      .badge {
        font-size: 10px;
        line-height: 1;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .badge--running {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
      }

      .badge--paused {
        background: #334155;
        color: var(--foreground);
        border-color: #475569;
      }

      .badge--idle {
        background: transparent;
        color: var(--muted-foreground);
      }

      .timer {
        margin-top: 4px;
        margin-bottom: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 24px;
        font-weight: 600;
      }

      .meta {
        font-size: 11px;
        color: var(--muted-foreground);
        margin-bottom: 8px;
      }

      .error {
        min-height: 14px;
        margin-bottom: 8px;
        font-size: 11px;
        color: #fca5a5;
      }

      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      button {
        font: inherit;
        font-size: 12px;
        padding: 8px;
        border-radius: 8px;
        cursor: pointer;
        -webkit-app-region: no-drag;
      }

      .btn-primary {
        border: 1px solid var(--primary);
        background: var(--primary);
        color: var(--primary-foreground);
      }

      .btn-secondary {
        border: 1px solid var(--border);
        background: #1e293b;
        color: var(--foreground);
      }

      .btn-danger {
        border: 1px solid var(--destructive);
        background: transparent;
        color: #fca5a5;
      }

      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .full-width {
        grid-column: 1 / -1;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <button class="close-btn" id="closeBtn" title="Close">&times;</button>
        <div class="status-row">
          <div class="status" id="status">Status: IDLE</div>
          <div class="badge badge--idle" id="statusBadge">IDLE</div>
        </div>
        <div class="timer" id="timer">00:00:00</div>
        <div class="meta" id="meta">connection=syncing · session=none</div>
        <div class="error" id="error"></div>
        <div class="actions">
          <button class="btn-primary full-width" id="start">Start</button>
          <button class="btn-secondary" id="pause" style="display:none;">Pause</button>
          <button class="btn-secondary" id="resume" style="display:none;">Resume</button>
          <button class="btn-danger" id="end" style="display:none;">End Session</button>
        </div>
      </div>
    </div>
    <script>
      const statusElement = document.getElementById('status');
      const statusBadgeElement = document.getElementById('statusBadge');
      const metaElement = document.getElementById('meta');
      const timerElement = document.getElementById('timer');
      const errorElement = document.getElementById('error');
      const closeButton = document.getElementById('closeBtn');
      const startButton = document.getElementById('start');
      const pauseButton = document.getElementById('pause');
      const resumeButton = document.getElementById('resume');
      const endButton = document.getElementById('end');

      let currentState = null;
      let lastBridgeSignalAt = 0;
      let displayedMs = 0;
      let targetMs = 0;
      let smoothingUntil = 0;

      function formatDuration(totalMs) {
        const seconds = Math.floor(Math.max(0, totalMs) / 1000);
        const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const remaining = String(seconds % 60).padStart(2, '0');
        return hours + ':' + minutes + ':' + remaining;
      }

      function calculateEffectiveDuration(state) {
        const base = Number.isFinite(state.effectiveDurationMs)
          ? state.effectiveDurationMs
          : 0;
        if (state.status !== 'RUNNING') {
          return base;
        }
        if (state.connectionState !== 'connected') {
          return base;
        }
        const publishedAt = Number.isFinite(state.publishedAt)
          ? state.publishedAt
          : state.updatedAt;
        return base + Math.max(0, Date.now() - publishedAt);
      }

      function updateTimer() {
        if (!currentState) {
          timerElement.textContent = '00:00:00';
          displayedMs = 0;
          targetMs = 0;
          smoothingUntil = 0;
          return 0;
        }

        const raw = calculateEffectiveDuration(currentState);
        const jump = Math.abs(raw - displayedMs);
        if (jump > 2000 && smoothingUntil > 0 && Date.now() < smoothingUntil + 2000) {
          targetMs = raw;
        } else if (jump > 2000) {
          targetMs = raw;
          smoothingUntil = Date.now() + 1000;
        } else {
          displayedMs = raw;
          targetMs = raw;
        }

        if (Date.now() < smoothingUntil) {
          displayedMs += (targetMs - displayedMs) * 0.15;
        } else {
          displayedMs = targetMs;
        }

        timerElement.textContent = formatDuration(displayedMs);
        return displayedMs;
      }

      function formatMeta(state) {
        const suffix = state.sessionId ? 'session=' + state.sessionId : 'session=none';
        const connection = 'connection=' + state.connectionState;
        return connection + ' · ' + suffix;
      }

      function renderBadge(status) {
        statusBadgeElement.textContent = status;
        statusBadgeElement.className = 'badge';

        if (status === 'RUNNING') {
          statusBadgeElement.classList.add('badge--running');
          return;
        }

        if (status === 'PAUSED') {
          statusBadgeElement.classList.add('badge--paused');
          return;
        }

        statusBadgeElement.classList.add('badge--idle');
      }

      function renderButtons(state) {
        const connected = state.connectionState === 'connected';

        startButton.style.display = state.status === 'IDLE' ? 'inline-flex' : 'none';
        pauseButton.style.display = state.status === 'RUNNING' ? 'inline-flex' : 'none';
        resumeButton.style.display = state.status === 'PAUSED' ? 'inline-flex' : 'none';
        endButton.style.display = state.status === 'IDLE' ? 'none' : 'inline-flex';

        startButton.disabled = !connected || state.status !== 'IDLE';
        pauseButton.disabled = !connected || state.status !== 'RUNNING';
        resumeButton.disabled = !connected || state.status !== 'PAUSED';
        endButton.disabled = !connected || state.status === 'IDLE';
      }

      function renderState(state) {
        currentState = state;
        lastBridgeSignalAt = Date.now();
        const computedDuration = updateTimer();

        console.debug('[widget] state received', {
          status: state.status,
          effectiveDurationMs: state.effectiveDurationMs,
          updatedAt: state.updatedAt,
          computedDuration,
        });

        statusElement.textContent = 'Status: ' + state.status;
        renderBadge(state.status);
        metaElement.textContent = formatMeta(state);
        errorElement.textContent = state.lastError || '';
        renderButtons(state);
      }

      async function resolveScope() {
        const scope = await window.desktopAuth.getScope();
        if (!scope) {
          throw new Error('Desktop scope is not initialized.');
        }
        return scope;
      }

      async function request(action) {
        try {
          const scope = await resolveScope();
          await window.desktopSession.requestAction(scope, action);
        } catch (error) {
          const message = error && error.message ? error.message : String(error);
          errorElement.textContent = message;
        }
      }

      closeButton.addEventListener('click', () => {
        window.close();
      });

      startButton.addEventListener('click', () => request('start'));
      pauseButton.addEventListener('click', () => request('pause'));
      resumeButton.addEventListener('click', () => request('resume'));
      endButton.addEventListener('click', () => request('end'));

      window.desktopSession.onStateChanged(nextState => {
        renderState(nextState);
      });

      resolveScope()
        .then(scope => window.desktopSession.getState(scope))
        .then(renderState)
        .catch(error => {
          const message = error && error.message ? error.message : String(error);
          errorElement.textContent = message;
        });

      setInterval(() => {
        updateTimer();

        if (!currentState) {
          return;
        }

        const staleForMs = Date.now() - lastBridgeSignalAt;
        if (staleForMs > 45000) {
          console.warn('[widget] bridge signal stale', {
            staleForMs,
            lastSignalAt: lastBridgeSignalAt,
          });
          metaElement.textContent = 'connection=stale · waiting for sync';
          startButton.disabled = true;
          pauseButton.disabled = true;
          resumeButton.disabled = true;
          endButton.disabled = true;
        }
      }, 1000);
    </script>
  </body>
</html>
  `;
}
