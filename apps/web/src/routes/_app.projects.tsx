import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/projects')({
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
      <p className="text-muted-foreground">
        Manage and track all your active projects.
      </p>
    </div>
  );
}
