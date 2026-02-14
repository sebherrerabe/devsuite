import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface QuickActionsBarProps {
  actions: QuickAction[];
}

export function QuickActionsBar({ actions }: QuickActionsBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(action => (
        <Link
          key={action.to}
          to={action.to}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-border/50 px-4 py-2 text-sm font-medium',
            'transition-all duration-200',
            'hover:bg-primary/10 hover:border-primary/30 hover:text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <action.icon className="h-4 w-4" />
          {action.label}
        </Link>
      ))}
    </div>
  );
}
