import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/projects/$projectId/sessions')({
  component: ProjectSessionsPage,
});

function ProjectSessionsPage() {
  return (
    <div className="py-6">
      <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg">
        <h3 className="text-lg font-medium text-muted-foreground">Sessions</h3>
        <p className="text-sm text-muted-foreground">Coming in Phase 8</p>
      </div>
    </div>
  );
}
