import {
  createRootRoute,
  Link,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { authClient } from '@/lib/auth';
import { RouteError } from '@/components/error-boundary';

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    // Skip auth check for auth routes
    if (location.pathname.startsWith('/auth')) {
      return;
    }

    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: '/auth/sign-in',
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RouteError,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Outlet />
      <Toaster />
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
        404 - Not Found
      </h1>
      <p className="mt-4 text-muted-foreground">
        The page you’re looking for doesn’t exist.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        Go home
      </Link>
    </div>
  );
}
