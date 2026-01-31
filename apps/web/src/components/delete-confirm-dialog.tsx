import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  taskTitle: string;
  subtaskCount: number;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  taskTitle,
  subtaskCount,
}: DeleteConfirmDialogProps) {
  // If alert-dialog is not available, we could use a standard dialog or fallback
  // For now, we assume it was added or we'll use a simple fallback if it fails.
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete{' '}
            <span className="font-semibold">&quot;{taskTitle}&quot;</span>
            {subtaskCount > 0 && (
              <>
                {' '}
                and its <span className="font-semibold">
                  {subtaskCount}
                </span>{' '}
                subtasks
              </>
            )}
            . This action can be undone within this session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
