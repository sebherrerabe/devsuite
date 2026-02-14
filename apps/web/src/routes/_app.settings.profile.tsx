import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { showToast } from '@/lib/toast';
import { Checkbox } from '@/components/ui/checkbox';
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

export const Route = createFileRoute('/_app/settings/profile')({
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const { currentCompany, moduleAccess, companyModuleDefaults } =
    useCurrentCompany();
  const companyId = currentCompany?._id;
  const settings = useQuery(
    api.userSettings.get,
    companyId ? { companyId } : 'skip'
  );
  const updateSettings = useMutation(api.userSettings.update);
  const [timezone, setTimezone] = useState('UTC');
  const [moduleFlags, setModuleFlags] =
    useState<ModuleFlags>(DEFAULT_MODULE_FLAGS);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    if (!companyId) return;
    setIsSaving(true);
    try {
      await updateSettings({
        companyId,
        timezone: timezone.trim(),
        moduleFlags,
      });
      showToast.success('Profile settings updated');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to update timezone'
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
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
