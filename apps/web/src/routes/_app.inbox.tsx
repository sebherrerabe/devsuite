import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/inbox')({
  component: InboxPage,
});

function InboxPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
      <p className="text-muted-foreground">
        Your unified inbox for all notifications and activities.
      </p>
    </div>
  );
}
