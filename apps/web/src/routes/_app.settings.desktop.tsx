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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

type DesktopFocusSettingsState = {
  devCoreList: string[];
  ideWatchList: string[];
  devSupportList: string[];
  devSiteList: string[];
  appBlockList: string[];
  websiteBlockList: string[];
  strictMode: 'prompt_only' | 'prompt_then_close';
  appActionMode: 'warn' | 'warn_then_close';
  websiteActionMode: 'warn_only' | 'escalate';
  graceSeconds: number;
  reminderIntervalSeconds: number;
  inactivityThresholdSeconds: number;
  autoInactivityPause: boolean;
  autoSession: boolean;
  autoSessionWarmupSeconds: number;
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
  devCoreList: ['code.exe', 'cursor.exe', 'idea64.exe'],
  ideWatchList: ['code.exe', 'cursor.exe', 'idea64.exe'],
  devSupportList: [
    'wt.exe',
    'windowsterminal.exe',
    'powershell.exe',
    'cmd.exe',
  ],
  devSiteList: ['chat.openai.com', 'claude.ai', 'github.com', 'localhost'],
  appBlockList: [],
  websiteBlockList: [],
  strictMode: 'prompt_then_close',
  appActionMode: 'warn_then_close',
  websiteActionMode: 'escalate',
  graceSeconds: 45,
  reminderIntervalSeconds: 120,
  inactivityThresholdSeconds: 300,
  autoInactivityPause: true,
  autoSession: false,
  autoSessionWarmupSeconds: 120,
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

function clampInteger(
  value: number,
  fallbackValue: number,
  minimum = 1,
  maximum = 3_600
): number {
  if (!Number.isFinite(value)) {
    return fallbackValue;
  }
  const rounded = Math.trunc(value);
  return Math.min(maximum, Math.max(minimum, rounded));
}

function appendUniqueValue(values: string[], candidate: string): string[] {
  const normalizedCandidate = normalizeExecutableInput(candidate);
  if (!normalizedCandidate || values.includes(normalizedCandidate)) {
    return values;
  }

  return [...values, normalizedCandidate];
}

function appendUniqueDomain(values: string[], candidate: string): string[] {
  const normalizedCandidate = normalizeDomainInput(candidate);
  if (!normalizedCandidate || values.includes(normalizedCandidate)) {
    return values;
  }

  return [...values, normalizedCandidate];
}

type ProcessPickerProps = {
  devCoreExecutables: string[];
  devSupportExecutables: string[];
  appBlockExecutables: string[];
  onAddDevCoreExecutable: (executable: string) => void;
  onAddDevSupportExecutable: (executable: string) => void;
  onAddAppBlockExecutable: (executable: string) => void;
};

function ProcessPicker({
  devCoreExecutables,
  devSupportExecutables,
  appBlockExecutables,
  onAddDevCoreExecutable,
  onAddDevSupportExecutable,
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
  const normalizedDevCoreSet = new Set(
    devCoreExecutables.map(normalizeExecutableInput).filter(Boolean)
  );
  const normalizedDevSupportSet = new Set(
    devSupportExecutables.map(normalizeExecutableInput).filter(Boolean)
  );
  const normalizedAppBlockSet = new Set(
    appBlockExecutables.map(normalizeExecutableInput).filter(Boolean)
  );

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
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
            !selectedProcess ||
            normalizedDevCoreSet.has(selectedProcess.executable)
          }
          onClick={() => {
            if (!selectedProcess) {
              return;
            }
            onAddDevCoreExecutable(selectedProcess.executable);
          }}
        >
          Add to dev core
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={
            !selectedProcess ||
            normalizedDevSupportSet.has(selectedProcess.executable)
          }
          onClick={() => {
            if (!selectedProcess) {
              return;
            }
            onAddDevSupportExecutable(selectedProcess.executable);
          }}
        >
          Add to dev support
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
          Add to app block
        </Button>
      </div>
    </div>
  );
}

function ChipList({
  values,
  variant,
  onRemove,
  emptyText,
}: {
  values: string[];
  variant: 'secondary' | 'outline';
  onRemove: (value: string) => void;
  emptyText: string;
}) {
  if (values.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map(value => (
        <Badge key={value} variant={variant} className="gap-2 px-2 py-1">
          <span>{value}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(value)}
          >
            x
          </button>
        </Badge>
      ))}
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

  const [desktopDevCoreList, setDesktopDevCoreList] = useState<string[]>(
    DEFAULT_DESKTOP_FOCUS_SETTINGS.devCoreList
  );
  const [desktopDevCoreCandidate, setDesktopDevCoreCandidate] = useState('');
  const [desktopDevSupportList, setDesktopDevSupportList] = useState<string[]>(
    DEFAULT_DESKTOP_FOCUS_SETTINGS.devSupportList
  );
  const [desktopDevSupportCandidate, setDesktopDevSupportCandidate] =
    useState('');
  const [desktopDevSiteList, setDesktopDevSiteList] = useState<string[]>(
    DEFAULT_DESKTOP_FOCUS_SETTINGS.devSiteList
  );
  const [desktopDevSiteCandidate, setDesktopDevSiteCandidate] = useState('');

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
  const [
    desktopInactivityThresholdSeconds,
    setDesktopInactivityThresholdSeconds,
  ] = useState(
    String(DEFAULT_DESKTOP_FOCUS_SETTINGS.inactivityThresholdSeconds)
  );

  const [desktopAutoInactivityPause, setDesktopAutoInactivityPause] = useState(
    DEFAULT_DESKTOP_FOCUS_SETTINGS.autoInactivityPause
  );
  const [desktopAutoSession, setDesktopAutoSession] = useState(
    DEFAULT_DESKTOP_FOCUS_SETTINGS.autoSession
  );
  const [desktopAutoSessionWarmupSeconds, setDesktopAutoSessionWarmupSeconds] =
    useState(String(DEFAULT_DESKTOP_FOCUS_SETTINGS.autoSessionWarmupSeconds));

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

    const nextDevCoreList =
      (desktopFocus.devCoreList?.length ?? 0) > 0
        ? (desktopFocus.devCoreList ?? [])
        : (desktopFocus.ideWatchList ?? []);

    setDesktopDevCoreList(
      nextDevCoreList.map(normalizeExecutableInput).filter(Boolean)
    );
    setDesktopDevSupportList(
      (
        desktopFocus.devSupportList ??
        DEFAULT_DESKTOP_FOCUS_SETTINGS.devSupportList
      )
        .map(normalizeExecutableInput)
        .filter(Boolean)
    );
    setDesktopDevSiteList(
      (desktopFocus.devSiteList ?? DEFAULT_DESKTOP_FOCUS_SETTINGS.devSiteList)
        .map(normalizeDomainInput)
        .filter(Boolean)
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
    setDesktopInactivityThresholdSeconds(
      String(
        desktopFocus.inactivityThresholdSeconds ??
          DEFAULT_DESKTOP_FOCUS_SETTINGS.inactivityThresholdSeconds
      )
    );
    setDesktopAutoInactivityPause(
      desktopFocus.autoInactivityPause ??
        DEFAULT_DESKTOP_FOCUS_SETTINGS.autoInactivityPause
    );
    setDesktopAutoSession(
      desktopFocus.autoSession ?? DEFAULT_DESKTOP_FOCUS_SETTINGS.autoSession
    );
    setDesktopAutoSessionWarmupSeconds(
      String(
        desktopFocus.autoSessionWarmupSeconds ??
          DEFAULT_DESKTOP_FOCUS_SETTINGS.autoSessionWarmupSeconds
      )
    );
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

    const normalizedDevCoreList = Array.from(new Set(desktopDevCoreList));

    const desktopFocusPayload: DesktopFocusSettingsState = {
      devCoreList: normalizedDevCoreList,
      ideWatchList: normalizedDevCoreList,
      devSupportList: Array.from(new Set(desktopDevSupportList)),
      devSiteList: Array.from(new Set(desktopDevSiteList)),
      appBlockList: toEnabledDesktopAppBlockList(desktopAppBlockItems),
      websiteBlockList: Array.from(new Set(desktopWebsiteBlockList)),
      strictMode: desktopStrictMode,
      appActionMode: desktopAppActionMode,
      websiteActionMode: desktopWebsiteActionMode,
      graceSeconds: clampInteger(
        Number(desktopGraceSeconds),
        DEFAULT_DESKTOP_FOCUS_SETTINGS.graceSeconds,
        5,
        3_600
      ),
      reminderIntervalSeconds: clampInteger(
        Number(desktopReminderSeconds),
        DEFAULT_DESKTOP_FOCUS_SETTINGS.reminderIntervalSeconds,
        30,
        3_600
      ),
      inactivityThresholdSeconds: clampInteger(
        Number(desktopInactivityThresholdSeconds),
        DEFAULT_DESKTOP_FOCUS_SETTINGS.inactivityThresholdSeconds,
        60,
        3_600
      ),
      autoInactivityPause: desktopAutoInactivityPause,
      autoSession: desktopAutoSession,
      autoSessionWarmupSeconds: clampInteger(
        Number(desktopAutoSessionWarmupSeconds),
        DEFAULT_DESKTOP_FOCUS_SETTINGS.autoSessionWarmupSeconds,
        30,
        600
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
          Configure activity detection, automatic sessions, and focus
          enforcement.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Activity Detection</CardTitle>
          <CardDescription>
            Define what counts as development activity and when inactivity
            should pause sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasDesktopProcessPicker ? (
            <ProcessPicker
              devCoreExecutables={desktopDevCoreList}
              devSupportExecutables={desktopDevSupportList}
              appBlockExecutables={desktopAppBlockItems.map(
                item => item.executable
              )}
              onAddDevCoreExecutable={executable =>
                setDesktopDevCoreList(previous =>
                  appendUniqueValue(previous, executable)
                )
              }
              onAddDevSupportExecutable={executable =>
                setDesktopDevSupportList(previous =>
                  appendUniqueValue(previous, executable)
                )
              }
              onAddAppBlockExecutable={addDesktopAppBlockExecutable}
            />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Dev core executable list</p>
              <div className="flex gap-2">
                <Input
                  value={desktopDevCoreCandidate}
                  onChange={event =>
                    setDesktopDevCoreCandidate(event.target.value)
                  }
                  placeholder="code.exe"
                />
                <Button
                  type="button"
                  onClick={() => {
                    setDesktopDevCoreList(previous =>
                      appendUniqueValue(previous, desktopDevCoreCandidate)
                    );
                    setDesktopDevCoreCandidate('');
                  }}
                >
                  Add
                </Button>
              </div>
              <ChipList
                values={desktopDevCoreList}
                variant="secondary"
                emptyText="No dev core executables configured."
                onRemove={value =>
                  setDesktopDevCoreList(previous =>
                    previous.filter(item => item !== value)
                  )
                }
              />
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Dev support executable list</p>
              <div className="flex gap-2">
                <Input
                  value={desktopDevSupportCandidate}
                  onChange={event =>
                    setDesktopDevSupportCandidate(event.target.value)
                  }
                  placeholder="wt.exe"
                />
                <Button
                  type="button"
                  onClick={() => {
                    setDesktopDevSupportList(previous =>
                      appendUniqueValue(previous, desktopDevSupportCandidate)
                    );
                    setDesktopDevSupportCandidate('');
                  }}
                >
                  Add
                </Button>
              </div>
              <ChipList
                values={desktopDevSupportList}
                variant="secondary"
                emptyText="No dev support executables configured."
                onRemove={value =>
                  setDesktopDevSupportList(previous =>
                    previous.filter(item => item !== value)
                  )
                }
              />
            </div>

            <div className="space-y-3 rounded-md border p-3 lg:col-span-2">
              <p className="text-sm font-medium">Dev site allowlist</p>
              <div className="flex gap-2">
                <Input
                  value={desktopDevSiteCandidate}
                  onChange={event =>
                    setDesktopDevSiteCandidate(event.target.value)
                  }
                  placeholder="chat.openai.com"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const nextValues = parseListInput(
                      desktopDevSiteCandidate
                    ).reduce(
                      (values, candidate) =>
                        appendUniqueDomain(values, candidate),
                      desktopDevSiteList
                    );
                    setDesktopDevSiteList(nextValues);
                    setDesktopDevSiteCandidate('');
                  }}
                >
                  Add
                </Button>
              </div>
              <ChipList
                values={desktopDevSiteList}
                variant="outline"
                emptyText="No dev sites configured."
                onRemove={value =>
                  setDesktopDevSiteList(previous =>
                    previous.filter(item => item !== value)
                  )
                }
              />
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-pause on inactivity</p>
                <p className="text-xs text-muted-foreground">
                  Pause running sessions when no dev core app is active.
                </p>
              </div>
              <Switch
                checked={desktopAutoInactivityPause}
                onCheckedChange={setDesktopAutoInactivityPause}
              />
            </div>
            <div className="max-w-xs space-y-2">
              <label className="text-xs font-medium">
                Inactivity threshold
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={60}
                  max={3600}
                  value={desktopInactivityThresholdSeconds}
                  onChange={event =>
                    setDesktopInactivityThresholdSeconds(event.target.value)
                  }
                />
                <span className="text-xs text-muted-foreground">sec</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Session</CardTitle>
          <CardDescription>
            Automatically start a focus session after sustained dev-core
            activity with no active session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Enable auto-session</p>
              <p className="text-xs text-muted-foreground">
                When enabled, DevSuite starts sessions automatically after
                warm-up.
              </p>
            </div>
            <Switch
              checked={desktopAutoSession}
              onCheckedChange={setDesktopAutoSession}
            />
          </div>

          <div className="max-w-xs space-y-2">
            <label className="text-xs font-medium">Warm-up duration</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={30}
                max={600}
                value={desktopAutoSessionWarmupSeconds}
                onChange={event =>
                  setDesktopAutoSessionWarmupSeconds(event.target.value)
                }
                disabled={!desktopAutoSession}
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Focus & Enforcement</CardTitle>
          <CardDescription>
            Configure strict enforcement behavior, distractor rules, and desktop
            runtime preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">Grace window</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={3600}
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
                  min={30}
                  max={3600}
                  value={desktopReminderSeconds}
                  onChange={event =>
                    setDesktopReminderSeconds(event.target.value)
                  }
                />
                <span className="text-xs text-muted-foreground">sec</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Distractor app block list</p>
              <div className="flex gap-2">
                <Input
                  value={desktopAppBlockCandidate}
                  onChange={event =>
                    setDesktopAppBlockCandidate(event.target.value)
                  }
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

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Website block list</p>
              <div className="flex gap-2">
                <Input
                  value={desktopWebsiteCandidate}
                  onChange={event =>
                    setDesktopWebsiteCandidate(event.target.value)
                  }
                  placeholder="youtube.com"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const nextValues = parseListInput(
                      desktopWebsiteCandidate
                    ).reduce(
                      (values, candidate) =>
                        appendUniqueDomain(values, candidate),
                      desktopWebsiteBlockList
                    );
                    setDesktopWebsiteBlockList(nextValues);
                    setDesktopWebsiteCandidate('');
                  }}
                >
                  Add
                </Button>
              </div>
              <ChipList
                values={desktopWebsiteBlockList}
                variant="outline"
                emptyText="No blocked domains configured."
                onRemove={value =>
                  setDesktopWebsiteBlockList(previous =>
                    previous.filter(item => item !== value)
                  )
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">Companion shortcut</label>
              <Input
                value={desktopCompanionShortcut}
                onChange={event =>
                  setDesktopCompanionShortcut(event.target.value)
                }
                placeholder={DEFAULT_COMPANION_SHORTCUT}
                disabled={!hasDesktopCompanionApi}
              />
            </div>
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Start DevSuite with Windows</span>
                <Switch
                  checked={desktopOpenAtLogin}
                  disabled={!hasDesktopRuntimePreferencesApi}
                  onCheckedChange={setDesktopOpenAtLogin}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Run in background when window is closed
                </span>
                <Switch
                  checked={desktopRunInBackgroundOnClose}
                  disabled={!hasDesktopRuntimePreferencesApi}
                  onCheckedChange={setDesktopRunInBackgroundOnClose}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
