import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { showToast } from '@/lib/toast';

export const Route = createFileRoute('/_app/settings/profile')({
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const settings = useQuery(
    api.userSettings.get,
    companyId ? { companyId } : 'skip'
  );
  const updateSettings = useMutation(api.userSettings.update);
  const [timezone, setTimezone] = useState('UTC');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings?.timezone) {
      setTimezone(settings.timezone);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!companyId) return;
    setIsSaving(true);
    try {
      await updateSettings({ companyId, timezone: timezone.trim() });
      showToast.success('Timezone updated');
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
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
