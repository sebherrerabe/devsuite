import type { Id } from '../../../../convex/_generated/dataModel';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TaskDetail } from '@/components/task-detail';

interface TaskSheetProps {
  taskId: Id<'tasks'> | null;
  companyId: Id<'companies'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskSheet({
  taskId,
  companyId,
  open,
  onOpenChange,
}: TaskSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <TaskDetail
          taskId={taskId}
          companyId={companyId}
          fetch={open && !!taskId}
          variant="sheet"
        />
      </SheetContent>
    </Sheet>
  );
}
