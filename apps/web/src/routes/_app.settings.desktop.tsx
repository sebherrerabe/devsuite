import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { isWindowsUserAgent } from '@/lib/platform-detection';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { showToast } from '@/lib/toast';
import { Checkbox } from '@/components/ui/checkbox';
import { authClient } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';

type DesktopFocusSettingsState = {
  ideWatchList: string[];
  appBlockList: string[];
  websiteBlockList: string[];
  strictMode: 'prompt_only' | 'prompt_then_close';
  appActionMode: 'warn' | 'warn_then_close';
  websiteActionMode: 'warn_only' | 'escalate';
  graceSeconds: number;
  reminderIntervalSeconds: number;
};

type DesktopAppBlockItem = {
  executable: string;
  enabled: boolean;
};

type RunningDesktopProcess = {
  executable: string;
  windowTitle: string;
};

const DEFAULT_DESKTOP_FOCUS_SETTINGS: DesktopFocusSettingsState = {
  ideWatchList: ['code.exe', 'cursor.exe', 'idea64.exe'],
  appBlockList: [],
  websiteBlockList: [],
  strictMode: 'prompt_then_close',
  appActionMode: 'warn_then_close',
  websiteActionMode: 'escalate',
  graceSeconds: 45,
  reminderIntervalSeconds: 120,
};
const DEFAULT_COMPANION_SHORTCUT = 'Ctrl+Alt+D';

function getSessionUserId(sessionData: unknown): string | null {
  if (!sessionData || typeof sessionData !== 'object') {
    return null;
  }

  const root = sessionData as {
    session?: { userId?: unknown } | null;
    user?: { id?: unknown } | null;
  };

  if (
    root.session &&
    typeof root.session.userId === 'string' &&
    root.session.userId.trim()
  ) {
    return root.session.userId.trim();
  }

  if (root.user && typeof root.user.id === 'string' && root.user.id.trim()) {
    return root.user.id.trim();
  }

  return null;
}

function parseListInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeExecutableInput(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDomainInput(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split(/[/?#]/, 1)[0] ?? ''
  );
}

function toDesktopAppBlockItems(values: string[]): DesktopAppBlockItem[] {
  return values.map(executable => ({
    executable: normalizeExecutableInput(executable),
    enabled: true,
  }));
}

function toEnabledDesktopAppBlockList(items: DesktopAppBlockItem[]): string[] {
  const enabled = items
    .filter(item => item.enabled)
    .map(item => normalizeExecutableInput(item.executable))
    .filter(Boolean);
  return Array.from(new Set(enabled));
}

function clampInteger(value: number, fallbackValue: number): number {
  if (!Number.isFinite(value)) {
    return fallbackValue;
  }
  return Math.max(1, Math.trunc(value));
}

function appendUniqueValue(values: string[], candidate: string): string[] {
  const normalizedCandidate = normalizeExecutableInput(candidate);
  if (!normalizedCandidate) {
    return values;
  }

  if (values.includes(normalizedCandidate)) {
    return values;
  }

  return [...values, normalizedCandidate];
}

function appendUniqueDomain(values: string[], candidate: string): string[] {
  const normalizedCandidate = normalizeDomainInput(candidate);
  if (!normalizedCandidate) {
    return values;
  }

  if (values.includes(normalizedCandidate)) {
    return values;
  }

  return [...values, normalizedCandidate];
}

type ProcessPickerProps = {
  ideExecutables: string[];
  appBlockExecutables: string[];
  onAddIdeExecutable: (executable: string) => void;
  onAddAppBlockExecutable: (executable: string) => void;
};

function ProcessPicker({
  ideExecutables,
  appBlockExecutables,
  onAddIdeExecutable,
  onAddAppBlockExecutable,
}: ProcessPickerProps) {
  const [runningProcesses, setRunningProcesses] = useState<
    RunningDesktopProcess[]
  >([]);
  const [query, setQuery] = useState('');
  const [selectedExecutable, setSelectedExecutable] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshProcesses = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      typeof window.desktopProcessMonitor?.listRunningProcesses !== 'function'
    ) {
      setRunningProcesses([]);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const listed = await window.desktopProcessMonitor.listRunningProcesses();
      const normalized = listed
        .map(process => {
          const executable = normalizeExecutableInput(process.executable ?? '');
          const windowTitle = (process.windowTitle ?? '').trim();
          return {
            executable,
            windowTitle,
          };
        })
        .filter(process => process.executable)
        .sort((left, right) => {
          const leftLabel = left.windowTitle || left.executable;
          const rightLabel = right.windowTitle || right.executable;
          return leftLabel.localeCompare(rightLabel);
        });

      setRunningProcesses(normalized);
      setSelectedExecutable(previousSelection =>
        normalized.some(process => process.executable === previousSelection)
          ? previousSelection
          : ''
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Failed to list running processes.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProcesses();
  }, [refreshProcesses]);

  const selectedProcess = runningProcesses.find(
    process => process.executable === selectedExecutable
  );
  const normalizedIdeSet = new Set(
    ideExecutables.map(normalizeExecutableInput).filter(Boolean)
  );
  const normalizedAppBlockSet = new Set(
    appBlockExecutables.map(normalizeExecutableInput).filter(Boolean)
  );

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Running process picker</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshProcesses}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
      <Command className="rounded-md border">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search running executables or window titles"
        />
        <CommandList>
          <CommandEmpty>
            {isLoading ? 'Loading running processes...' : 'No processes found.'}
          </CommandEmpty>
          <CommandGroup heading="Processes">
            {runningProcesses.map(process => (
              <CommandItem
                key={process.executable}
                value={`${process.executable} ${process.windowTitle}`}
                className="cursor-pointer"
                onSelect={() => {
                  setSelectedExecutable(process.executable);
                }}
                onMouseDown={event => {
                  event.preventDefault();
                  setSelectedExecutable(process.executable);
                }}
                onClick={() => {
                  setSelectedExecutable(process.executable);
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-xs">
                    {process.windowTitle || process.executable}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {process.windowTitle
                      ? process.executable
                      : '(No window title)'}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      {loadError ? <p className="text-xs text-red-500">{loadError}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={
            !selectedProcess || normalizedIdeSet.has(selectedProcess.executable)
          }
          onClick={() => {
            if (!selectedProcess) {
              return;
            }
            onAddIdeExecutable(selectedProcess.executable);
          }}
        >
          Add to IDE list
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={
            !selectedProcess ||
            normalizedAppBlockSet.has(selectedProcess.executable)
          }
          onClick={() => {
            if (!selectedProcess) {
              return;
            }
            onAddAppBlockExecutable(selectedProcess.executable);
          }}
        >
          Add to app block list
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/_app/settings/desktop')({
  component: DesktopSettingsPage,
});

function DesktopSettingsPage() {
  const { data: authSession } = authClient.useSession();
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const userId = getSessionUserId(authSession);
  const settings = useQuery(
    api.userSettings.get,
    companyId ? { companyId } : 'skip'
  );
  const updateSettings = useMutation(api.userSettings.update);

  const [desktopIdeWatchList, setDesktopIdeWatchList] = useState<string[]>(
    DEFAULT_DESKTOP_FOCUS_SETTINGS.ideWatchList
  );
  const [desktopIdeCandidate, setDesktopIdeCandidate] = useState('');
  const [desktopAppBlockItems, setDesktopAppBlockItems] = useState<
    DesktopAppBlockItem[]
  >(toDesktopAppBlockItems(DEFAULT_DESKTOP_FOCUS_SETTINGS.appBlockList));
  const [desktopAppBlockCandidate, setDesktopAppBlockCandidate] = useState('');
  const [desktopWebsiteBlockList, setDesktopWebsiteBlockList] = useState<
    string[]
  >(DEFAULT_DESKTOP_FOCUS_SETTINGS.websiteBlockList);
  const [desktopWebsiteCandidate, setDesktopWebsiteCandidate] = useState('');
  const [desktopStrictMode, setDesktopStrictMode] = useState<
    DesktopFocusSettingsState['strictMode']
  >(DEFAULT_DESKTOP_FOCUS_SETTINGS.strictMode);
  const [desktopAppActionMode, setDesktopAppActionMode] = useState<
    DesktopFocusSettingsState['appActionMode']
  >(DEFAULT_DESKTOP_FOCUS_SETTINGS.appActionMode);
  const [desktopWebsiteActionMode, setDesktopWebsiteActionMode] = useState<
    DesktopFocusSettingsState['websiteActionMode']
  >(DEFAULT_DESKTOP_FOCUS_SETTINGS.websiteActionMode);
  const [desktopGraceSeconds, setDesktopGraceSeconds] = useState(
    String(DEFAULT_DESKTOP_FOCUS_SETTINGS.graceSeconds)
  );
  const [desktopReminderSeconds, setDesktopReminderSeconds] = useState(
    String(DEFAULT_DESKTOP_FOCUS_SETTINGS.reminderIntervalSeconds)
  );
  const [desktopCompanionShortcut, setDesktopCompanionShortcut] = useState(
    DEFAULT_COMPANION_SHORTCUT
  );
  const [desktopOpenAtLogin, setDesktopOpenAtLogin] = useState(true);
  const [desktopRunInBackgroundOnClose, setDesktopRunInBackgroundOnClose] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasDesktopFocusApi =
    typeof window !== 'undefined' && typeof window.desktopFocus !== 'undefined';
  const hasDesktopProcessPicker =
    typeof window !== 'undefined' &&
    typeof window.desktopProcessMonitor?.listRunningProcesses === 'function';
  const hasDesktopCompanionApi =
    typeof window !== 'undefined' &&
    typeof window.desktopCompanion !== 'undefined';
  const hasDesktopRuntimePreferencesApi =
    typeof window !== 'undefined' &&
    typeof window.desktopRuntimePreferences !== 'undefined';

  const isDesktopRuntime = hasDesktopFocusApi;

  useEffect(() => {
    const desktopFocus =
      settings?.desktopFocus ?? DEFAULT_DESKTOP_FOCUS_SETTINGS;

    setDesktopIdeWatchList(
      desktopFocus.ideWatchList.map(normalizeExecutableInput).filter(Boolean)
    );
    setDesktopAppBlockItems(toDesktopAppBlockItems(desktopFocus.appBlockList));
    setDesktopWebsiteBlockList(
      desktopFocus.websiteBlockList.map(normalizeDomainInput).filter(Boolean)
    );
    setDesktopStrictMode(desktopFocus.strictMode);
    setDesktopAppActionMode(desktopFocus.appActionMode);
    setDesktopWebsiteActionMode(desktopFocus.websiteActionMode);
    setDesktopGraceSeconds(String(desktopFocus.graceSeconds));
    setDesktopReminderSeconds(String(desktopFocus.reminderIntervalSeconds));
  }, [settings?.desktopFocus]);

  useEffect(() => {
    if (!hasDesktopCompanionApi) {
      setDesktopCompanionShortcut(DEFAULT_COMPANION_SHORTCUT);
      return;
    }

    let active = true;
    void window.desktopCompanion
      ?.getShortcut()
      .then(shortcut => {
        if (active) {
          setDesktopCompanionShortcut(shortcut);
        }
      })
      .catch(() => {
        if (active) {
          setDesktopCompanionShortcut(DEFAULT_COMPANION_SHORTCUT);
        }
      });

    return () => {
      active = false;
    };
  }, [hasDesktopCompanionApi]);

  useEffect(() => {
    if (!hasDesktopRuntimePreferencesApi) {
      setDesktopOpenAtLogin(true);
      setDesktopRunInBackgroundOnClose(false);
      return;
    }

    let active = true;
    void window.desktopRuntimePreferences
      ?.get()
      .then(preferences => {
        if (!active || !preferences) {
          return;
        }

        setDesktopOpenAtLogin(preferences.openAtLogin);
        setDesktopRunInBackgroundOnClose(preferences.runInBackgroundOnClose);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setDesktopOpenAtLogin(true);
        setDesktopRunInBackgroundOnClose(false);
      });

    return () => {
      active = false;
    };
  }, [hasDesktopRuntimePreferencesApi]);

  const addDesktopAppBlockExecutable = (executable: string) => {
    const normalized = normalizeExecutableInput(executable);
    if (!normalized) {
      return;
    }

    setDesktopAppBlockItems(previousItems => {
      const existingIndex = previousItems.findIndex(
        item => item.executable === normalized
      );
      if (existingIndex >= 0) {
        return previousItems.map((item, index) =>
          index === existingIndex ? { ...item, enabled: true } : item
        );
      }

      return [...previousItems, { executable: normalized, enabled: true }];
    });
  };

  const desktopCapabilities = useMemo(
    () => [
      {
        label: 'Desktop bridge',
        value: isDesktopRuntime ? 'Connected' : 'Not available',
      },
      {
        label: 'Process picker',
        value: hasDesktopProcessPicker ? 'Available' : 'Not available',
      },
      {
        label: 'Companion control',
        value: hasDesktopCompanionApi ? 'Available' : 'Not available',
      },
      {
        label: 'Runtime preferences',
        value: hasDesktopRuntimePreferencesApi ? 'Available' : 'Not available',
      },
    ],
    [
      hasDesktopCompanionApi,
      hasDesktopProcessPicker,
      hasDesktopRuntimePreferencesApi,
      isDesktopRuntime,
    ]
  );

  const handleSave = async () => {
    if (!companyId || !isDesktopRuntime) {
      return;
    }

    const desktopFocusPayload: DesktopFocusSettingsState = {
      ideWatchList: Array.from(new Set(desktopIdeWatchList)),
      appBlockList: toEnabledDesktopAppBlockList(desktopAppBlockItems),
      websiteBlockList: Array.from(new Set(desktopWebsiteBlockList)),
      strictMode: desktopStrictMode,
      appActionMode: desktopAppActionMode,
      websiteActionMode: desktopWebsiteActionMode,
      graceSeconds: clampInteger(
        Number(desktopGraceSeconds),
        DEFAULT_DESKTOP_FOCUS_SETTINGS.graceSeconds
      ),
      reminderIntervalSeconds: clampInteger(
        Number(desktopReminderSeconds),
        DEFAULT_DESKTOP_FOCUS_SETTINGS.reminderIntervalSeconds
      ),
    };

    setIsSaving(true);
    try {
      await updateSettings({
        companyId,
        desktopFocus: desktopFocusPayload,
      });

      if (userId) {
        await window.desktopFocus?.set(
          { userId, companyId },
          desktopFocusPayload
        );
      }
      if (hasDesktopCompanionApi) {
        const savedShortcut = await window.desktopCompanion?.setShortcut(
          desktopCompanionShortcut
        );
        if (savedShortcut) {
          setDesktopCompanionShortcut(savedShortcut);
        }
      }
      if (hasDesktopRuntimePreferencesApi) {
        const savedPreferences = await window.desktopRuntimePreferences?.set({
          openAtLogin: desktopOpenAtLogin,
          runInBackgroundOnClose: desktopRunInBackgroundOnClose,
        });
        if (savedPreferences) {
          setDesktopOpenAtLogin(savedPreferences.openAtLogin);
          setDesktopRunInBackgroundOnClose(
            savedPreferences.runInBackgroundOnClose
          );
        }
      }

      showToast.success('Desktop settings updated');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to update settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (typeof window !== 'undefined' && !isWindowsUserAgent()) {
    return <Navigate to="/settings/profile" />;
  }

  if (!isDesktopRuntime) {
    const installerUrl = import.meta.env.VITE_DESKTOP_INSTALLER_URL?.trim();
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Desktop</h3>
        <p className="text-sm text-muted-foreground">
          Desktop enforcement settings are only available in the Windows desktop
          app.
        </p>
        <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
          Open DevSuite Desktop, then return to this tab to edit focus controls,
          app/website block rules, and runtime preferences.
        </div>
        <div className="flex flex-wrap gap-2">
          {installerUrl ? (
            <Button asChild>
              <a href={installerUrl} target="_blank" rel="noopener noreferrer">
                Download DevSuite for Windows
              </a>
            </Button>
          ) : null}
          <Link to="/settings/profile" className="inline-flex">
            <Button variant="outline">Back to Profile</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Desktop</h3>
        <p className="text-sm text-muted-foreground">
          Configure desktop-only focus enforcement and runtime behavior.
        </p>
      </div>
      <div className="h-[1px] bg-border" />

      <div className="grid gap-2 sm:grid-cols-2">
        {desktopCapabilities.map(capability => (
          <div
            key={capability.label}
            className="rounded-md border bg-muted/20 px-3 py-2"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {capability.label}
            </p>
            <p className="text-sm font-medium">{capability.value}</p>
          </div>
        ))}
      </div>

      {hasDesktopProcessPicker ? (
        <ProcessPicker
          ideExecutables={desktopIdeWatchList}
          appBlockExecutables={desktopAppBlockItems.map(
            item => item.executable
          )}
          onAddIdeExecutable={executable =>
            setDesktopIdeWatchList(previous =>
              appendUniqueValue(previous, executable)
            )
          }
          onAddAppBlockExecutable={addDesktopAppBlockExecutable}
        />
      ) : null}

      <div className="rounded-md border p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">IDE watch list</p>
          <p className="text-xs text-muted-foreground">
            Add executables that require an active session.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={desktopIdeCandidate}
            onChange={event => setDesktopIdeCandidate(event.target.value)}
            placeholder="code.exe"
          />
          <Button
            type="button"
            onClick={() => {
              setDesktopIdeWatchList(previous =>
                appendUniqueValue(previous, desktopIdeCandidate)
              );
              setDesktopIdeCandidate('');
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {desktopIdeWatchList.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No IDE executables configured.
            </p>
          ) : (
            desktopIdeWatchList.map(executable => (
              <Badge
                key={executable}
                variant="secondary"
                className="gap-2 px-2 py-1"
              >
                <span>{executable}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setDesktopIdeWatchList(previous =>
                      previous.filter(item => item !== executable)
                    )
                  }
                >
                  x
                </button>
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="rounded-md border p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Distractor app block list</p>
          <p className="text-xs text-muted-foreground">
            Enabled executables are warned and optionally closed during an
            active session.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={desktopAppBlockCandidate}
            onChange={event => setDesktopAppBlockCandidate(event.target.value)}
            placeholder="whatsapp.root.exe"
          />
          <Button
            type="button"
            onClick={() => {
              addDesktopAppBlockExecutable(desktopAppBlockCandidate);
              setDesktopAppBlockCandidate('');
            }}
          >
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {desktopAppBlockItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No distractor executables configured.
            </p>
          ) : (
            desktopAppBlockItems.map(item => (
              <div
                key={item.executable}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={item.enabled}
                    onCheckedChange={checked =>
                      setDesktopAppBlockItems(previousItems =>
                        previousItems.map(previousItem =>
                          previousItem.executable === item.executable
                            ? {
                                ...previousItem,
                                enabled: Boolean(checked),
                              }
                            : previousItem
                        )
                      )
                    }
                  />
                  <span className="text-sm">{item.executable}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDesktopAppBlockItems(previousItems =>
                      previousItems.filter(
                        previousItem =>
                          previousItem.executable !== item.executable
                      )
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-md border p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Website block list</p>
          <p className="text-xs text-muted-foreground">
            Domains are applied through the desktop hosts policy during active
            sessions.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={desktopWebsiteCandidate}
            onChange={event => setDesktopWebsiteCandidate(event.target.value)}
            placeholder="youtube.com"
          />
          <Button
            type="button"
            onClick={() => {
              const nextValues = parseListInput(desktopWebsiteCandidate).reduce(
                (values, candidate) => appendUniqueDomain(values, candidate),
                desktopWebsiteBlockList
              );
              setDesktopWebsiteBlockList(nextValues);
              setDesktopWebsiteCandidate('');
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {desktopWebsiteBlockList.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No blocked domains configured.
            </p>
          ) : (
            desktopWebsiteBlockList.map(domain => (
              <Badge key={domain} variant="outline" className="gap-2 px-2 py-1">
                <span>{domain}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setDesktopWebsiteBlockList(previous =>
                      previous.filter(item => item !== domain)
                    )
                  }
                >
                  x
                </button>
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="rounded-md border p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Enforcement mode</p>
          <p className="text-xs text-muted-foreground">
            Choose how strictly DevSuite reacts to IDE, distractor app, and
            website events.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium">IDE mode</p>
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                variant={
                  desktopStrictMode === 'prompt_only' ? 'default' : 'outline'
                }
                onClick={() => setDesktopStrictMode('prompt_only')}
                className="justify-start"
              >
                Prompt only
              </Button>
              <Button
                type="button"
                variant={
                  desktopStrictMode === 'prompt_then_close'
                    ? 'default'
                    : 'outline'
                }
                onClick={() => setDesktopStrictMode('prompt_then_close')}
                className="justify-start"
              >
                Prompt then close
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">App action</p>
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                variant={
                  desktopAppActionMode === 'warn' ? 'default' : 'outline'
                }
                onClick={() => setDesktopAppActionMode('warn')}
                className="justify-start"
              >
                Warn
              </Button>
              <Button
                type="button"
                variant={
                  desktopAppActionMode === 'warn_then_close'
                    ? 'default'
                    : 'outline'
                }
                onClick={() => setDesktopAppActionMode('warn_then_close')}
                className="justify-start"
              >
                Warn then close
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Website action</p>
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                variant={
                  desktopWebsiteActionMode === 'warn_only'
                    ? 'default'
                    : 'outline'
                }
                onClick={() => setDesktopWebsiteActionMode('warn_only')}
                className="justify-start"
              >
                Warn only
              </Button>
              <Button
                type="button"
                variant={
                  desktopWebsiteActionMode === 'escalate'
                    ? 'default'
                    : 'outline'
                }
                onClick={() => setDesktopWebsiteActionMode('escalate')}
                className="justify-start"
              >
                Escalate
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Timing and runtime</p>
          <p className="text-xs text-muted-foreground">
            Tune grace windows and desktop startup behavior.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium">Grace window</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={desktopGraceSeconds}
                onChange={event => setDesktopGraceSeconds(event.target.value)}
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Reminder interval</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={desktopReminderSeconds}
                onChange={event =>
                  setDesktopReminderSeconds(event.target.value)
                }
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Companion shortcut</label>
          <Input
            value={desktopCompanionShortcut}
            onChange={event => setDesktopCompanionShortcut(event.target.value)}
            placeholder={DEFAULT_COMPANION_SHORTCUT}
            disabled={!hasDesktopCompanionApi}
          />
        </div>

        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Start DevSuite with Windows</span>
            <Checkbox
              checked={desktopOpenAtLogin}
              disabled={!hasDesktopRuntimePreferencesApi}
              onCheckedChange={checked =>
                setDesktopOpenAtLogin(Boolean(checked))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              Run in background when window is closed
            </span>
            <Checkbox
              checked={desktopRunInBackgroundOnClose}
              disabled={!hasDesktopRuntimePreferencesApi}
              onCheckedChange={checked =>
                setDesktopRunInBackgroundOnClose(Boolean(checked))
              }
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 rounded-md border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Desktop changes are applied immediately after saving.
          </p>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save desktop settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
