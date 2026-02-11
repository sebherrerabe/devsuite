import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/invoicing')({
  component: InvoicingLayout,
});

function InvoicingLayout() {
  return <Outlet />;
}
