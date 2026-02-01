import {
  createFileRoute,
  Link,
  Outlet,
  useParams,
} from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Loader2, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Id } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/projects/$projectId')({
  component: ProjectDetailLayout,
});

function ProjectDetailLayout() {
  const { projectId } = useParams({ from: '/_app/projects/$projectId' });
  const projectIdTyped = projectId as Id<'projects'>;

  const project = useQuery(api.projects.getProjectIncludingArchived, {
    id: projectIdTyped,
  });

  if (project === undefined) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <Button variant="outline" asChild>
          <Link to="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  // Block archived projects explicitly
  if (project.deletedAt !== null) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <h2 className="text-xl font-semibold">This project is archived</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Archived projects can&apos;t be opened. You can restore this project
          from the Projects list.
        </p>
        <Button variant="outline" asChild>
          <Link to="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const tabs = [
    { name: 'Tasks', to: '/projects/$projectId/tasks' },
    { name: 'Sessions', to: '/projects/$projectId/sessions' },
    { name: 'Settings', to: '/projects/$projectId/settings' },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-muted-foreground">
        <Link
          to="/projects"
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {project.name}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color || '#64748b' }}
            />
            {project.emoji && (
              <span className="text-2xl leading-none">{project.emoji}</span>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => (
            <Link
              key={tab.name}
              to={tab.to}
              params={{ projectId: projectIdTyped }}
              activeProps={{ className: 'border-primary text-foreground' }}
              inactiveProps={{
                className:
                  'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              }}
              className="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors"
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
