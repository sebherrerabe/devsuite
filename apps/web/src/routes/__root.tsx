import {
  createRootRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { authClient } from '@/lib/auth';
import { RouteError } from '@/components/error-boundary';

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    // Skip auth check for auth routes
    if (
      location.pathname.startsWith('/auth') ||
      location.pathname === '/session-companion'
    ) {
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
  const pathname = useRouterState({
    select: state => state.location.pathname,
  });
  const isCompanionRoute = pathname === '/session-companion';

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    htmlElement.classList.toggle('desktop-companion-mode', isCompanionRoute);
    bodyElement.classList.toggle('desktop-companion-mode', isCompanionRoute);

    return () => {
      htmlElement.classList.remove('desktop-companion-mode');
      bodyElement.classList.remove('desktop-companion-mode');
    };
  }, [isCompanionRoute]);

  return (
    <div
      className={`min-h-screen font-sans antialiased ${
        isCompanionRoute ? 'bg-transparent' : 'bg-background'
      }`}
    >
      <Outlet />
      <Toaster
        position={isCompanionRoute ? 'top-center' : 'bottom-right'}
        toastOptions={
          isCompanionRoute
            ? {
                duration: 3000,
                classNames: {
                  error: 'pointer-events-auto',
                  default: 'pointer-events-auto',
                  success: 'opacity-90',
                  info: 'opacity-90',
                  warning: 'opacity-90',
                },
              }
            : undefined
        }
      />
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
