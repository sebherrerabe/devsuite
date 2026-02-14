import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface AttentionItemConfig {
  id: string;
  to: string;
  label: string;
  count: number;
  icon: LucideIcon;
  severity: 'critical' | 'warning' | 'info';
}

const severityStyles = {
  critical: {
    dot: 'bg-destructive',
    bg: 'bg-destructive/5 hover:bg-destructive/10 border-destructive/20',
  },
  warning: {
    dot: 'bg-chart-4',
    bg: 'bg-chart-4/5 hover:bg-chart-4/10 border-chart-4/20',
  },
  info: {
    dot: 'bg-primary',
    bg: 'bg-primary/5 hover:bg-primary/10 border-primary/20',
  },
};

interface AttentionPanelProps {
  items: AttentionItemConfig[];
}

export function AttentionPanel({ items }: AttentionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Needs attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="rounded-full bg-chart-2/10 p-3">
              <CheckCircle2 className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted-foreground">
                Nothing needs your attention
              </p>
            </div>
          </div>
        ) : (
          items.map(item => {
            const styles = severityStyles[item.severity];
            return (
              <Link
                key={item.id}
                to={item.to}
                className={cn(
                  'group flex items-center gap-3 rounded-lg border p-3 transition-all duration-200',
                  styles.bg,
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                      styles.dot
                    )}
                  />
                  <span
                    className={cn(
                      'relative inline-flex h-2.5 w-2.5 rounded-full',
                      styles.dot
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
