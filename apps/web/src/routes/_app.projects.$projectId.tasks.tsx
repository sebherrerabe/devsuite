import { createFileRoute, useParams } from '@tanstack/react-router';
import { useCurrentCompany } from '@/lib/company-context';
import { TaskTree } from '@/components/task-tree';
import type { Id } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/projects/$projectId/tasks')({
  component: ProjectTasksPage,
});

function ProjectTasksPage() {
  const { projectId } = useParams({ from: '/_app/projects/$projectId/tasks' });
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const projectIdTyped = projectId as Id<'projects'>;

  if (!companyId) return null;

  return (
    <div className="py-4">
      <TaskTree projectId={projectIdTyped} companyId={companyId} />
    </div>
  );
}
