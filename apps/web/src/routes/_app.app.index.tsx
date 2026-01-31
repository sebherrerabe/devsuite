import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/app/')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome to your DevSuite dashboard. This is a placeholder for your main
        overview.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {['Repos', 'Projects', 'Tasks', 'Reviews'].map(item => (
          <div
            key={item}
            className="rounded-xl border bg-card p-6 text-card-foreground shadow"
          >
            <h3 className="font-semibold">{item}</h3>
            <p className="text-2xl font-bold">--</p>
          </div>
        ))}
      </div>
    </div>
  );
}
