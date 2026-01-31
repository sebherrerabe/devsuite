import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/settings/integrations')({
  component: IntegrationsSettingsPage,
});

function IntegrationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Manage third-party connections and API tokens.
        </p>
      </div>
      <div className="h-[1px] bg-border" />
      <div className="space-y-4">
        <p>Integrations settings placeholder...</p>
      </div>
    </div>
  );
}
