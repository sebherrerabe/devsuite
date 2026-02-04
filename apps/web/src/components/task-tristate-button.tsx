import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TriState } from '@/lib/task-tristate';
import type { ButtonHTMLAttributes } from 'react';

interface TaskTriStateButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type'
> {
  state: TriState;
  size?: 'sm' | 'md';
}

export function TaskTriStateButton({
  state,
  size = 'md',
  className,
  ...props
}: TaskTriStateButtonProps) {
  const sizeClasses = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const iconClasses = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <button
      type="button"
      className={cn(
        'flex items-center justify-center rounded-[4px] border transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        sizeClasses,
        state === 'todo' &&
          'border-muted-foreground/40 text-muted-foreground hover:border-foreground/60 hover:text-foreground',
        state === 'ongoing' &&
          'border-foreground/40 text-foreground bg-foreground/5',
        state === 'done' &&
          'border-foreground/70 text-background bg-foreground',
        className
      )}
      {...props}
    >
      {state === 'ongoing' && <Minus className={iconClasses} />}
      {state === 'done' && <Check className={iconClasses} />}
    </button>
  );
}
