import { createFileRoute, useParams } from '@tanstack/react-router';
import { useCurrentCompany } from '@/lib/company-context';
import { ProjectTaskListsPanel } from '@/components/project-task-lists-panel';
import { TaskDetail } from '@/components/task-detail';
import { useState } from 'react';
import type { Id } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/projects/$projectId/tasks')({
  component: ProjectTasksPage,
});

function ProjectTasksPage() {
  const { projectId } = useParams({ from: '/_app/projects/$projectId/tasks' });
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const projectIdTyped = projectId as Id<'projects'>;
  const [selectedTaskId, setSelectedTaskId] = useState<Id<'tasks'> | null>(
    null
  );

  if (!companyId) return null;

  return (
    <div className="py-4">
      <div className="flex gap-6">
        <div className="w-[420px] shrink-0 border-r pr-4">
          <ProjectTaskListsPanel
            companyId={companyId}
            projectId={projectIdTyped}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
          />
        </div>
        <div className="flex-1 pl-2">
          <TaskDetail taskId={selectedTaskId} companyId={companyId} />
        </div>
      </div>
    </div>
  );
}
