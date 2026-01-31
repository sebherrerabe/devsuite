import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { authClient } from './lib/auth';
import { ThemeProvider } from 'next-themes';
import { ErrorBoundary } from './components/error-boundary';
import { PrivacyModeProvider } from './lib/privacy-mode-context';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // This will be set in the component
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          <PrivacyModeProvider>
            <RouterProvider router={router} />
          </PrivacyModeProvider>
        </ConvexBetterAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
