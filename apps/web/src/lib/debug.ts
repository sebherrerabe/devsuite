type DebugScope = 'router' | 'sessions';

const STORAGE_KEY = 'devsuite-debug';

const normalizeScopes = (raw: string | null) => {
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(',')
      .map(scope => scope.trim().toLowerCase())
      .filter(Boolean)
  );
};

const readDebugScopes = () => {
  if (typeof window === 'undefined') return new Set<string>();
  return normalizeScopes(window.localStorage.getItem(STORAGE_KEY));
};

export const isDebugEnabled = (scope: DebugScope) => {
  if (import.meta.env.VITE_DEBUG_ALL === 'true') return true;

  const scopes = readDebugScopes();
  if (scopes.size > 0) {
    return scopes.has('all') || scopes.has(scope);
  }

  return import.meta.env.DEV;
};

export const debugLog = (
  scope: DebugScope,
  message: string,
  data?: Record<string, unknown>
) => {
  if (!isDebugEnabled(scope)) return;
  if (data) {
    console.debug(`[devsuite:${scope}] ${message}`, data);
  } else {
    console.debug(`[devsuite:${scope}] ${message}`);
  }
};

export const debugWarn = (
  scope: DebugScope,
  message: string,
  data?: Record<string, unknown>
) => {
  if (!isDebugEnabled(scope)) return;
  if (data) {
    console.warn(`[devsuite:${scope}] ${message}`, data);
  } else {
    console.warn(`[devsuite:${scope}] ${message}`);
  }
};

export const debugError = (
  scope: DebugScope,
  message: string,
  data?: Record<string, unknown>
) => {
  if (!isDebugEnabled(scope)) return;
  if (data) {
    console.error(`[devsuite:${scope}] ${message}`, data);
  } else {
    console.error(`[devsuite:${scope}] ${message}`);
  }
};

export const debugGroup = (
  scope: DebugScope,
  title: string,
  callback: () => void
) => {
  if (!isDebugEnabled(scope)) return;
  console.groupCollapsed(`[devsuite:${scope}] ${title}`);
  try {
    callback();
  } finally {
    console.groupEnd();
  }
};

export const debugHint = (scope: DebugScope, message: string) => {
  debugLog(scope, message, {
    hint: "Set localStorage 'devsuite-debug' to 'sessions', 'router', or 'all' to control logs.",
  });
};
