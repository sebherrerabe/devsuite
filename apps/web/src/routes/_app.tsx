import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { CompanyProvider } from '@/lib/company-context';
import { InboxDesktopNotificationsProvider } from '@/lib/inbox-desktop-notifications-context';
import { DesktopSessionBridge } from '@/lib/desktop-session-bridge';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  return (
    <CompanyProvider desktopCompanyMode="owner">
      <DesktopSessionBridge />
      <InboxDesktopNotificationsProvider>
        <AppShell />
      </InboxDesktopNotificationsProvider>
    </CompanyProvider>
  );
}
