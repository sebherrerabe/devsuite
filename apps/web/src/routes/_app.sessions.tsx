import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/sessions')({
  component: SessionsLayout,
});

function SessionsLayout() {
  return <Outlet />;
}
