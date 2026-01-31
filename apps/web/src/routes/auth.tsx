import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { authClient } from '@/lib/auth';

export const Route = createFileRoute('/auth')({
  beforeLoad: async ({ location: _location }) => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({
        to: '/',
      });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <img src="/logo.svg" alt="DevSuite" className="h-12 w-auto" />
      </div>
      <div className="max-w-md w-full space-y-8">
        <Outlet />
      </div>
    </div>
  );
}
