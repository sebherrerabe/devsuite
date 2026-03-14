import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { CompanyProvider } from '@/lib/company-context';
import { InboxDesktopNotificationsProvider } from '@/lib/inbox-desktop-notifications-context';
import { DesktopSessionBridge } from '@/lib/desktop-session-bridge';
import { WebSessionUnloadGuard } from '@/lib/web-session-unload-guard';
import { DesktopAutoUpdateConsentPrompt } from '@/components/desktop-auto-update-consent';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  return (
    <CompanyProvider desktopCompanyMode="owner">
      <DesktopSessionBridge />
      <WebSessionUnloadGuard />
      <InboxDesktopNotificationsProvider>
        <DesktopAutoUpdateConsentPrompt />
        <AppShell />
      </InboxDesktopNotificationsProvider>
    </CompanyProvider>
  );
}
