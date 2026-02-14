import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useCurrentCompany } from '@/lib/company-context';

export const Route = createFileRoute('/_app/projects')({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const navigate = useNavigate();
  const { isLoading, isModuleEnabled } = useCurrentCompany();
  const enabled = isModuleEnabled('projects');

  useEffect(() => {
    if (!isLoading && !enabled) {
      void navigate({ to: '/', replace: true });
    }
  }, [enabled, isLoading, navigate]);

  if (!isLoading && !enabled) {
    return null;
  }

  return (
    <div className="h-full">
      <Outlet />
    </div>
  );
}
