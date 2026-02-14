import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useCurrentCompany } from '@/lib/company-context';

export const Route = createFileRoute('/_app/reviews')({
  component: ReviewsLayout,
});

function ReviewsLayout() {
  const navigate = useNavigate();
  const { isLoading, isModuleEnabled } = useCurrentCompany();
  const enabled = isModuleEnabled('pr_reviews');

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
