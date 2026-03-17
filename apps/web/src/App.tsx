import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { authClient } from './lib/auth';
import { ThemeProvider } from 'next-themes';
import { ErrorBoundary } from './components/error-boundary';
import { PrivacyModeProvider } from './lib/privacy-mode-context';
import { RuntimeConfigError } from './components/runtime-config-error';
import { readWebRuntimeConfig } from './lib/runtime-config';

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // This will be set in the component
  },
});

let convexClient: ConvexReactClient | null = null;

function getConvexClient(convexUrl: string): ConvexReactClient {
  if (!convexClient) {
    convexClient = new ConvexReactClient(convexUrl);
  }

  return convexClient;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  const runtimeConfig = readWebRuntimeConfig();

  if (!runtimeConfig.ok) {
    console.error(
      '[startup] Missing required runtime configuration.',
      runtimeConfig.missingKeys
    );
    return <RuntimeConfigError missingKeys={runtimeConfig.missingKeys} />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <ConvexBetterAuthProvider
          client={getConvexClient(runtimeConfig.value.convexUrl)}
          authClient={authClient}
        >
          <PrivacyModeProvider>
            <RouterProvider router={router} />
          </PrivacyModeProvider>
        </ConvexBetterAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
