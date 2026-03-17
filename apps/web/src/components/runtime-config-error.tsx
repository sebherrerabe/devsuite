interface RuntimeConfigErrorProps {
  missingKeys: string[];
}

export function RuntimeConfigError({ missingKeys }: RuntimeConfigErrorProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-10">
        <section className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/30">
          <div className="border-b border-border bg-linear-to-r from-sky-500/15 via-cyan-400/10 to-background px-8 py-8">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-sky-300">
              DevSuite Startup Error
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              The app is missing required runtime configuration
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              DevSuite loaded its bundled UI, but the release does not include
              the configuration needed to connect to backend services. This
              prevents the renderer from starting normally.
            </p>
          </div>
          <div className="space-y-6 px-8 py-8">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              Missing keys: {missingKeys.join(', ')}
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                If you installed a GitHub release, that installer likely needs
                to be rebuilt with the required Vite environment values.
              </p>
              <p>
                If you are running locally, make sure the web build includes
                valid{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                  VITE_CONVEX_URL
                </code>{' '}
                and{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                  VITE_CONVEX_SITE_URL
                </code>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
