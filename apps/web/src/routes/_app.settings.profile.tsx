import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useCallback, useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authClient } from '@/lib/auth';
import {
  DEFAULT_MODULE_FLAGS,
  type AppModule,
  type ModuleFlags,
  appModuleValues,
} from '@devsuite/shared';

const MODULE_LABELS: Record<AppModule, string> = {
  projects: 'Projects',
  sessions: 'Sessions',
  performance: 'Performance',
  pr_reviews: 'PR Reviews',
  invoicing: 'Invoicing',
};

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

function formatListValue(values: string[]): string {
  return values.join('\n');
}

function addExecutableToListInput(
  inputValue: string,
  executable: string
): string {
  const normalizedExecutable = normalizeExecutableInput(executable);
  if (!normalizedExecutable) {
    return inputValue;
  }

  const existingValues = Array.from(
    new Set(parseListInput(inputValue).map(normalizeExecutableInput))
  );
  if (existingValues.includes(normalizedExecutable)) {
    return formatListValue(existingValues);
  }

  return formatListValue([...existingValues, normalizedExecutable]);
}

function clampInteger(value: number, fallbackValue: number): number {
  if (!Number.isFinite(value)) {
    return fallbackValue;
  }
  return Math.max(1, Math.trunc(value));
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
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Running Process Picker</p>
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
                onSelect={() => {
                  setSelectedExecutable(process.executable);
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-xs">
                    {process.windowTitle || '(No window title)'}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {process.executable}
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
          Add to IDE Watch List
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
          Add to App Block List
        </Button>
      </div>
      {selectedProcess ? (
        <p className="text-xs text-muted-foreground">
          Selected: {selectedProcess.executable}
          {selectedProcess.windowTitle
            ? ` (${selectedProcess.windowTitle})`
            : ''}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select a process to add it to a list.
        </p>
      )}
    </div>
  );
}

export const Route = createFileRoute('/_app/settings/profile')({
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const { data: authSession } = authClient.useSession();
  const { currentCompany, moduleAccess, companyModuleDefaults } =
    useCurrentCompany();
  const companyId = currentCompany?._id;
  const userId = getSessionUserId(authSession);
  const settings = useQuery(
    api.userSettings.get,
    companyId ? { companyId } : 'skip'
  );
  const updateSettings = useMutation(api.userSettings.update);
  const [timezone, setTimezone] = useState('UTC');
  const [moduleFlags, setModuleFlags] =
    useState<ModuleFlags>(DEFAULT_MODULE_FLAGS);
  const [desktopIdeWatchListInput, setDesktopIdeWatchListInput] = useState(
    formatListValue(DEFAULT_DESKTOP_FOCUS_SETTINGS.ideWatchList)
  );
  const [desktopAppBlockItems, setDesktopAppBlockItems] = useState<
    DesktopAppBlockItem[]
  >(toDesktopAppBlockItems(DEFAULT_DESKTOP_FOCUS_SETTINGS.appBlockList));
  const [desktopAppBlockCandidate, setDesktopAppBlockCandidate] = useState('');
  const [desktopWebsiteBlockListInput, setDesktopWebsiteBlockListInput] =
    useState('');
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
  const [isSaving, setIsSaving] = useState(false);
  const isDesktopRuntime =
    typeof window !== 'undefined' && typeof window.desktopFocus !== 'undefined';
  const hasDesktopProcessPicker =
    typeof window !== 'undefined' &&
    typeof window.desktopProcessMonitor?.listRunningProcesses === 'function';

  useEffect(() => {
    if (settings?.timezone) {
      setTimezone(settings.timezone);
    }
  }, [settings]);

  useEffect(() => {
    if (moduleAccess) {
      setModuleFlags(moduleAccess);
    } else if (companyModuleDefaults) {
      setModuleFlags(companyModuleDefaults);
    }
  }, [companyModuleDefaults, moduleAccess]);

  useEffect(() => {
    const desktopFocus =
      settings?.desktopFocus ?? DEFAULT_DESKTOP_FOCUS_SETTINGS;

    setDesktopIdeWatchListInput(formatListValue(desktopFocus.ideWatchList));
    setDesktopAppBlockItems(toDesktopAppBlockItems(desktopFocus.appBlockList));
    setDesktopWebsiteBlockListInput(
      formatListValue(desktopFocus.websiteBlockList)
    );
    setDesktopStrictMode(desktopFocus.strictMode);
    setDesktopAppActionMode(desktopFocus.appActionMode);
    setDesktopWebsiteActionMode(desktopFocus.websiteActionMode);
    setDesktopGraceSeconds(String(desktopFocus.graceSeconds));
    setDesktopReminderSeconds(String(desktopFocus.reminderIntervalSeconds));
  }, [settings?.desktopFocus]);

  const toggleModule = (module: AppModule, enabled: boolean) => {
    setModuleFlags(prev => {
      const next = { ...prev, [module]: enabled };
      if (module === 'projects' && !enabled) {
        next.sessions = false;
        next.performance = false;
        next.invoicing = false;
      }
      if (module === 'sessions' && !enabled) {
        next.invoicing = false;
      }
      return next;
    });
  };

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

  const addDesktopAppBlockItem = () => {
    addDesktopAppBlockExecutable(desktopAppBlockCandidate);
    setDesktopAppBlockCandidate('');
  };

  const addDesktopIdeWatchExecutable = (executable: string) => {
    setDesktopIdeWatchListInput(previousValue =>
      addExecutableToListInput(previousValue, executable)
    );
  };

  const handleSave = async () => {
    if (!companyId) return;

    const desktopFocusPayload: DesktopFocusSettingsState = {
      ideWatchList: parseListInput(desktopIdeWatchListInput),
      appBlockList: toEnabledDesktopAppBlockList(desktopAppBlockItems),
      websiteBlockList: parseListInput(desktopWebsiteBlockListInput),
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
        timezone: timezone.trim(),
        moduleFlags,
        desktopFocus: desktopFocusPayload,
      });

      if (isDesktopRuntime && userId) {
        await window.desktopFocus?.set(
          { userId, companyId },
          desktopFocusPayload
        );
      }

      showToast.success('Profile settings updated');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to update settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile</h3>
        <p className="text-sm text-muted-foreground">
          Configure your personal settings.
        </p>
      </div>
      <div className="h-[1px] bg-border" />
      <div className="space-y-4">
        <div className="space-y-2 max-w-sm">
          <label className="text-sm font-medium">Timezone</label>
          <Input
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            placeholder="America/New_York"
          />
          <p className="text-xs text-muted-foreground">
            Used for day grouping in invoices.
          </p>
        </div>
        <div className="space-y-3 max-w-md">
          <p className="text-sm font-medium">Module Access (User Override)</p>
          <p className="text-xs text-muted-foreground">
            These settings apply to your account for the current company.
          </p>
          {appModuleValues.map(module => {
            const projectsEnabled = moduleFlags.projects;
            const sessionsEnabled = moduleFlags.sessions;
            const isInvoicing = module === 'invoicing';
            const disabled =
              ((module === 'sessions' ||
                module === 'performance' ||
                module === 'invoicing') &&
                !projectsEnabled) ||
              (isInvoicing && !sessionsEnabled);
            return (
              <div
                key={module}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="text-sm">{MODULE_LABELS[module]}</span>
                <Checkbox
                  checked={moduleFlags[module]}
                  disabled={disabled}
                  onCheckedChange={checked =>
                    toggleModule(module, Boolean(checked))
                  }
                />
              </div>
            );
          })}
        </div>
        <div className="space-y-4 max-w-2xl">
          <p className="text-sm font-medium">Desktop Focus Settings</p>
          <p className="text-xs text-muted-foreground">
            Parameterize strict-mode behavior for the desktop app. Enforcement
            only runs in desktop runtime.
          </p>
          <p className="text-xs text-muted-foreground">
            Runtime: {isDesktopRuntime ? 'Desktop bridge detected' : 'Web only'}
          </p>
          {hasDesktopProcessPicker ? (
            <ProcessPicker
              ideExecutables={parseListInput(desktopIdeWatchListInput)}
              appBlockExecutables={desktopAppBlockItems.map(
                item => item.executable
              )}
              onAddIdeExecutable={addDesktopIdeWatchExecutable}
              onAddAppBlockExecutable={addDesktopAppBlockExecutable}
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">IDE Watch List</label>
              <Textarea
                value={desktopIdeWatchListInput}
                onChange={event =>
                  setDesktopIdeWatchListInput(event.target.value)
                }
                placeholder="Code.exe&#10;Cursor.exe&#10;idea64.exe"
              />
              <p className="text-xs text-muted-foreground">
                One executable per line (or comma-separated).
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">App Block List</label>
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={desktopAppBlockCandidate}
                    onChange={event =>
                      setDesktopAppBlockCandidate(event.target.value)
                    }
                    placeholder="whatsapp.exe"
                  />
                  <Button type="button" onClick={addDesktopAppBlockItem}>
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
                        className="flex items-center justify-between rounded border px-2 py-1.5"
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
                          <span className="text-xs">{item.executable}</span>
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
              <p className="text-xs text-muted-foreground">
                Toggle to enable/disable entries before saving.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Website Block List</label>
            <Textarea
              value={desktopWebsiteBlockListInput}
              onChange={event =>
                setDesktopWebsiteBlockListInput(event.target.value)
              }
              placeholder="youtube.com&#10;x.com&#10;instagram.com"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-medium">Strict Mode</label>
              <Select
                value={desktopStrictMode}
                onValueChange={value =>
                  setDesktopStrictMode(
                    value as DesktopFocusSettingsState['strictMode']
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prompt_only">Prompt only</SelectItem>
                  <SelectItem value="prompt_then_close">
                    Prompt then close
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">App Action</label>
              <Select
                value={desktopAppActionMode}
                onValueChange={value =>
                  setDesktopAppActionMode(
                    value as DesktopFocusSettingsState['appActionMode']
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="warn_then_close">
                    Warn then close
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Website Action</label>
              <Select
                value={desktopWebsiteActionMode}
                onValueChange={value =>
                  setDesktopWebsiteActionMode(
                    value as DesktopFocusSettingsState['websiteActionMode']
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn_only">Warn only</SelectItem>
                  <SelectItem value="escalate">Escalate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">Grace Seconds</label>
              <Input
                type="number"
                min={1}
                value={desktopGraceSeconds}
                onChange={event => setDesktopGraceSeconds(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">
                Reminder Interval Seconds
              </label>
              <Input
                type="number"
                min={1}
                value={desktopReminderSeconds}
                onChange={event =>
                  setDesktopReminderSeconds(event.target.value)
                }
              />
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
