import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/settings/')({
  beforeLoad: () => {
    // Redirect /settings to /settings/profile by default
    throw redirect({ to: '/settings/profile' });
  },
});
