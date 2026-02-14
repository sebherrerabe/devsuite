import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  to: string;
  children?: ReactNode;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  to,
  children,
}: StatCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm p-6',
        'bg-linear-to-b from-card/50 to-muted/50',
        'shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
      aria-label={`${title}: ${value}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="text-3xl font-bold tabular-nums tracking-tight">
            {value}
          </div>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </Link>
  );
}
