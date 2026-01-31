import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { CompanyProvider } from '@/lib/company-context';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  return (
    <CompanyProvider>
      <AppShell />
    </CompanyProvider>
  );
}
