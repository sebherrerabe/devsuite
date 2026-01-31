import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/settings/profile')({
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile</h3>
        <p className="text-sm text-muted-foreground">
          This is how others will see you on the site.
        </p>
      </div>
      <div className="h-[1px] bg-border" />
      <div className="space-y-4">
        <p>Profile settings placeholder...</p>
      </div>
    </div>
  );
}
