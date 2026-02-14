import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useCurrentCompany } from '@/lib/company-context';

export const Route = createFileRoute('/_app/invoicing')({
  component: InvoicingLayout,
});

function InvoicingLayout() {
  const navigate = useNavigate();
  const { isLoading, isModuleEnabled } = useCurrentCompany();
  const enabled = isModuleEnabled('invoicing');

  useEffect(() => {
    if (!isLoading && !enabled) {
      void navigate({ to: '/', replace: true });
    }
  }, [enabled, isLoading, navigate]);

  if (!isLoading && !enabled) {
    return null;
  }

  return <Outlet />;
}
