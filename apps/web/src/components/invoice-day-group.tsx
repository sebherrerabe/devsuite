import { cn } from '@/lib/utils';
import type { Id } from '../../../../convex/_generated/dataModel';
import type {
  InvoiceDayGroup as SharedInvoiceDayGroup,
  InvoiceDayLine as SharedInvoiceDayLine,
  InvoiceProjectGroup as SharedInvoiceProjectGroup,
  InvoiceTaskRef as SharedInvoiceTaskRef,
} from '@devsuite/shared';

type InvoiceTask = Omit<SharedInvoiceTaskRef, 'taskId'> & {
  taskId: Id<'tasks'>;
};
type InvoiceProject = Omit<SharedInvoiceProjectGroup, 'projectId' | 'tasks'> & {
  projectId: Id<'projects'>;
  tasks: InvoiceTask[];
};
type InvoiceLine = Omit<SharedInvoiceDayLine, 'projects' | 'sessionIds'> & {
  projects: InvoiceProject[];
  sessionIds: Id<'sessions'>[];
};
type InvoiceDay = Omit<SharedInvoiceDayGroup, 'lines'> & {
  lines: InvoiceLine[];
};

const formatHours = (minutes: number) => (minutes / 60).toFixed(2);

const formatMoney = (currency: string, cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

export function InvoiceDayGroup({
  day,
  className,
}: {
  day: InvoiceDay;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{day.date}</div>
        <div className="text-sm text-muted-foreground">
          {formatHours(day.totalMinutes)} hours ·{' '}
          {formatMoney(day.lines[0]?.currency ?? 'USD', day.totalCents)}
        </div>
      </div>

      <div className="space-y-4">
        {day.lines.map((line, index) => (
          <div key={`${day.date}-${index}`} className="rounded-md border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">
                {formatHours(line.billedMinutes)} hours
              </div>
              <div className="text-sm text-muted-foreground">
                {formatMoney(line.currency, line.rateCents)} / hr
              </div>
              <div className="text-sm font-semibold">
                {formatMoney(line.currency, line.amountCents)}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {line.projects.map(project => (
                <div key={project.projectId} className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {project.projectName}
                  </div>
                  <ul className="ml-4 list-disc text-sm">
                    {project.tasks.map(task => (
                      <li key={task.taskId}>{task.title}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
