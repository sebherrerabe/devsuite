import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

function clampInteger(value: number, fallbackValue: number): number {
  if (!Number.isFinite(value)) {
    return fallbackValue;
  }
  return Math.max(1, Math.trunc(value));
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

  const addDesktopAppBlockItem = () => {
    const normalized = normalizeExecutableInput(desktopAppBlockCandidate);
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
    setDesktopAppBlockCandidate('');
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
