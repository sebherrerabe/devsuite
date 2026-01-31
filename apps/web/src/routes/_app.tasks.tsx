import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { TaskTree } from '@/components/task-tree';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import type { Doc } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/tasks')({
  component: GlobalTasksPage,
});

function GlobalTasksPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;

  const [showCompleted, setShowCompleted] = useState(false);

  const tasks = useQuery(
    api.tasks.getCompanyTasks,
    companyId ? { companyId } : 'skip'
  );

  const { todayTasks, upcomingTasks, overdueTasks } = useMemo(() => {
    if (!tasks) return { todayTasks: [], upcomingTasks: [], overdueTasks: [] };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayTimestamp = now.getTime();
    const tomorrowTimestamp = todayTimestamp + 24 * 60 * 60 * 1000;

    const activeTasks = showCompleted
      ? tasks
      : tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

    return {
      todayTasks: activeTasks.filter(
        t =>
          t.dueDate !== null &&
          t.dueDate >= todayTimestamp &&
          t.dueDate < tomorrowTimestamp
      ),
      upcomingTasks: activeTasks.filter(
        t => t.dueDate !== null && t.dueDate >= tomorrowTimestamp
      ),
      overdueTasks: activeTasks.filter(
        t =>
          t.dueDate !== null &&
          t.dueDate < todayTimestamp &&
          t.status !== 'done' &&
          t.status !== 'cancelled'
      ),
    };
  }, [tasks, showCompleted]);

  if (!companyId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-muted-foreground">
            View all your tasks across all projects.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? (
            <EyeOff className="mr-2 h-4 w-4" />
          ) : (
            <Eye className="mr-2 h-4 w-4" />
          )}
          {showCompleted ? 'Hide Completed' : 'Show Completed'}
        </Button>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList>
          <TabsTrigger value="today" className="relative">
            Today
            {todayTasks.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 px-1.5 py-0 h-4 min-w-4 flex items-center justify-center"
              >
                {todayTasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming
            {upcomingTasks.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 px-1.5 py-0 h-4 min-w-4 flex items-center justify-center"
              >
                {upcomingTasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue
            {overdueTasks.length > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 px-1.5 py-0 h-4 min-w-4 flex items-center justify-center"
              >
                {overdueTasks.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="py-4">
          <TaskTree
            projectId={null}
            companyId={companyId}
            tasksFilter={(t: Doc<'tasks'>) =>
              todayTasks.some(tt => tt._id === t._id)
            }
          />
        </TabsContent>
        <TabsContent value="upcoming" className="py-4">
          <TaskTree
            projectId={null}
            companyId={companyId}
            tasksFilter={(t: Doc<'tasks'>) =>
              upcomingTasks.some(tt => tt._id === t._id)
            }
          />
        </TabsContent>
        <TabsContent value="overdue" className="py-4">
          <TaskTree
            projectId={null}
            companyId={companyId}
            tasksFilter={(t: Doc<'tasks'>) =>
              overdueTasks.some(tt => tt._id === t._id)
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
