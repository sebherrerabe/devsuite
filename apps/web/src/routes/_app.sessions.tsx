import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/sessions')({
  component: SessionsPage,
});

function SessionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
      <p className="text-muted-foreground">
        Track your focus sessions and productivity.
      </p>
    </div>
  );
}
